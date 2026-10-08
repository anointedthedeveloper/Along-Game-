import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Vercel serverless entry. Nothing from ../src is imported at module load, so a
 * missing environment variable produces a readable JSON error instead of a
 * crashed function (FUNCTION_INVOCATION_FAILED). The Express app and the
 * MongoDB connection are created once per warm instance. Socket.IO needs a
 * long-lived server, so real-time pushes are unavailable here; the client polls.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let boot: Promise<Handler> | null = null;

function fail(res: ServerResponse, status: number, code: string, message: string, details?: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: { code, message, details } }));
}

async function start(): Promise<Handler> {
  const missing = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'].filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw Object.assign(new Error(`Missing environment variables: ${missing.join(', ')}. Add them in Vercel → Project → Settings → Environment Variables, then redeploy.`), { code: 'CONFIG_MISSING' });
  }
  const { createApp } = await import('../src/app');
  const { connectDb } = await import('../src/config/db');
  const { seedLocations } = await import('../src/services/location.service');
  await connectDb();
  await seedLocations();
  const app = createApp();
  return app as unknown as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    boot ??= start();
    const app = await boot;
    app(req, res);
  } catch (e) {
    boot = null;
    const err = e as Error & { code?: string };
    console.error('[vercel] startup failed', err);
    fail(res, 503, err.code ?? 'STARTUP_FAILED', err.message);
  }
}
