import type { VehicleSpec } from '../data/vehicles';
import { roundNaira } from '../utils/money';
import type { WorldSnapshot } from './world.service';

export type Tier = 'STANDARD' | 'PREMIUM' | 'VIP';

const BASE_FARE = 400;
const PER_KM = 160;
const PER_MIN = 20;
const MIN_FARE = 500;
const TIER_MULTIPLIER: Record<Tier, number> = { STANDARD: 1, PREMIUM: 1.25, VIP: 1.7 };

export interface FareQuote {
  /** Fare for the whole party. */
  total: number;
  /** Fare per person before group scaling. */
  perPerson: number;
  surge: number;
  nightFactor: number;
  weatherFactor: number;
}

/**
 * The single authoritative fare formula. Both the passenger price list and the
 * driver ride offers are computed here — clients can never set a fare.
 */
export function quoteFare(opts: {
  distanceKm: number;
  durationMin: number;
  spec: VehicleSpec;
  world: WorldSnapshot;
  tier?: Tier;
  groupSize?: number;
}): FareQuote {
  const { distanceKm, durationMin, spec, world, tier = 'STANDARD', groupSize = 1 } = opts;
  const raw = BASE_FARE + PER_KM * distanceKm + PER_MIN * durationMin;
  const hour = world.clock.hour;
  const nightFactor = hour >= 21 || hour < 5 ? 1.2 : 1;
  const surge = world.surge;
  const weatherFactor = world.weather.fareFactor;
  const perPerson = Math.max(MIN_FARE, roundNaira(raw * spec.fareMultiplier * surge * nightFactor * weatherFactor * TIER_MULTIPLIER[tier], 50));
  return { total: perPerson * groupSize, perPerson, surge, nightFactor, weatherFactor };
}

/** Pricing after events: recompute the final fare from its parts. */
export function finalFare(base: number, multiplier: number, adjustment: number): number {
  return Math.max(0, roundNaira(base * multiplier, 10) + Math.round(adjustment));
}

export const CANCELLATION_FEE_MAX = 500;
