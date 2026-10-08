import { Types } from 'mongoose';
import { PlayerProgress, Transaction, User, type TransactionDoc } from '../models';
import type { TransactionType } from '../models/Transaction';
import { ApiError } from '../utils/ApiError';
import { emitToUser } from './socket.service';

/**
 * The only module allowed to change a balance. Every change is an atomic
 * conditional update (no read-modify-write) followed by an immutable ledger
 * entry, so balances can never go negative or be set by a client.
 */

const INCOME: ReadonlySet<TransactionType> = new Set(['RIDE_EARNING', 'REWARD', 'FLEET_INCOME']);
const EXPENSE: ReadonlySet<TransactionType> = new Set([
  'RIDE_PAYMENT', 'FUEL_PURCHASE', 'MAINTENANCE', 'VEHICLE_PURCHASE', 'VEHICLE_UPGRADE', 'FINE',
  'CANCELLATION_FEE', 'DRIVER_WAGE', 'OTHER_EXPENSE', 'TIP',
]);

export interface Balances {
  cash: number;
  bank: number;
}

export interface TxOptions {
  ride?: string | null;
  vehicle?: string | null;
  meta?: unknown;
  account?: 'CASH' | 'BANK';
}

async function record(
  userId: string,
  type: TransactionType,
  amount: number,
  description: string,
  balances: Balances,
  account: 'CASH' | 'BANK',
  opts: TxOptions,
): Promise<TransactionDoc> {
  const tx = await Transaction.create({
    user: userId,
    type,
    amount,
    account,
    cashAfter: balances.cash,
    bankAfter: balances.bank,
    description,
    ride: opts.ride ?? null,
    vehicle: opts.vehicle ?? null,
    meta: opts.meta ?? null,
  });
  emitToUser(userId, 'wallet:update', { cash: balances.cash, bank: balances.bank });
  return tx;
}

async function trackDaily(userId: string, type: TransactionType, amount: number, incoming: boolean): Promise<void> {
  if (incoming ? INCOME.has(type) || type === 'TIP' : false) {
    await PlayerProgress.updateOne({ user: userId }, { $inc: { dailyEarnings: amount, totalEarnings: amount } });
  } else if (!incoming && EXPENSE.has(type) && type !== 'RIDE_PAYMENT') {
    await PlayerProgress.updateOne({ user: userId }, { $inc: { dailyExpenses: amount, totalExpenses: amount } });
  }
}

export async function credit(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  opts: TxOptions = {},
): Promise<Balances> {
  const value = Math.floor(amount);
  if (!(value > 0)) throw ApiError.badRequest('Amount must be a positive number');
  const field = opts.account === 'BANK' ? 'bank' : 'cash';
  const user = await User.findByIdAndUpdate(userId, { $inc: { [field]: value } }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  const balances = { cash: user.cash, bank: user.bank };
  await record(userId, type, value, description, balances, opts.account ?? 'CASH', opts);
  await trackDaily(userId, type, value, true);
  return balances;
}

export async function debit(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  opts: TxOptions = {},
): Promise<Balances> {
  const value = Math.ceil(amount);
  if (!(value > 0)) throw ApiError.badRequest('Amount must be a positive number');
  const field = opts.account === 'BANK' ? 'bank' : 'cash';
  const user = await User.findOneAndUpdate({ _id: userId, [field]: { $gte: value } }, { $inc: { [field]: -value } }, { new: true });
  if (!user) {
    throw ApiError.paymentRequired(
      `You need ₦${value.toLocaleString('en-NG')} in your ${field === 'bank' ? 'bank account' : 'cash'} for this`,
    );
  }
  const balances = { cash: user.cash, bank: user.bank };
  await record(userId, type, -value, description, balances, opts.account ?? 'CASH', opts);
  await trackDaily(userId, type, value, false);
  return balances;
}

/** Pay from the preferred account, falling back to the other one. */
export async function pay(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  preferred: 'CASH' | 'BANK',
  opts: TxOptions = {},
): Promise<Balances & { account: 'CASH' | 'BANK' }> {
  const order: Array<'CASH' | 'BANK'> = preferred === 'CASH' ? ['CASH', 'BANK'] : ['BANK', 'CASH'];
  for (const account of order) {
    try {
      const balances = await debit(userId, amount, type, description, { ...opts, account });
      return { ...balances, account };
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 402) throw err;
    }
  }
  throw ApiError.paymentRequired(`You need ₦${Math.ceil(amount).toLocaleString('en-NG')} to pay for this`);
}

/** Forced expenses (fines, repairs): take what the player has, never go below zero. */
export async function debitUpTo(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  opts: TxOptions = {},
): Promise<{ charged: number; balances: Balances | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = await User.findById(userId).select('cash bank');
    if (!user) throw ApiError.notFound('User not found');
    const available = user.cash;
    const take = Math.min(Math.ceil(amount), available);
    if (take <= 0) return { charged: 0, balances: null };
    try {
      const balances = await debit(userId, take, type, description, { ...opts, account: 'CASH' });
      return { charged: take, balances };
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 402) throw err;
    }
  }
  return { charged: 0, balances: null };
}

async function move(userId: string, amount: number, from: 'cash' | 'bank', to: 'cash' | 'bank'): Promise<Balances> {
  const value = Math.floor(amount);
  if (!(value > 0)) throw ApiError.badRequest('Amount must be a positive number');
  const user = await User.findOneAndUpdate(
    { _id: userId, [from]: { $gte: value } },
    { $inc: { [from]: -value, [to]: value } },
    { new: true },
  );
  if (!user) throw ApiError.paymentRequired(`Not enough ${from === 'bank' ? 'bank balance' : 'cash'}`);
  const balances = { cash: user.cash, bank: user.bank };
  const dep = to === 'bank';
  const type: TransactionType = dep ? 'BANK_DEPOSIT' : 'BANK_WITHDRAWAL';
  await record(userId, type, -value, dep ? 'Deposit to bank (cash out)' : 'Withdrawal from bank (bank out)', balances, dep ? 'CASH' : 'BANK', {});
  await record(userId, type, value, dep ? 'Deposit to bank (bank in)' : 'Withdrawal from bank (cash in)', balances, dep ? 'BANK' : 'CASH', {});
  return balances;
}

export const deposit = (userId: string, amount: number) => move(userId, amount, 'cash', 'bank');
export const withdraw = (userId: string, amount: number) => move(userId, amount, 'bank', 'cash');

export async function getBalances(userId: string): Promise<Balances> {
  const user = await User.findById(userId).select('cash bank');
  if (!user) throw ApiError.notFound('User not found');
  return { cash: user.cash, bank: user.bank };
}

export async function summary(userId: string) {
  const [balances, byType] = await Promise.all([
    getBalances(userId),
    Transaction.aggregate<{ _id: TransactionType; total: number; count: number }>([
      { $match: { user: new Types.ObjectId(userId), type: { $nin: ['BANK_DEPOSIT', 'BANK_WITHDRAWAL'] } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);
  return { ...balances, net: balances.cash + balances.bank, byType: byType.map((r) => ({ type: r._id, total: r.total, count: r.count })) };
}
