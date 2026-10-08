import { locationByKey, type LocationDef } from '../data/world';
import { vehicleSpec } from '../data/vehicles';
import type { RideStatus } from '../models/Ride';
import { GameEvent, Rating, Ride, User, Vehicle, type RideDoc, type UserDoc, type VehicleDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { clamp, rand, randInt } from '../utils/rng';
import { CANCELLATION_FEE_MAX, finalFare } from './fare.service';
import { rollEventsForRide, serializeEvent } from './event.service';
import { assertRoadworthy, requireNotTravelling, resolveTravel, wearFor } from './game.service';
import { notify } from './notification.service';
import {
  advanceRide, LIVE_STATUSES, pickupSeconds, scheduleAdvance, serializeRide, TIMING_TOLERANCE, tripSeconds,
} from './ride.helpers';
import { applyRating, awardXp, ensureProgress } from './progress.service';
import { buildQuote, verifyQuote } from './quote.service';
import { routeBetweenLocations } from './routing.service';
import { derivedStats } from './vehicle.service';
import { credit, debit, pay } from './wallet.service';
import { getWorld } from './world.service';
import { emitToUser } from './socket.service';

export { buildQuote };

const place = (l: LocationDef) => ({ key: l.key, name: l.name, district: l.district, lat: l.pos[0], lng: l.pos[1] });

async function loadRide(user: UserDoc, id: string): Promise<RideDoc> {
  const ride = await Ride.findById(id);
  if (!ride) throw ApiError.notFound('Ride not found');
  const uid = String(user._id);
  const mine = String(ride.driver ?? '') === uid || String(ride.passenger ?? '') === uid;
  if (!mine) throw ApiError.forbidden('This is not your ride');
  return advanceRide(ride);
}

const isDriverOf = (ride: RideDoc, user: UserDoc) => String(ride.driver ?? '') === String(user._id);

export async function withEvents(ride: RideDoc, viewerId: string) {
  const events = await GameEvent.find({ ride: ride._id }).sort({ triggerAt: 1 });
  return { ...serializeRide(ride, viewerId), events: events.map(serializeEvent) };
}

export async function getRide(user: UserDoc, id: string) {
  const ride = await loadRide(user, id);
  return withEvents(ride, String(user._id));
}

export async function listRides(user: UserDoc, opts: { status?: string; limit: number; skip: number }) {
  const filter: Record<string, unknown> = {
    $and: [
      { $or: [{ driver: user._id }, { passenger: user._id }] },
      { $or: [{ matchedAt: { $ne: null } }, { status: { $in: LIVE_STATUSES } }] },
    ],
  };
  if (opts.status) (filter.$and as unknown[]).push({ status: opts.status });
  const [rides, total] = await Promise.all([
    Ride.find(filter).sort({ requestedAt: -1 }).skip(opts.skip).limit(opts.limit),
    Ride.countDocuments(filter),
  ]);
  const advanced = await Promise.all((rides as RideDoc[]).map((r) => advanceRide(r)));
  return { total, rides: advanced.map((r) => serializeRide(r, String(user._id))) };
}

export async function activeRide(user: UserDoc) {
  const ride = await Ride.findOne({
    $or: [{ driver: user._id }, { passenger: user._id }],
    status: { $in: (user.mode === 'PASSENGER' ? ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] : ['MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS']) as RideStatus[] },
  }).sort({ requestedAt: -1 });
  if (!ride) return null;
  await advanceRide(ride);
  return withEvents(ride, String(user._id));
}

/* ---------------------------------------------------------------- passenger */

export async function requestRide(user: UserDoc, input: { quoteToken: string; paymentMethod: 'CASH' | 'BANK' }) {
  if (user.mode !== 'PASSENGER') throw ApiError.forbidden('Switch to Passenger mode to request a ride');
  requireNotTravelling(user);
  const q = verifyQuote(input.quoteToken, String(user._id));
  const spec = vehicleSpec(q.specId);
  const origin = locationByKey(q.originKey);
  const dest = locationByKey(q.destinationKey);
  const start = locationByKey(q.startKey);
  if (!spec || !origin || !dest || !start) throw ApiError.badRequest('Invalid quote');
  if (await Ride.exists({ passenger: user._id, status: { $in: LIVE_STATUSES } })) {
    throw ApiError.conflict('You already have a ride in progress', 'RIDE_ACTIVE');
  }
  const fresh = await User.findById(user._id).select('cash bank');
  if (!fresh || fresh.cash + fresh.bank < q.fare) {
    throw ApiError.paymentRequired(`You need at least ₦${q.fare.toLocaleString('en-NG')} to take this ride`);
  }
  const world = getWorld();
  const route = routeBetweenLocations(origin, dest, spec, world);
  const pickup = routeBetweenLocations(start, origin, spec, world);
  const ride = await Ride.create({
    kind: 'PASSENGER_REQUEST',
    passenger: user._id,
    npcDriver: {
      name: q.driver.name,
      rating: q.driver.rating,
      vehicleName: spec.name,
      vehicleClass: spec.cls,
      plate: q.driver.plate,
      color: q.driver.color,
      bio: q.driver.bio,
    },
    vehicleClass: spec.cls,
    origin: place(origin),
    destination: place(dest),
    routeNodeIds: q.routeNodeIds,
    routeGeometry: route.geometry,
    pickupGeometry: pickup.geometry,
    roads: q.roads,
    distanceKm: q.distanceKm,
    durationMin: q.durationMin,
    pickupDistanceKm: q.pickupDistanceKm,
    pickupMin: q.pickupMin,
    fare: { base: q.fare, multiplier: 1, adjustment: 0, final: q.fare, tip: 0 },
    surge: q.surge,
    weather: q.weather,
    status: 'REQUESTED',
    history: [{ status: 'REQUESTED', at: new Date() }],
    paymentMethod: input.paymentMethod,
  });
  user.locationKey = origin.key;
  await user.save();
  scheduleAdvance(String(ride._id));
  return withEvents(ride, String(user._id));
}

export async function rateRide(user: UserDoc, id: string, input: { stars: number; tags?: string[]; comment?: string; tip?: number }) {
  const ride = await loadRide(user, id);
  if (String(ride.passenger ?? '') !== String(user._id)) throw ApiError.forbidden('Only the passenger can rate this driver');
  if (ride.status !== 'COMPLETED') throw ApiError.conflict('You can rate a ride once it is complete', 'NOT_COMPLETE');
  if (ride.rating) throw ApiError.conflict('You have already rated this ride', 'ALREADY_RATED');
  let tipPaid = 0;
  if (input.tip && input.tip > 0) {
    await pay(String(user._id), input.tip, 'TIP', `Tip for ${ride.npcDriver?.name ?? 'driver'}`, ride.paymentMethod, { ride: String(ride._id) });
    tipPaid = input.tip;
    ride.fare.tip = tipPaid;
  }
  ride.rating = input.stars;
  ride.ratingTags = input.tags ?? [];
  await ride.save();
  await Rating.create({
    ride: ride._id,
    fromUser: user._id,
    toUser: null,
    targetRole: 'DRIVER',
    targetName: ride.npcDriver?.name,
    stars: input.stars,
    tags: input.tags ?? [],
    comment: input.comment,
  });
  const progress = await ensureProgress(String(user._id));
  const levelUp = await awardXp(progress, 6 + (tipPaid ? 4 : 0));
  return { ride: serializeRide(ride, String(user._id)), tipPaid, levelUp };
}

/* ------------------------------------------------------------------- shared */

export async function startRide(user: UserDoc, id: string) {
  const ride = await loadRide(user, id);
  if (ride.status !== 'DRIVER_ARRIVING') throw ApiError.conflict(`Ride cannot be started while ${ride.status.toLowerCase().replace('_', ' ')}`, 'BAD_STATE');
  const waited = (Date.now() - (ride.arrivingAt ?? ride.matchedAt ?? new Date()).getTime()) / 1000;
  const needed = pickupSeconds(ride) * TIMING_TOLERANCE;
  if (waited < needed) {
    throw new ApiError(409, ride.kind === 'DRIVER_OFFER' ? 'You have not reached the pickup point yet' : 'Your driver has not arrived yet', 'TOO_EARLY', { retryAfterMs: Math.ceil((needed - waited) * 1000) });
  }
  const now = new Date();
  ride.status = 'IN_PROGRESS';
  ride.startedAt = now;
  ride.history.push({ status: 'IN_PROGRESS', at: now });
  await ride.save();
  const role = isDriverOf(ride, user) ? 'DRIVER' : 'PASSENGER';
  if (role === 'DRIVER') {
    user.locationKey = ride.origin.key ?? user.locationKey;
    await user.save();
  }
  await rollEventsForRide(ride, role);
  const payload = await withEvents(ride, String(user._id));
  if (ride.passenger && role === 'DRIVER') emitToUser(String(ride.passenger), 'ride:update', serializeRide(ride, String(ride.passenger)));
  return payload;
}

export async function completeRide(user: UserDoc, id: string) {
  const ride = await loadRide(user, id);
  if (ride.status !== 'IN_PROGRESS') throw ApiError.conflict(`Ride is ${ride.status.toLowerCase().replace('_', ' ')}`, 'BAD_STATE');
  const pending = await GameEvent.countDocuments({ ride: ride._id, status: 'PENDING' });
  if (pending > 0) throw ApiError.conflict('Deal with what is happening on the road first', 'EVENT_PENDING');
  const elapsed = (Date.now() - (ride.startedAt ?? new Date()).getTime()) / 1000;
  const needed = tripSeconds(ride) * TIMING_TOLERANCE;
  if (elapsed < needed) {
    throw new ApiError(409, 'You have not reached the destination yet', 'TOO_EARLY', { retryAfterMs: Math.ceil((needed - elapsed) * 1000) });
  }
  const userId = String(user._id);
  const isDriver = isDriverOf(ride, user);
  const dest = locationByKey(ride.destination.key ?? '');
  const now = new Date();
  const progress = await ensureProgress(userId);
  const km = ride.distanceKm + ride.pickupDistanceKm;
  const summary: Record<string, unknown> = { fare: ride.fare.final };

  if (isDriver) {
    const vehicle = ride.vehicle ? await Vehicle.findById(ride.vehicle) : null;
    let fuelUsed = 0;
    let wear = 0;
    if (vehicle) {
      const spec = vehicleSpec(vehicle.specId)!;
      const stats = derivedStats(vehicle, spec);
      fuelUsed = Math.min(vehicle.fuel, (km * stats.fuelPer100km) / 100);
      wear = wearFor(km, stats.reliability) * rand(0.8, 1.3);
      vehicle.fuel -= fuelUsed;
      vehicle.condition = clamp(vehicle.condition - wear, 0, 100);
      vehicle.cleanliness = clamp(vehicle.cleanliness - rand(0.8, 2) * (ride.npcPassenger?.groupSize ?? 1) ** 0.5, 0, 100);
      vehicle.odometerKm += km;
      await vehicle.save();
    }
    const late = ride.delayMin > ride.durationMin * 0.35 + 3;
    ride.late = late;
    const rating = await generateRating(ride, vehicle, late);
    await credit(userId, Math.max(1, ride.fare.final), 'RIDE_EARNING', `${ride.origin.name} → ${ride.destination.name}`, { ride: id, vehicle: ride.vehicle ? String(ride.vehicle) : null, meta: { group: ride.npcPassenger?.groupSize ?? 1 } });
    let tip = 0;
    if (rating.stars >= 5 && Math.random() < (ride.npcPassenger?.tier === 'VIP' ? 0.8 : 0.35)) {
      tip = randInt(2, 10) * 100 * (ride.npcPassenger?.tier === 'VIP' ? 3 : 1);
      await credit(userId, tip, 'TIP', `Tip from ${ride.npcPassenger?.name}`, { ride: id });
      ride.fare.tip = tip;
    }
    progress.ridesAsDriver += 1;
    progress.dailyRides += 1;
    progress.totalDistanceKm += km;
    if (late) progress.lateArrivals += 1;
    applyRating(progress, rating.stars);
    const tierBonus = ride.npcPassenger?.tier === 'VIP' ? 25 : ride.npcPassenger?.tier === 'PREMIUM' ? 10 : 0;
    const xp = Math.round(15 + ride.distanceKm * 3 + (rating.stars - 3) * 5 + tierBonus);
    ride.xpAwarded = xp;
    ride.rating = rating.stars;
    const levelUp = await awardXp(progress, xp);
    user.locationKey = dest?.key ?? user.locationKey;
    await user.save();
    await Rating.create({ ride: ride._id, fromUser: null, toUser: user._id, targetRole: 'DRIVER', targetName: user.name, stars: rating.stars, tags: rating.tags, comment: rating.comment, factors: rating.factors });
    Object.assign(summary, { earnings: ride.fare.final, tip, fuelUsed: Math.round(fuelUsed * 100) / 100, wear: Math.round(wear * 10) / 10, xp, rating: rating.stars, ratingComment: rating.comment, ratingFactors: rating.factors, levelUp, late });
  } else {
    await pay(userId, Math.max(1, ride.fare.final), 'RIDE_PAYMENT', `${ride.origin.name} → ${ride.destination.name}`, ride.paymentMethod, { ride: id });
    progress.ridesAsPassenger += 1;
    const xp = 8 + Math.round(ride.distanceKm);
    ride.xpAwarded = xp;
    const levelUp = await awardXp(progress, xp);
    user.locationKey = dest?.key ?? user.locationKey;
    await user.save();
    Object.assign(summary, { paid: ride.fare.final, xp, levelUp });
  }
  ride.paid = true;
  ride.status = 'COMPLETED';
  ride.completedAt = now;
  ride.history.push({ status: 'COMPLETED', at: now });
  await ride.save();

  const counterpart = isDriver ? ride.passenger : ride.driver;
  if (counterpart) emitToUser(String(counterpart), 'ride:update', serializeRide(ride, String(counterpart)));
  await notify(userId, 'RIDE_COMPLETED', isDriver ? `You earned ₦${ride.fare.final.toLocaleString('en-NG')}` : 'You have arrived', `${ride.origin.name} → ${ride.destination.name}`, { rideId: id });
  return { ride: await withEvents(ride, userId), summary };
}

async function generateRating(ride: RideDoc, vehicle: VehicleDoc | null, late: boolean) {
  let stars = 4.85;
  const factors: Record<string, number> = {};
  const add = (key: string, v: number) => {
    if (v !== 0) factors[key] = Math.round(v * 100) / 100;
    stars += v;
  };
  if (vehicle) {
    const spec = vehicleSpec(vehicle.specId)!;
    const comfort = derivedStats(vehicle, spec).comfort;
    add('cleanliness', vehicle.cleanliness < 40 ? -0.8 : vehicle.cleanliness < 65 ? -0.35 : vehicle.cleanliness > 90 ? 0.1 : 0);
    add('vehicleCondition', vehicle.condition < 35 ? -0.6 : vehicle.condition < 60 ? -0.2 : 0);
    add('comfort', comfort >= 8 ? 0.2 : comfort <= 3 ? -0.3 : 0);
  }
  add('punctuality', late ? -0.8 : ride.delayMin <= 3 ? 0.1 : 0);
  add('choices', clamp(ride.ratingMod, -1.5, 1.2));
  const tier = ride.npcPassenger?.tier;
  if (tier === 'VIP') add('highExpectations', -0.25);
  stars += (Math.random() - 0.5) * 0.9;
  const rounded = clamp(Math.round(stars), 1, 5);
  const comment =
    rounded >= 5 ? pickLine(['Smooth ride. Thank you!', 'Very professional.', 'Clean car and a safe driver.', 'Arrived on time. God bless.'])
    : rounded === 4 ? pickLine(['Good ride overall.', 'Fine, nothing to complain about.'])
    : rounded === 3 ? pickLine(['Okay, but the trip took long.', 'The car could be cleaner.'])
    : pickLine(['Not a good experience.', 'Late and uncomfortable.']);
  const tags = Object.entries(factors).filter(([, v]) => v < -0.15).map(([k]) => k);
  return { stars: rounded, comment, tags, factors };
}

const pickLine = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

export async function cancelRide(user: UserDoc, id: string, reason?: string) {
  const ride = await loadRide(user, id);
  if (!['REQUESTED', 'MATCHED', 'DRIVER_ARRIVING'].includes(ride.status)) {
    throw ApiError.conflict(ride.status === 'IN_PROGRESS' ? 'A trip in progress cannot be cancelled' : `Ride is already ${ride.status.toLowerCase()}`, 'BAD_STATE');
  }
  const userId = String(user._id);
  const byDriver = isDriverOf(ride, user);
  const wasMatched = ride.status !== 'REQUESTED';
  const now = new Date();
  ride.status = 'CANCELLED';
  ride.cancelledAt = now;
  ride.cancelledBy = byDriver ? 'DRIVER' : 'PASSENGER';
  ride.cancelReason = reason ?? (byDriver ? 'Cancelled by driver' : 'Cancelled by passenger');
  ride.history.push({ status: 'CANCELLED', at: now });
  let fee = 0;
  if (!byDriver && wasMatched) {
    fee = Math.min(CANCELLATION_FEE_MAX, Math.round((ride.fare.final * 0.15) / 50) * 50);
    if (fee > 0) {
      try {
        await pay(userId, fee, 'CANCELLATION_FEE', 'Late cancellation fee', ride.paymentMethod, { ride: id });
      } catch {
        fee = 0; // Too poor to charge — waive it rather than block cancelling.
      }
    }
  }
  await ride.save();
  if (byDriver && wasMatched) {
    const progress = await ensureProgress(userId);
    progress.cancellations += 1;
    applyRating(progress, 3);
    await progress.save();
  }
  return { ride: serializeRide(ride, userId), fee };
}

export async function declineOffer(user: UserDoc, id: string) {
  const ride = await loadRide(user, id);
  if (ride.kind !== 'DRIVER_OFFER' || !isDriverOf(ride, user)) throw ApiError.forbidden('Only offers made to you can be declined');
  if (ride.status !== 'REQUESTED') throw ApiError.conflict('This offer is no longer open', 'BAD_STATE');
  ride.status = 'CANCELLED';
  ride.cancelledBy = 'DRIVER';
  ride.cancelReason = 'DECLINED';
  ride.cancelledAt = new Date();
  ride.history.push({ status: 'CANCELLED', at: ride.cancelledAt });
  await ride.save();
  return serializeRide(ride, String(user._id));
}

export async function acceptOffer(user: UserDoc, id: string) {
  if (user.mode !== 'DRIVER') throw ApiError.forbidden('Switch to Driver mode to accept rides');
  await resolveTravel(user);
  requireNotTravelling(user);
  const ride = await loadRide(user, id);
  if (ride.kind !== 'DRIVER_OFFER' || !isDriverOf(ride, user)) throw ApiError.forbidden('This offer was not made to you');
  if (ride.status !== 'REQUESTED') throw ApiError.conflict('This offer is no longer open', 'BAD_STATE');
  if (ride.expiresAt && ride.expiresAt.getTime() < Date.now()) {
    ride.status = 'CANCELLED';
    ride.cancelledBy = 'SYSTEM';
    ride.cancelReason = 'EXPIRED';
    ride.cancelledAt = new Date();
    await ride.save();
    throw ApiError.conflict('Too slow — another driver took this ride', 'OFFER_EXPIRED');
  }
  if (await Ride.exists({ driver: user._id, status: { $in: ['MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] } })) {
    throw ApiError.conflict('You are already on a ride', 'RIDE_ACTIVE');
  }
  const progress = await ensureProgress(String(user._id));
  if (!progress.dayActive) throw ApiError.conflict('Start your work day first', 'NO_DAY');
  const vehicle = user.activeVehicleId ? await Vehicle.findById(user.activeVehicleId) : null;
  if (!vehicle) throw ApiError.conflict('You have no active vehicle', 'NO_VEHICLE');
  assertRoadworthy(vehicle);
  const spec = vehicleSpec(vehicle.specId)!;
  const stats = derivedStats(vehicle, spec);
  const needed = ((ride.distanceKm + ride.pickupDistanceKm) * stats.fuelPer100km) / 100;
  if (vehicle.fuel < needed) {
    throw ApiError.conflict(`This trip needs about ${needed.toFixed(1)} L of fuel and you have ${vehicle.fuel.toFixed(1)} L`, 'LOW_FUEL');
  }
  const now = new Date();
  ride.vehicle = vehicle._id;
  ride.matchedAt = now;
  ride.arrivingAt = now;
  ride.history.push({ status: 'MATCHED', at: now });
  ride.history.push({ status: 'DRIVER_ARRIVING', at: now });
  ride.status = 'DRIVER_ARRIVING';
  ride.expiresAt = undefined;
  await ride.save();
  return withEvents(ride, String(user._id));
}
