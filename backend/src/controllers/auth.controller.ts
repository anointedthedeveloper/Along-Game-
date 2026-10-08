import type { Request, Response } from 'express';
import * as auth from '../services/auth.service';
import { me } from '../middleware/auth';

export const register = async (req: Request, res: Response) => {
  res.status(201).json(await auth.register(req.body));
};
export const login = async (req: Request, res: Response) => {
  res.json(await auth.login(req.body));
};
export const logout = async (_req: Request, res: Response) => {
  // JWTs are stateless; the client discards its token. Endpoint exists so the session lifecycle is explicit.
  res.json({ ok: true });
};
export const forgotPassword = async (req: Request, res: Response) => {
  const result = await auth.forgotPassword(req.body.email);
  res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.', ...result });
};
export const resetPassword = async (req: Request, res: Response) => {
  await auth.resetPassword(req.body.token, req.body.password);
  res.json({ ok: true });
};
export const session = async (req: Request, res: Response) => {
  res.json({ user: auth.publicUser(me(req)) });
};
