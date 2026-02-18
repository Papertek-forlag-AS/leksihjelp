/**
 * Local development server for Leksihjelp backend
 * Wraps Vercel serverless functions for local testing
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.warn('No .env file found');
}

// Import handlers
import ttsHandler from './api/tts.js';
import verifyHandler from './api/verify.js';
import vippsLoginHandler from './api/auth/vipps-login.js';
import exchangeCodeHandler from './api/auth/exchange-code.js';
import vippsCallbackHandler from './api/auth/vipps-callback.js';
import sessionHandler from './api/auth/session.js';
import subscribeHandler from './api/auth/subscribe.js';
import subscribeCallbackHandler from './api/auth/subscribe-callback.js';
import webhookVippsHandler from './api/webhooks/vipps.js';
import webhookStripeHandler from './api/webhooks/stripe.js';
import cronChargesHandler from './api/cron/create-charges.js';
import cronStripeExpiryHandler from './api/cron/check-stripe-expiry.js';
import createCheckoutHandler from './api/auth/create-checkout.js';

const PORT = 3000;

// Routes that need raw body (for signature verification)
const RAW_BODY_ROUTES = new Set(['/api/webhooks/stripe', '/api/webhooks/vipps']);

const server = createServer(async (req, res) => {
  // Parse URL and query params
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Read body as raw chunks
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);

  // For webhook routes, make the request a readable stream so the handler can re-read the raw body
  const needsRawBody = RAW_BODY_ROUTES.has(url.pathname);
  let body;
  if (needsRawBody) {
    body = undefined; // Handler reads from the stream/iterator
  } else {
    const bodyStr = rawBody.toString('utf-8');
    body = bodyStr ? (() => { try { return JSON.parse(bodyStr); } catch { return {}; } })() : {};
  }

  // Create mock Vercel req/res objects
  const mockReq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: Object.fromEntries(url.searchParams),
    body,
  };

  // For webhook routes, make mockReq iterable so `for await (const chunk of req)` works
  if (needsRawBody) {
    mockReq[Symbol.asyncIterator] = async function* () {
      yield rawBody;
    };
  }

  const mockRes = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
      res.setHeader(key, value);
    },
    writeHead(code, headers) {
      res.writeHead(code, headers);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    },
    send(data) {
      res.writeHead(this.statusCode, this.headers);
      res.end(data);
    },
    end() {
      res.writeHead(this.statusCode);
      res.end();
    }
  };

  // Route requests
  const routes = {
    '/api/tts': ttsHandler,
    '/api/verify': verifyHandler,
    '/api/auth/vipps-login': vippsLoginHandler,
    '/api/auth/exchange-code': exchangeCodeHandler,
    '/api/auth/vipps-callback': vippsCallbackHandler,
    '/api/auth/session': sessionHandler,
    '/api/auth/subscribe': subscribeHandler,
    '/api/auth/subscribe-callback': subscribeCallbackHandler,
    '/api/webhooks/vipps': webhookVippsHandler,
    '/api/webhooks/stripe': webhookStripeHandler,
    '/api/cron/create-charges': cronChargesHandler,
    '/api/cron/check-stripe-expiry': cronStripeExpiryHandler,
    '/api/auth/create-checkout': createCheckoutHandler,
  };

  const handler = routes[url.pathname];
  if (handler) {
    try {
      await handler(mockReq, mockRes);
    } catch (err) {
      console.error(`Error in ${url.pathname}:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  Leksihjelp backend running at http://localhost:${PORT}`);
  console.log(`\n  Routes:`);
  console.log(`   - POST /api/verify`);
  console.log(`   - POST /api/tts`);
  console.log(`   - GET  /api/auth/vipps-login`);
  console.log(`   - POST /api/auth/exchange-code`);
  console.log(`   - GET  /api/auth/vipps-callback`);
  console.log(`   - POST /api/auth/session`);
  console.log(`   - POST /api/auth/subscribe`);
  console.log(`   - GET  /api/auth/subscribe-callback`);
  console.log(`   - POST /api/auth/create-checkout`);
  console.log(`   - POST /api/webhooks/vipps`);
  console.log(`   - POST /api/webhooks/stripe`);
  console.log(`   - GET  /api/cron/create-charges`);
  console.log(`   - GET  /api/cron/check-stripe-expiry`);
  console.log(`\n  Config:`);
  console.log(`   ElevenLabs API Key:  ${process.env.ELEVENLABS_API_KEY ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   Access Code:         ${process.env.ACCESS_CODE ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   Session JWT Secret:  ${process.env.SESSION_JWT_SECRET ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   Vipps Client ID:     ${process.env.VIPPS_CLIENT_ID ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   Firebase Project ID: ${process.env.FIREBASE_PROJECT_ID ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   Stripe Secret Key:  ${process.env.STRIPE_SECRET_KEY ? '✓ loaded' : '✗ MISSING'}\n`);
});
