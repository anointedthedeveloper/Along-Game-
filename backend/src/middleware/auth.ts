import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, type UserDoc } from '../models';
import { ApiError } from '../utils/ApiError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export async function userFromToken(token: string): Promise<UserDoc> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  if (typeof payload.sub !== 'string') throw ApiError.unauthorized();
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account not found');
  // Tokens issued before the last password change are no longer valid.
  if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw ApiError.unauthorized('Your password changed. Please sign in again.');
  }
  return user;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
    req.user = await userFromToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole =
  (...roles: Array<UserDoc['role']>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient permissions'));
    next();
  };

export const requireMode =
  (mode: UserDoc['mode']) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.mode !== mode) return next(ApiError.forbidden(`This action is only available in ${mode.toLowerCase()} mode`));
    next();
  };

/** Route handlers run after `authenticate`, so the user is always present. */
export const me = (req: Request): UserDoc => {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
};
