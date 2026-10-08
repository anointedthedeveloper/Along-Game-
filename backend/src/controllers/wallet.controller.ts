import type { Request, Response } from 'express';
import { Transaction } from '../models';
import { me } from '../middleware/auth';
import * as wallet from '../services/wallet.service';

export const get = async (req: Request, res: Response) => res.json(await wallet.summary(String(me(req)._id)));
export const deposit = async (req: Request, res: Response) => res.json(await wallet.deposit(String(me(req)._id), req.body.amount));
export const withdraw = async (req: Request, res: Response) => res.json(await wallet.withdraw(String(me(req)._id), req.body.amount));

export const transactions = async (req: Request, res: Response) => {
  const q = req.query as unknown as { type?: string; limit: number; skip: number };
  const filter: Record<string, unknown> = { user: me(req)._id };
  if (q.type) filter.type = q.type;
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(q.skip).limit(q.limit),
    Transaction.countDocuments(filter),
  ]);
  res.json({
    total,
    transactions: items.map((t) => ({
      id: String(t._id), type: t.type, amount: t.amount, account: t.account, cashAfter: t.cashAfter, bankAfter: t.bankAfter,
      description: t.description, ride: t.ride ? String(t.ride) : null, createdAt: t.createdAt,
    })),
  });
};
