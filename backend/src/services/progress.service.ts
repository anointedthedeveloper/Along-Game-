import { PlayerProgress, type ProgressDoc } from '../models';
import { DISTRICTS } from '../data/world';
import { clamp } from '../utils/rng';

export interface LevelDef {
  level: number;
  title: string;
  xp: number;
  /** Minimum average rating required to reach this level. */
  minRating: number;
  maxVehicles: number;
  canHire: boolean;
  perk: string;
}

export const LEVELS: LevelDef[] = [
  { level: 1, title: 'New Driver', xp: 0, minRating: 0, maxVehicles: 1, canHire: false, perk: 'Wuse, Garki, CBD, Area 1 & 2' },
  { level: 2, title: 'Regular Driver', xp: 300, minRating: 3.8, maxVehicles: 2, canHire: false, perk: 'Utako, Jabi, Airport Road · Corolla · second vehicle' },
  { level: 3, title: 'Experienced Driver', xp: 1000, minRating: 4.1, maxVehicles: 3, canHire: false, perk: 'Maitama, Gwarinpa · Camry, minibus · premium passengers' },
  { level: 4, title: 'Professional Driver', xp: 2500, minRating: 4.4, maxVehicles: 5, canHire: true, perk: 'Kubwa, Asokoro · coaster bus · hire drivers' },
  { level: 5, title: 'Transport Boss', xp: 6000, minRating: 4.65, maxVehicles: 12, canHire: true, perk: 'Run a full fleet business · VIP clients' },
];

export const levelDef = (level: number): LevelDef => LEVELS[clamp(level, 1, 5) - 1];

export function computeLevel(xp: number, rating: number): number {
  let level = 1;
  for (const def of LEVELS) {
    if (xp >= def.xp && rating >= def.minRating) level = def.level;
  }
  return level;
}

export const unlockedDistricts = (level: number): string[] => DISTRICTS.filter((d) => d.unlockLevel <= level).map((d) => d.id);

export async function ensureProgress(userId: string): Promise<ProgressDoc> {
  const existing = await PlayerProgress.findOne({ user: userId });
  if (existing) return existing;
  try {
    return await PlayerProgress.create({ user: userId });
  } catch {
    // Created concurrently by another request.
    return (await PlayerProgress.findOne({ user: userId }))!;
  }
}

export interface LevelUp {
  from: number;
  to: number;
  title: string;
}

export async function awardXp(progress: ProgressDoc, xp: number): Promise<LevelUp | null> {
  progress.xp += Math.max(0, Math.round(xp));
  const before = progress.level;
  const next = computeLevel(progress.xp, progress.rating);
  // Never demote; a bad rating only stalls promotion.
  if (next > before) progress.level = next;
  await progress.save();
  return progress.level > before ? { from: before, to: progress.level, title: levelDef(progress.level).title } : null;
}

/** Windowed running average: recent passengers matter more than old ones. */
export function applyRating(progress: ProgressDoc, stars: number): void {
  const n = Math.min(progress.ratingCount + 1, 25);
  progress.rating = Math.round(((progress.rating * (n - 1) + stars) / n) * 100) / 100;
  progress.ratingCount += 1;
}

export interface ReputationBreakdown {
  rating: number;
  completionRate: number;
  punctuality: number;
  cancellationRate: number;
  score: number;
}

export function reputationOf(progress: ProgressDoc): ReputationBreakdown {
  const total = progress.ridesAsDriver + progress.cancellations;
  const completionRate = total ? progress.ridesAsDriver / total : 1;
  const punctuality = progress.ridesAsDriver ? 1 - progress.lateArrivals / progress.ridesAsDriver : 1;
  const cancellationRate = total ? progress.cancellations / total : 0;
  const score = Math.round(
    clamp((progress.rating / 5) * 60 + completionRate * 20 + punctuality * 20, 0, 100),
  );
  return { rating: progress.rating, completionRate, punctuality, cancellationRate, score };
}

export function serializeProgress(progress: ProgressDoc) {
  const def = levelDef(progress.level);
  const next = progress.level < 5 ? LEVELS[progress.level] : null;
  return {
    xp: progress.xp,
    level: progress.level,
    title: def.title,
    perk: def.perk,
    maxVehicles: def.maxVehicles,
    canHire: def.canHire,
    nextLevel: next ? { level: next.level, title: next.title, xp: next.xp, minRating: next.minRating, perk: next.perk } : null,
    xpIntoLevel: progress.xp - def.xp,
    xpForNext: next ? next.xp - def.xp : 0,
    rating: progress.rating,
    ratingCount: progress.ratingCount,
    ridesAsDriver: progress.ridesAsDriver,
    ridesAsPassenger: progress.ridesAsPassenger,
    cancellations: progress.cancellations,
    lateArrivals: progress.lateArrivals,
    totalEarnings: progress.totalEarnings,
    totalExpenses: progress.totalExpenses,
    totalDistanceKm: Math.round(progress.totalDistanceKm * 10) / 10,
    unlockedDistricts: unlockedDistricts(progress.level),
    reputation: reputationOf(progress),
    day: {
      active: progress.dayActive,
      number: progress.dayNumber,
      startedAt: progress.dayStartedAt,
      earnings: progress.dailyEarnings,
      expenses: progress.dailyExpenses,
      rides: progress.dailyRides,
    },
    dayHistory: progress.dayHistory.slice(-7),
  };
}
