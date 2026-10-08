import type { Request, Response } from 'express';
import { Notification, Rating, Ride } from '../models';
import { me } from '../middleware/auth';
import * as auth from '../services/auth.service';
import { ensureProgress, serializeProgress } from '../services/progress.service';
import { ApiError } from '../utils/ApiError';

export const getMe = async (req: Request, res: Response) => {
  const user = me(req);
  const progress = await ensureProgress(String(user._id));
  res.json({ user: auth.publicUser(user), progress: serializeProgress(progress) });
};

export const updateMe = async (req: Request, res: Response) => {
  const user = me(req);
  const { name, mode } = req.body as { name?: string; mode?: 'DRIVER' | 'PASSENGER' };
  if (mode && mode !== user.mode) {
    const busy = await Ride.exists({ $or: [{ driver: user._id }, { passenger: user._id }], status: { $in: ['MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] } });
    if (busy) throw ApiError.conflict('Finish your current ride before switching mode', 'RIDE_ACTIVE');
    const progress = await ensureProgress(String(user._id));
    if (progress.dayActive) throw ApiError.conflict('End your work day before switching to passenger mode', 'DAY_ACTIVE');
    user.mode = mode;
  }
  if (name) user.name = name;
  await user.save();
  res.json({ user: auth.publicUser(user) });
};

export const changePassword = async (req: Request, res: Response) => {
  res.json(await auth.changePassword(String(me(req)._id), req.body.currentPassword, req.body.newPassword));
};

export const notifications = async (req: Request, res: Response) => {
  const items = await Notification.find({ user: me(req)._id }).sort({ createdAt: -1 }).limit(30);
  const unread = await Notification.countDocuments({ user: me(req)._id, read: false });
  res.json({
    unread,
    notifications: items.map((n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, read: n.read, data: n.data, createdAt: n.createdAt })),
  });
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  await Notification.updateMany({ user: me(req)._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
};

export const myRatings = async (req: Request, res: Response) => {
  const ratings = await Rating.find({ toUser: me(req)._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ ratings: ratings.map((r) => ({ id: String(r._id), stars: r.stars, comment: r.comment, tags: r.tags, factors: r.factors, createdAt: r.createdAt })) });
};
