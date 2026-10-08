import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { START_LOCATION_KEY } from '../data/world';
import { User, type UserDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { createStarterVehicle } from './vehicle.service';
import { ensureProgress } from './progress.service';
import { credit } from './wallet.service';
import { notify } from './notification.service';

const SALT_ROUNDS = 12;
export const STARTER_CASH = 25_000;
const RESET_TTL_MS = 30 * 60 * 1000;

export const signToken = (user: UserDoc): string =>
  jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });

export function publicUser(user: UserDoc) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    mode: user.mode,
    cash: user.cash,
    bank: user.bank,
    locationKey: user.locationKey,
    avatarSeed: user.avatarSeed,
    createdAt: user.createdAt,
  };
}

export async function register(input: { name: string; email: string; password: string; mode: 'DRIVER' | 'PASSENGER' }) {
  const exists = await User.exists({ email: input.email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({ name: input.name, email: input.email, passwordHash, mode: input.mode, locationKey: START_LOCATION_KEY, passwordChangedAt: new Date(0) });
  await ensureProgress(String(user._id));
  await createStarterVehicle(user);
  await credit(String(user._id), STARTER_CASH, 'STARTER_GRANT', 'Welcome to ALONG — starter cash');
  await notify(String(user._id), 'WELCOME', 'Welcome to ALONG', input.mode === 'DRIVER' ? 'Check your car, buy fuel, then start your day.' : 'Pick where you are, choose a destination and request a ride.');
  const fresh = (await User.findById(user._id))!;
  return { token: signToken(fresh), user: publicUser(fresh) };
}

export async function login(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  // Compare against a dummy hash when the user is unknown so timing does not leak which emails exist.
  const hash = user?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5gF4pWqHq1xqk2l8Z7h6dQ1x0b3a8Ky';
  const ok = await bcrypt.compare(input.password, hash);
  if (!user || !ok) throw ApiError.unauthorized('Incorrect email or password');
  user.lastLoginAt = new Date();
  await user.save();
  return { token: signToken(user), user: publicUser(user) };
}

/**
 * Starts the password-reset flow. A real deployment plugs an email provider in
 * `deliverResetToken`; in development the token is returned so the flow can be tested.
 */
export async function forgotPassword(email: string): Promise<{ devToken?: string }> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return {};
  const token = crypto.randomBytes(32).toString('hex');
  user.passwordReset = { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + RESET_TTL_MS) };
  await user.save();
  await deliverResetToken(user.email, token);
  return env.isProd ? {} : { devToken: token };
}

async function deliverResetToken(email: string, token: string): Promise<void> {
  // Integration point for an email provider (SES, Resend, SendGrid…).
  if (!env.isProd) console.log(`[auth] password reset for ${email}: ${env.clientUrls[0]}/reset-password?token=${token}`);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ 'passwordReset.tokenHash': tokenHash, 'passwordReset.expiresAt': { $gt: new Date() } }).select('+passwordReset.tokenHash +passwordReset.expiresAt');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  user.passwordReset = undefined;
  await user.save();
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  if (!(await bcrypt.compare(current, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(next, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  await user.save();
  return { token: signToken(user) };
}
