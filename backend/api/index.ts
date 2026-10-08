import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import { connectDb } from '../src/config/db';
import { seedLocations } from '../src/services/location.service';

/**
 * Vercel serverless entry. The Express app is reused across invocations and the
 * MongoDB connection is opened once per warm instance. Socket.IO needs a
 * long-lived server, so real-time pushes are unavailable here; the client falls
 * back to polling the REST API.
 */
const app = createApp();
let ready: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= connectDb().then(seedLocations).catch((e) => {
    ready = null;
    throw e;
  });
  try {
    await ready;
  } catch (e) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'DB_UNAVAILABLE', message: 'Database unavailable' } }));
    return;
  }
  app(req as never, res as never);
}
