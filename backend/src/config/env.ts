import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function resolveSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (isProd) {
    throw new Error('JWT_SECRET must be set in production');
  }
  // Development convenience only: an ephemeral secret invalidates sessions on restart.
  console.warn('[env] JWT_SECRET not set — using an ephemeral development secret');
  return crypto.randomBytes(48).toString('hex');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd,
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017/along',
  useMemoryDb: process.env.USE_MEMORY_DB === 'true',
  jwtSecret: resolveSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientUrls: (process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  /** Game minutes that pass per real-time second. 1 => a full game day lasts 24 real minutes. */
  /** Comma-separated emails that are granted the ADMIN role when they register. */
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  gameSpeed: Number(process.env.GAME_SPEED ?? 1),
} as const;
