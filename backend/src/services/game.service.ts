import { locationByKey, type LocationDef, type LocationType } from '../data/world';
import { vehicleSpec } from '../data/vehicles';
import { Ride, Vehicle, type UserDoc, type VehicleDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { ensureProgress, serializeProgress } from './progress.service';
import { routeBetweenKeys } from './routing.service';
import { gameMinToSeconds, getWorld } from './world.service';
import { derivedStats, serializeVehicle } from './vehicle.service';

const MAX_DAY_HISTORY = 14;

/** If the player's trip across town has finished, land them at the destination. */
export async function resolveTravel(user: UserDoc): Promise<UserDoc> {
  if (user.travel?.arriveAt && user.travel.arriveAt.getTime() <= Date.now()) {
    user.locationKey = user.travel.toKey ?? user.locationKey;
    user.travel = null;
    await user.save();
  }
  return user;
}

export function requireNotTravelling(user: UserDoc): void {
  if (user.travel?.arriveAt && user.travel.arriveAt.getTime() > Date.now()) {
    throw ApiError.conflict('You are still on the road. Wait until you arrive.', 'TRAVELLING');
  }
}

export async function requireLocationType(user: UserDoc, types: LocationType[], what: string): Promise<LocationDef> {
  await resolveTravel(user);
  requireNotTravelling(user);
  const loc = locationByKey(user.locationKey);
  if (!loc || !types.includes(loc.type)) {
    const label = types.map((t) => t.replace('_', ' ').toLowerCase()).join(' or ');
    throw ApiError.conflict(`You need to be at a ${label} to ${what}`, 'WRONG_LOCATION');
  }
  return loc;
}

/** Driver relocates without a passenger (cruising, going to a petrol station). Costs fuel and wear, takes real time. */
export async function travelTo(user: UserDoc, toKey: string) {
  requireNotTravelling(user);
  if (!user.activeVehicleId) throw ApiError.conflict('You have no active vehicle', 'NO_VEHICLE');
  const vehicle = await Vehicle.findById(user.activeVehicleId);
  if (!vehicle) throw ApiError.conflict('You have no active vehicle', 'NO_VEHICLE');
  const spec = vehicleSpec(vehicle.specId)!;
  const world = getWorld();
  const { to, route } = routeBetweenKeys(user.locationKey, toKey, spec, world);
  if (to.key === user.locationKey) throw ApiError.badRequest('You are already there');
  assertRoadworthy(vehicle);
  const stats = derivedStats(vehicle, spec);
  const fuelNeeded = (route.distanceKm * stats.fuelPer100km) / 100;
  if (vehicle.fuel < fuelNeeded) {
    throw ApiError.conflict(`Not enough fuel for ${route.distanceKm.toFixed(1)} km. Find a petrol station.`, 'LOW_FUEL');
  }
  vehicle.fuel = Math.max(0, vehicle.fuel - fuelNeeded);
  vehicle.odometerKm += route.distanceKm;
  vehicle.condition = Math.max(0, vehicle.condition - wearFor(route.distanceKm, stats.reliability));
  await vehicle.save();
  const now = Date.now();
  const seconds = gameMinToSeconds(route.durationMin);
  user.travel = {
    fromKey: user.locationKey,
    toKey: to.key,
    startedAt: new Date(now),
    arriveAt: new Date(now + seconds * 1000),
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
  };
  await user.save();
  return { travel: user.travel, route: { geometry: route.geometry, roads: route.roads }, vehicle: serializeVehicle(vehicle) };
}

export const wearFor = (km: number, reliability: number): number => km * (0.22 - reliability * 0.015);

export function assertRoadworthy(vehicle: VehicleDoc): void {
  if (vehicle.condition < 8) {
    throw ApiError.conflict('Your vehicle is not roadworthy. Repair it at a garage first.', 'UNROADWORTHY');
  }
}

export async function setPassengerLocation(user: UserDoc, key: string): Promise<void> {
  if (!locationByKey(key)) throw ApiError.notFound('Unknown location');
  if (user.mode !== 'PASSENGER') throw ApiError.forbidden('Only passengers can choose where they are standing');
  const active = await Ride.exists({ passenger: user._id, status: { $in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] } });
  if (active) throw ApiError.conflict('Finish your current ride first', 'RIDE_ACTIVE');
  user.locationKey = key;
  await user.save();
}

export interface DayChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export async function dayChecklist(user: UserDoc) {
  const vehicle = user.activeVehicleId ? await Vehicle.findById(user.activeVehicleId) : null;
  const items: DayChecklistItem[] = [];
  if (!vehicle) {
    items.push({ id: 'vehicle', label: 'Vehicle', ok: false, detail: 'No active vehicle' });
    return { items, ready: false };
  }
  const spec = vehicleSpec(vehicle.specId)!;
  const stats = derivedStats(vehicle, spec);
  const fuelPct = Math.round((vehicle.fuel / stats.tankLiters) * 100);
  items.push({ id: 'condition', label: 'Vehicle condition', ok: vehicle.condition >= 40, detail: `${Math.round(vehicle.condition)}%${vehicle.condition < 40 ? ' — repair before long trips' : ''}` });
  items.push({ id: 'fuel', label: 'Fuel', ok: fuelPct >= 20, detail: `${fuelPct}%${fuelPct < 20 ? ' — find a petrol station' : ''}` });
  items.push({ id: 'clean', label: 'Cleanliness', ok: vehicle.cleanliness >= 50, detail: `${Math.round(vehicle.cleanliness)}%${vehicle.cleanliness < 50 ? ' — passengers notice' : ''}` });
  items.push({ id: 'cash', label: 'Cash for the road', ok: user.cash >= 2000, detail: `₦${user.cash.toLocaleString('en-NG')}` });
  // Only a roadworthy vehicle blocks starting the day; the rest are warnings.
  return { items, ready: vehicle.condition >= 8 };
}

export async function startDay(user: UserDoc) {
  if (user.mode !== 'DRIVER') throw ApiError.forbidden('Switch to Driver mode to start a work day');
  const progress = await ensureProgress(String(user._id));
  if (progress.dayActive) throw ApiError.conflict('Your day has already started', 'DAY_ACTIVE');
  const checklist = await dayChecklist(user);
  if (!checklist.ready) throw ApiError.conflict('Your vehicle is not roadworthy. Repair it before starting the day.', 'UNROADWORTHY');
  progress.dayActive = true;
  progress.dayNumber += 1;
  progress.dayStartedAt = new Date();
  progress.dailyEarnings = 0;
  progress.dailyExpenses = 0;
  progress.dailyRides = 0;
  await progress.save();
  return { checklist, progress: serializeProgress(progress) };
}

export async function endDay(user: UserDoc) {
  const progress = await ensureProgress(String(user._id));
  if (!progress.dayActive) throw ApiError.conflict('You have not started a day', 'NO_DAY');
  const active = await Ride.exists({ driver: user._id, status: { $in: ['MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] } });
  if (active) throw ApiError.conflict('Finish your current ride before ending the day', 'RIDE_ACTIVE');
  requireNotTravelling(user);
  const summary = {
    day: progress.dayNumber,
    earnings: progress.dailyEarnings,
    expenses: progress.dailyExpenses,
    rides: progress.dailyRides,
    startedAt: progress.dayStartedAt,
    endedAt: new Date(),
  };
  progress.dayHistory.push(summary);
  if (progress.dayHistory.length > MAX_DAY_HISTORY) progress.dayHistory.splice(0, progress.dayHistory.length - MAX_DAY_HISTORY);
  progress.dayActive = false;
  await progress.save();
  // Expire any outstanding offers.
  await Ride.updateMany(
    { driver: user._id, kind: 'DRIVER_OFFER', status: 'REQUESTED' },
    { $set: { status: 'CANCELLED', cancelledBy: 'SYSTEM', cancelReason: 'DAY_ENDED', cancelledAt: new Date() } },
  );
  return {
    summary: { ...summary, net: summary.earnings - summary.expenses, grade: grade(summary.earnings - summary.expenses, summary.rides) },
    progress: serializeProgress(progress),
  };
}

function grade(net: number, rides: number): string {
  if (rides === 0) return 'No rides';
  const perRide = net / rides;
  return perRide > 2200 ? 'Excellent' : perRide > 1400 ? 'Good' : perRide > 600 ? 'Fair' : 'Tough day';
}

export async function gameState(user: UserDoc) {
  await resolveTravel(user);
  const [progress, vehicle] = await Promise.all([
    ensureProgress(String(user._id)),
    user.activeVehicleId ? Vehicle.findById(user.activeVehicleId) : null,
  ]);
  const loc = locationByKey(user.locationKey);
  return {
    world: getWorld(),
    me: {
      id: String(user._id),
      name: user.name,
      mode: user.mode,
      cash: user.cash,
      bank: user.bank,
      locationKey: user.locationKey,
      location: loc ?? null,
      travel: user.travel?.arriveAt ? user.travel : null,
    },
    progress: serializeProgress(progress),
    vehicle: vehicle ? serializeVehicle(vehicle) : null,
  };
}

