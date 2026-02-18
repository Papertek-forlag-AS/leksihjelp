/**
 * POST /api/webhooks/vipps
 *
 * Receives webhook events from Vipps Recurring Payments API.
 * Updates Firestore with agreement and charge status changes.
 *
 * Vipps webhook payloads are flat JSON objects with an `eventType` field
 * (NOT a `status` field). Status is derived from the event type name.
 *
 * Events handled:
 *   Agreement: activated / rejected / stopped / expired
 *   Charge:    captured / failed / refunded / reserved / canceled
 *
 * Security: Verifies HMAC-SHA256 signature from the Authorization header
 * using the webhook secret (VIPPS_WEBHOOK_SECRET env var).
 *
 * Must respond 200 quickly — Vipps retries on non-2xx.
 */

import crypto from 'crypto';
import { getFirestoreDb } from '../_firebase.js';

// ── HMAC-SHA256 Webhook Verification ──

/**
 * Verify the Vipps webhook HMAC signature.
 *
 * Vipps signs webhooks with HMAC-SHA256. The Authorization header format:
 *   HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=<base64>
 *
 * The signed string format (LF-separated):
 *   POST\n<pathAndQuery>\n<x-ms-date>;<host>;<x-ms-content-sha256>
 *
 * @param {Object} req - Vercel request object
 * @param {string} rawBody - Raw JSON body string
 * @param {string} secret - Webhook secret from registration
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(req, rawBody, secret) {
  const authHeader = req.headers?.['authorization'] || '';
  const msDate = req.headers?.['x-ms-date'] || '';
  const contentHash = req.headers?.['x-ms-content-sha256'] || '';
  const host = req.headers?.['host'] || '';

  if (!authHeader || !msDate || !contentHash || !host) {
    console.warn('Webhook missing required headers for HMAC verification');
    return false;
  }

  // 1. Verify content hash matches the body
  const expectedContentHash = crypto
    .createHash('sha256')
    .update(rawBody)
    .digest('base64');

  if (contentHash !== expectedContentHash) {
    console.warn('Webhook content hash mismatch');
    return false;
  }

  // 2. Extract signature from Authorization header
  const signatureMatch = authHeader.match(/Signature=([A-Za-z0-9+/=]+)$/);
  if (!signatureMatch) {
    console.warn('Webhook Authorization header missing Signature');
    return false;
  }
  const receivedSignature = signatureMatch[1];

  // 3. Build the signed string
  //    Format: POST\n<path>\n<date>;<host>;<contentHash>
  const url = new URL(req.url || '/api/webhooks/vipps', `https://${host}`);
  const pathAndQuery = url.pathname + url.search;

  const signedString = `POST\n${pathAndQuery}\n${msDate};${host};${contentHash}`;

  // 4. Compute expected HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedString)
    .digest('base64');

  // 5. Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch {
    return false;
  }
}

// ── Event Type Parsing ──

/**
 * Map Vipps webhook eventType to our internal status.
 *
 * Vipps event payloads do NOT contain a `status` field.
 * Instead, the status is encoded in the `eventType` string.
 *
 * Agreement events: recurring.agreement-{status}.v1
 * Charge events:    recurring.charge-{status}.v1
 */
const AGREEMENT_EVENT_MAP = {
  'recurring.agreement-activated.v1': 'ACTIVE',
  'recurring.agreement-rejected.v1': 'STOPPED',
  'recurring.agreement-stopped.v1': 'STOPPED',
  'recurring.agreement-expired.v1': 'EXPIRED',
};

const CHARGE_EVENT_MAP = {
  'recurring.charge-reserved.v1': 'RESERVED',
  'recurring.charge-captured.v1': 'CHARGED',
  'recurring.charge-canceled.v1': 'CANCELLED',
  'recurring.charge-failed.v1': 'FAILED',
  'recurring.charge-refunded.v1': 'REFUNDED',
  'recurring.charge-creation-failed.v1': 'FAILED',
};

// ── Handler ──

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get raw body for HMAC verification.
  // Prefer the actual raw bytes; fall back to re-serialization only in dev.
  let rawBody;
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (req.rawBody) {
    rawBody = typeof req.rawBody === 'string' ? req.rawBody : req.rawBody.toString('utf-8');
  } else {
    rawBody = JSON.stringify(req.body);
  }

  // Verify HMAC signature — required in production
  const webhookSecret = process.env.VIPPS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const isValid = verifyWebhookSignature(req, rawBody, webhookSecret);
    if (!isValid) {
      console.error('Webhook HMAC verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else if (process.env.VERCEL_ENV === 'production') {
    console.error('VIPPS_WEBHOOK_SECRET not set in production — rejecting webhook');
    return res.status(500).json({ error: 'Webhook not configured' });
  } else {
    console.warn('VIPPS_WEBHOOK_SECRET not set — skipping HMAC verification (dev only)');
  }

  // Respond immediately to prevent Vipps timeout
  res.status(200).json({ ok: true });

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!event || !event.eventType) {
      console.warn('Webhook received without eventType:', JSON.stringify(event));
      return;
    }

    console.log('Vipps webhook event:', event.eventType, JSON.stringify(event));

    const db = await getFirestoreDb();
    const eventType = event.eventType;

    // Handle agreement events
    if (AGREEMENT_EVENT_MAP[eventType] && event.agreementId) {
      const status = AGREEMENT_EVENT_MAP[eventType];
      await handleAgreementEvent(db, event, status);
    }

    // Handle charge events
    if (CHARGE_EVENT_MAP[eventType] && event.chargeId) {
      const status = CHARGE_EVENT_MAP[eventType];
      await handleChargeEvent(db, event, status);
    }
  } catch (err) {
    // Log but don't fail — we already sent 200
    console.error('Webhook processing error:', err.message);
  }
}

/**
 * Handle agreement status change.
 *
 * Vipps agreement event payload:
 * {
 *   agreementId: "agr_xxx",
 *   eventType: "recurring.agreement-activated.v1",
 *   occurred: "2026-02-13T10:36:43.4880000Z",
 *   msn: "119145"
 * }
 */
async function handleAgreementEvent(db, event, status) {
  const { agreementId } = event;

  // Update agreement in Firestore
  const agreementRef = db.collection('agreements').doc(agreementId);
  const agreementDoc = await agreementRef.get();

  if (!agreementDoc.exists) {
    console.warn(`Agreement ${agreementId} not found in Firestore`);
    return;
  }

  const agreementData = agreementDoc.data();

  await agreementRef.update({
    status,
    ...(status === 'ACTIVE' ? { startDate: event.occurred || new Date().toISOString() } : {}),
    lastWebhookAt: new Date().toISOString(),
  });

  // Update user subscription status
  if (agreementData.userId) {
    const userRef = db.collection('users').doc(agreementData.userId);
    const statusMap = {
      'ACTIVE': 'active',
      'STOPPED': 'none',
      'EXPIRED': 'none',
      'PENDING': 'pending',
    };

    const newStatus = statusMap[status] || 'none';
    await userRef.update({
      subscriptionStatus: newStatus,
      ...(newStatus === 'none' ? { agreementId: null } : {}),
    });

    console.log(`User ${agreementData.userId} subscription updated to ${newStatus}`);
  }
}

/**
 * Handle charge status change.
 *
 * Vipps charge event payload:
 * {
 *   agreementId: "agr_xxx",
 *   chargeId: "chr_xxx",
 *   amount: 2900,
 *   eventType: "recurring.charge-captured.v1",
 *   occurred: "2026-02-13T06:15:22.1230000Z",
 *   amountCaptured: 2900,
 *   amountRefunded: 0,
 *   msn: "119145"
 * }
 */
async function handleChargeEvent(db, event, status) {
  const { chargeId, agreementId, amount } = event;

  // Update or create charge record
  const chargeRef = db.collection('charges').doc(chargeId);

  await chargeRef.set({
    chargeId,
    agreementId,
    status,
    amount: amount || null,
    amountCaptured: event.amountCaptured || null,
    amountRefunded: event.amountRefunded || null,
    eventType: event.eventType,
    occurred: event.occurred || null,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // If charge captured, update next charge date on agreement
  if (status === 'CHARGED' && agreementId) {
    const agreementRef = db.collection('agreements').doc(agreementId);
    const agreementDoc = await agreementRef.get();
    if (agreementDoc.exists) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      await agreementRef.update({
        nextChargeDate: nextMonth.toISOString(),
        lastChargedAt: new Date().toISOString(),
      });
    }
  }

  console.log(`Charge ${chargeId} status: ${status}`);
}
