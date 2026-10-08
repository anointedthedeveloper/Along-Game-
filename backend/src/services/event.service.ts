import { EVENT_CATALOG, eventDef, type Effects, type EventContext, type Role } from '../data/events';
import { districtById, locationByKey } from '../data/world';
import { vehicleSpec } from '../data/vehicles';
import { GameEvent, Ride, User, Vehicle, type GameEventDoc, type RideDoc, type UserDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { clamp, rand, weightedPick } from '../utils/rng';
import { finalFare } from './fare.service';
import { ensureProgress, awardXp } from './progress.service';
import { derivedStats } from './vehicle.service';
import { credit, debitUpTo, pay } from './wallet.service';
import { getWorld } from './world.service';
import { emitToUser } from './socket.service';

export function serializeEvent(e: GameEventDoc) {
  return {
    id: String(e._id),
    ride: e.ride ? String(e.ride) : null,
    role: e.role,
    type: e.type,
    category: e.category,
    title: e.title,
    description: e.description,
    severity: e.severity,
    options: e.options.map((o) => ({ id: o.id, label: o.label, hint: o.hint })),
    triggerAt: e.triggerAt,
    status: e.status,
    choice: e.choice ?? null,
    outcome: e.outcome?.message ? { message: e.outcome.message, effects: e.outcome.effects } : null,
    createdAt: e.createdAt,
    resolvedAt: e.resolvedAt ?? null,
  };
}

async function contextFor(ride: RideDoc, role: Role): Promise<EventContext> {
  const world = getWorld();
  const district = districtById(ride.origin.district ?? '');
  const destDistrict = districtById(ride.destination.district ?? '');
  const risk = Math.max(district?.risk ?? 0.1, destDistrict?.risk ?? 0.1);
  let condition = 70;
  let fuelFraction = 0.6;
  let tyres = 0;
  let reliability = 6;
  let vehicleName = ride.npcDriver?.vehicleName ?? 'vehicle';
  if (role === 'DRIVER' && ride.vehicle) {
    const vehicle = await Vehicle.findById(ride.vehicle);
    if (vehicle) {
      const spec = vehicleSpec(vehicle.specId)!;
      const stats = derivedStats(vehicle, spec);
      condition = vehicle.condition;
      fuelFraction = vehicle.fuel / stats.tankLiters;
      tyres = vehicle.upgrades.tyres;
      reliability = stats.reliability;
      vehicleName = spec.name;
    }
  } else {
    condition = 60 + Math.random() * 35;
  }
  const progress = ride.driver ? await ensureProgress(String(ride.driver)) : null;
  const hour = world.clock.hour;
  return {
    role,
    weather: world.weather.kind,
    hour,
    traffic: world.traffic,
    condition,
    fuelFraction,
    tyreLevel: tyres,
    reliability,
    vehicleName,
    rating: progress?.rating ?? 4.5,
    districtRisk: risk,
    originName: ride.origin.name ?? '',
    destinationName: ride.destination.name ?? '',
    groupSize: ride.npcPassenger?.groupSize ?? 1,
    tier: (ride.npcPassenger?.tier as EventContext['tier']) ?? 'STANDARD',
    baseFare: ride.fare.base,
    isNight: hour >= 20 || hour < 5,
    raining: world.weather.kind === 'RAIN' || world.weather.kind === 'HEAVY_RAIN',
  };
}

/** Roll the random events a trip will encounter. Called once, when the ride starts. */
export async function rollEventsForRide(ride: RideDoc, role: Role): Promise<GameEventDoc[]> {
  if (ride.eventsRolled) return GameEvent.find({ ride: ride._id });
  ride.eventsRolled = true;
  await ride.save();
  const userId = role === 'DRIVER' ? ride.driver : ride.passenger;
  if (!userId) return [];
  const ctx = await contextFor(ride, role);
  const chance = clamp(0.5 + (ctx.raining ? 0.15 : 0) + ctx.traffic * 0.15 + (ctx.isNight ? 0.05 : 0), 0.3, 0.85);
  const created: GameEventDoc[] = [];
  const rolls = [Math.random() < chance, Math.random() < chance * 0.25];
  const taken = new Set<string>();
  for (let i = 0; i < rolls.length; i++) {
    if (!rolls[i]) continue;
    const pool = EVENT_CATALOG.filter((e) => e.roles.includes(role) && !taken.has(e.type));
    const def = weightedPick(pool, (e) => e.weight(ctx));
    if (!def) continue;
    taken.add(def.type);
    const doc = await GameEvent.create({
      user: userId,
      ride: ride._id,
      role,
      type: def.type,
      category: def.category,
      title: def.title,
      description: def.describe(ctx),
      severity: def.severity,
      options: def.options(ctx).map((o) => ({ id: o.id, label: o.label, hint: o.hint })),
      triggerAt: i === 0 ? rand(0.25, 0.65) : rand(0.72, 0.88),
    });
    created.push(doc);
  }
  return created;
}

const rangeRoll = (v: number | [number, number]): number => (Array.isArray(v) ? Math.round(rand(v[0], v[1])) : v);

export interface AppliedEffects {
  delayMin: number;
  cash: number;
  fuel: number;
  condition: number;
  fareChange: number;
  ratingMod: number;
  cancelled: boolean;
  xp: number;
  lostCash: number;
  levelUp: { from: number; to: number; title: string } | null;
}

export async function resolveEvent(user: UserDoc, eventId: string, optionId: string) {
  const event = await GameEvent.findOne({ _id: eventId, user: user._id });
  if (!event) throw ApiError.notFound('Event not found');
  if (event.status !== 'PENDING') throw ApiError.conflict('This event has already been handled', 'EVENT_RESOLVED');
  const ride = event.ride ? await Ride.findById(event.ride) : null;
  if (!ride || ride.status !== 'IN_PROGRESS') {
    event.status = 'EXPIRED';
    await event.save();
    throw ApiError.conflict('This event is no longer relevant', 'EVENT_EXPIRED');
  }
  const def = eventDef(event.type);
  if (!def) throw ApiError.conflict('Unknown event', 'UNKNOWN_EVENT');
  const ctx = await contextFor(ride, event.role);
  const option = def.options(ctx).find((o) => o.id === optionId);
  if (!option || !event.options.some((o) => o.id === optionId)) throw ApiError.badRequest('That is not a valid option for this event');
  const outcome = weightedPick(option.outcomes, (o) => o.weight) ?? option.outcomes[0];
  const applied = await applyEffects(user, ride, event.role, outcome.effects);

  event.status = 'RESOLVED';
  event.choice = optionId;
  event.outcome = { message: outcome.message, effects: applied };
  event.resolvedAt = new Date();
  await event.save();
  ride.eventNotes.push(`${def.title}: ${option.label}`);
  await ride.save();
  emitToUser(String(user._id), 'event:resolved', { event: serializeEvent(event), rideId: String(ride._id) });
  return { event: serializeEvent(event), applied, ride };
}

async function applyEffects(user: UserDoc, ride: RideDoc, role: Role, fx: Effects): Promise<AppliedEffects> {
  const userId = String(user._id);
  const applied: AppliedEffects = { delayMin: 0, cash: 0, fuel: 0, condition: 0, fareChange: 0, ratingMod: 0, cancelled: false, xp: 0, lostCash: 0, levelUp: null };

  if (fx.delayMin) {
    applied.delayMin = rangeRoll(fx.delayMin);
    ride.delayMin += applied.delayMin;
  }

  const beforeFare = ride.fare.final;
  if (fx.fareMultiplier) ride.fare.multiplier = Math.round(ride.fare.multiplier * fx.fareMultiplier * 100) / 100;
  let adjustment = ride.fare.adjustment;
  if (fx.fareDeltaPct) adjustment += (ride.fare.base * fx.fareDeltaPct) / 100;
  if (fx.fareDelta) adjustment += role === 'DRIVER' ? fx.fareDelta : fx.fareDelta; // passenger pays more / driver earns more
  ride.fare.adjustment = Math.round(adjustment);
  ride.fare.final = finalFare(ride.fare.base, ride.fare.multiplier, ride.fare.adjustment);
  applied.fareChange = ride.fare.final - beforeFare;

  if (fx.ratingMod) {
    ride.ratingMod += fx.ratingMod;
    applied.ratingMod = fx.ratingMod;
  }

  if (role === 'DRIVER' && ride.vehicle && (fx.fuel || fx.condition || fx.cleanliness)) {
    const vehicle = await Vehicle.findById(ride.vehicle);
    if (vehicle) {
      const spec = vehicleSpec(vehicle.specId)!;
      if (fx.fuel) {
        vehicle.fuel = clamp(vehicle.fuel + fx.fuel, 0, spec.tankLiters);
        applied.fuel = fx.fuel;
      }
      if (fx.condition) {
        vehicle.condition = clamp(vehicle.condition + fx.condition, 0, 100);
        applied.condition = fx.condition;
      }
      if (fx.cleanliness) vehicle.cleanliness = clamp(vehicle.cleanliness + fx.cleanliness, 0, 100);
      await vehicle.save();
    }
  }

  if (fx.cash) {
    const meta = { event: true };
    if (fx.cash > 0) {
      await credit(userId, fx.cash, fx.cashType ?? 'REWARD', 'Trip bonus', { ride: String(ride._id), meta });
      applied.cash = fx.cash;
    } else {
      const { charged } = await debitUpTo(userId, -fx.cash, fx.cashType ?? 'OTHER_EXPENSE', 'Road expense', { ride: String(ride._id), meta });
      applied.cash = -charged;
    }
  }

  if (fx.lostCashPct) {
    const fresh = await User.findById(userId).select('cash');
    const loss = Math.min(Math.floor(((fresh?.cash ?? 0) * fx.lostCashPct) / 100), fx.lostCashCap ?? Infinity);
    if (loss > 0) {
      const { charged } = await debitUpTo(userId, loss, 'OTHER_EXPENSE', 'Lost to theft on the road', { ride: String(ride._id) });
      applied.lostCash = charged;
    }
  }

  if (fx.xp) {
    applied.xp = fx.xp;
    const progress = await ensureProgress(userId);
    applied.levelUp = await awardXp(progress, fx.xp);
  }

  if (fx.cancelRide) {
    applied.cancelled = true;
    await endRideEarly(ride, role, fx.partialFarePct ?? 0, user);
  }
  await ride.save();
  return applied;
}

async function endRideEarly(ride: RideDoc, role: Role, partialPct: number, user: UserDoc): Promise<void> {
  const amount = Math.round((ride.fare.final * partialPct) / 100 / 10) * 10;
  const userId = String(user._id);
  if (amount > 0) {
    if (role === 'DRIVER') {
      await credit(userId, amount, 'RIDE_EARNING', `Part-fare: ${ride.origin.name} → ${ride.destination.name}`, { ride: String(ride._id) });
    } else {
      await pay(userId, amount, 'RIDE_PAYMENT', `Part-fare: ${ride.origin.name} → ${ride.destination.name}`, ride.paymentMethod, { ride: String(ride._id) });
    }
  }
  ride.fare.final = amount;
  ride.paid = true;
  ride.status = 'CANCELLED';
  ride.cancelledBy = 'EVENT';
  ride.cancelReason = 'Ended early during the trip';
  ride.cancelledAt = new Date();
  ride.history.push({ status: 'CANCELLED', at: new Date() });
  await GameEvent.updateMany({ ride: ride._id, status: 'PENDING' }, { status: 'EXPIRED' });
}

export async function listEvents(user: UserDoc, filter: { status?: string; ride?: string; limit?: number }) {
  const query: Record<string, unknown> = { user: user._id };
  if (filter.status) query.status = filter.status;
  if (filter.ride) query.ride = filter.ride;
  const events = await GameEvent.find(query).sort({ createdAt: -1 }).limit(filter.limit ?? 30);
  return events.map(serializeEvent);
}

export const locationDistrict = (key: string): string | undefined => locationByKey(key)?.district;
