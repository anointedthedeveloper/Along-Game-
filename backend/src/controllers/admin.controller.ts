import type { Request, Response } from 'express';
import { PlayerProgress, Ride, Transaction, User, Vehicle } from '../models';

/** Operational overview for administrators (role-protected in the router). */
export const overview = async (_req: Request, res: Response) => {
  const [users, vehicles, rides, completed, volume, topLevel] = await Promise.all([
    User.countDocuments(),
    Vehicle.countDocuments(),
    Ride.countDocuments({ matchedAt: { $ne: null } }),
    Ride.countDocuments({ status: 'COMPLETED' }),
    Transaction.aggregate<{ _id: null; total: number }>([{ $match: { amount: { $gt: 0 }, type: { $nin: ['BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'STARTER_GRANT'] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    PlayerProgress.findOne().sort({ level: -1, xp: -1 }).select('level xp'),
  ]);
  res.json({ users, vehicles, rides, completedRides: completed, naira: { circulatedIncome: volume[0]?.total ?? 0 }, topLevel: topLevel?.level ?? 1 });
};
