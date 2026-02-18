#!/usr/bin/env node

/**
 * Stripe Sandbox Test Script
 *
 * Tests the full Stripe payment flow locally:
 * 1. Seeds a test user in Firestore
 * 2. Mints a session JWT for that user
 * 3. Calls POST /api/auth/create-checkout to get a Stripe Checkout URL
 * 4. Opens the checkout page in your browser
 *
 * After you complete the test payment (card: 4242 4242 4242 4242),
 * the Stripe CLI will forward the webhook to your local server,
 * and the test user's Firestore document should be updated.
 *
 * Prerequisites:
 *   - backend/.env is configured (SESSION_JWT_SECRET, STRIPE_SECRET_KEY, Firebase vars)
 *   - local-server.js is running: node local-server.js
 *   - Stripe CLI is forwarding: stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
 *
 * Usage:
 *   node test-stripe.js [step]
 *
 * Steps:
 *   setup    — Seed test user + mint JWT + create checkout (default)
 *   check    — Check the test user's Firestore document after payment
 *   cleanup  — Delete the test user from Firestore
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.error('Could not read .env file:', e.message);
  process.exit(1);
}

import { createSessionToken } from './api/_jwt.js';
import { getFirestoreDb } from './api/_firebase.js';

const TEST_USER_ID = 'stripe-test-user';
const LOCAL_SERVER = 'http://localhost:3000';

const step = process.argv[2] || 'setup';

async function seedTestUser() {
  console.log('\n1. Seeding test user in Firestore...');
  const db = await getFirestoreDb();
  const userRef = db.collection('users').doc(TEST_USER_ID);

  await userRef.set({
    name: 'Test Bruker',
    email: 'test@leksihjelp.no',
    phone: '4700000000',
    subscriptionStatus: 'none',
    lastLogin: new Date().toISOString(),
  }, { merge: true });

  console.log(`   Created/updated user "${TEST_USER_ID}" in Firestore`);
  return userRef;
}

function mintTestToken() {
  console.log('\n2. Minting session JWT...');
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    console.error('   ERROR: SESSION_JWT_SECRET not set in .env');
    process.exit(1);
  }

  const token = createSessionToken(
    { sub: TEST_USER_ID, email: 'test@leksihjelp.no', name: 'Test Bruker' },
    secret,
    3600, // 1 hour expiry for testing
  );

  console.log(`   Token minted (expires in 1 hour)`);
  console.log(`   JWT: ${token.substring(0, 50)}...`);
  return token;
}

async function createCheckout(token) {
  console.log('\n3. Creating Stripe Checkout session...');

  const res = await fetch(`${LOCAL_SERVER}/api/auth/create-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`   ERROR: ${res.status} — ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`   Checkout URL: ${data.checkoutUrl}`);
  return data.checkoutUrl;
}

async function openInBrowser(url) {
  console.log('\n4. Opening Stripe Checkout in browser...');
  const { exec } = await import('child_process');
  exec(`open "${url}"`);
  console.log('   Opened! Use test card: 4242 4242 4242 4242');
  console.log('   Any future expiry date, any CVC, any name/zip\n');
}

async function checkUser() {
  console.log('\nChecking test user in Firestore...');
  const db = await getFirestoreDb();
  const userRef = db.collection('users').doc(TEST_USER_ID);
  const doc = await userRef.get();

  if (!doc.exists) {
    console.log('   User not found. Run "node test-stripe.js setup" first.');
    return;
  }

  const data = doc.data();
  console.log('\n   User document:');
  console.log(`   name:               ${data.name}`);
  console.log(`   email:              ${data.email}`);
  console.log(`   subscriptionStatus: ${data.subscriptionStatus}`);
  console.log(`   subscriptionType:   ${data.subscriptionType || '(not set)'}`);
  console.log(`   stripeSessionId:    ${data.stripeSessionId || '(not set)'}`);
  console.log(`   stripeExpiresAt:    ${data.stripeExpiresAt || '(not set)'}`);
  console.log(`   stripePaidAt:       ${data.stripePaidAt || '(not set)'}`);
  console.log(`   quotaBalance:       ${data.quotaBalance ?? '(not set)'}`);
  console.log(`   quotaLastTopUp:     ${data.quotaLastTopUp || '(not set)'}`);
  console.log(`   quotaMonthlyAllowance: ${data.quotaMonthlyAllowance ?? '(not set)'}`);
  console.log(`   quotaMaxBalance:    ${data.quotaMaxBalance ?? '(not set)'}`);

  if (data.subscriptionStatus === 'active' && data.subscriptionType === 'stripe_yearly') {
    console.log('\n   PASS: Stripe yearly subscription is active!');
    const expires = new Date(data.stripeExpiresAt);
    const daysLeft = Math.round((expires - new Date()) / (1000 * 60 * 60 * 24));
    console.log(`   Expires in ${daysLeft} days (${expires.toLocaleDateString('nb-NO')})`);
  } else if (data.subscriptionStatus === 'none') {
    console.log('\n   Subscription not yet activated.');
    console.log('   Complete the Stripe payment, then run this check again.');
  }
  console.log('');
}

async function cleanup() {
  console.log('\nDeleting test user from Firestore...');
  const db = await getFirestoreDb();
  await db.collection('users').doc(TEST_USER_ID).delete();
  console.log(`   Deleted "${TEST_USER_ID}"\n`);
}

// ── Main ──

try {
  switch (step) {
    case 'setup': {
      await seedTestUser();
      const token = mintTestToken();
      const url = await createCheckout(token);
      await openInBrowser(url);

      console.log('─────────────────────────────────────────');
      console.log('After completing payment, run:');
      console.log('  node test-stripe.js check');
      console.log('');
      console.log('To clean up the test user:');
      console.log('  node test-stripe.js cleanup');
      console.log('─────────────────────────────────────────\n');
      break;
    }
    case 'check':
      await checkUser();
      break;
    case 'cleanup':
      await cleanup();
      break;
    default:
      console.error(`Unknown step: ${step}`);
      console.error('Usage: node test-stripe.js [setup|check|cleanup]');
      process.exit(1);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}

process.exit(0);
