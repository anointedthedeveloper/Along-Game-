/**
 * Vercel serverless entry (plain CommonJS). The TypeScript API is compiled to ./dist at build time
 * (`npm run build`), so there are no extension-less ESM imports to resolve at runtime.
 * Nothing is loaded at module scope: a missing env var returns a readable JSON error
 * instead of crashing the function. Socket.IO needs a long-lived server, so it is not
 * available here and clients poll the REST API.
 */
let boot = null;

function fail(res, status, code, message) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: { code, message } }));
}

async function start() {
  const missing = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'].filter((k) => !(process.env[k] || '').trim());
  if (missing.length) {
    const e = new Error(`Missing environment variables: ${missing.join(', ')}. Add them in Vercel → Project → Settings → Environment Variables, then redeploy.`);
    e.code = 'CONFIG_MISSING';
    throw e;
  }
  const { createApp } = require('../dist/app');
  const { connectDb } = require('../dist/config/db');
  const { seedLocations } = require('../dist/services/location.service');
  await connectDb();
  await seedLocations();
  return createApp();
}

module.exports = async function handler(req, res) {
  try {
    boot = boot || start();
    const app = await boot;
    app(req, res);
  } catch (err) {
    boot = null;
    console.error('[vercel] startup failed', err);
    fail(res, 503, err.code || 'STARTUP_FAILED', err.message);
  }
};
