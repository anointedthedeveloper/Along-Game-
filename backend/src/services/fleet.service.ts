import { env } from '../config/env';
import { vehicleSpec } from '../data/vehicles';
import { Vehicle, type UserDoc, type VehicleDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { clamp, pick } from '../utils/rng';
import { npcName } from './npc.service';
import { levelDef, ensureProgress } from './progress.service';
import { derivedStats, serializeVehicle } from './vehicle.service';
import { credit, debit, debitUpTo } from './wallet.service';
import { demandAt, fuelPriceAt, gameMinutesNow } from './world.service';

export const HIRING_FEE = 20_000;
const MAX_ACCRUAL_GAME_MIN = 480;
const AVG_TRIP_KM = 7;

interface Projection {
  gameMinutes: number;
  trips: number;
  gross: number;
  fuelCost: number;
  wage: number;
  net: number;
  wear: number;
  blocked?: string;
}

function project(vehicle: VehicleDoc): Projection | null {
  const hired = vehicle.hiredDriver;
  if (!hired?.lastCollectedAt) return null;
  const spec = vehicleSpec(vehicle.specId)!;
  const stats = derivedStats(vehicle, spec);
  const now = Date.now();
  const elapsedSec = (now - hired.lastCollectedAt.getTime()) / 1000;
  const gameMinutes = Math.min(MAX_ACCRUAL_GAME_MIN, Math.floor(elapsedSec * env.gameSpeed));
  const startMin = gameMinutesNow(now) - gameMinutes;
  let trips = 0;
  for (let h = 0; h < gameMinutes / 60; h++) {
    trips += 1.4 * demandAt((startMin + h * 60) % 1440) * spec.demand * (hired.skill ?? 0.8);
  }
  trips = Math.floor(trips);
  if (vehicle.condition < 20) return { gameMinutes, trips: 0, gross: 0, fuelCost: 0, wage: 0, net: 0, wear: 0, blocked: 'Vehicle needs repairs — your driver refuses to work it.' };
  const avgFare = (400 + 160 * AVG_TRIP_KM + 20 * 18) * spec.fareMultiplier * (1 + (spec.maxGroup - 1) * 0.45);
  const gross = Math.round(trips * avgFare);
  const fuelPrice = fuelPriceAt(gameMinutesNow(now)).price;
  const fuelCost = Math.round(((trips * AVG_TRIP_KM * stats.fuelPer100km) / 100) * fuelPrice);
  const wage = Math.round(Math.max(0, gross - fuelCost) * ((hired.wagePercent ?? 30) / 100));
  const wear = (trips * AVG_TRIP_KM * (0.22 - stats.reliability * 0.015)) * 0.9;
  return { gameMinutes, trips, gross, fuelCost, wage, net: gross - fuelCost - wage, wear };
}

export async function listFleet(user: UserDoc) {
  const vehicles = await Vehicle.find({ owner: user._id }).sort({ createdAt: 1 });
  const progress = await ensureProgress(String(user._id));
  const def = levelDef(progress.level);
  return {
    canHire: def.canHire,
    hiringFee: HIRING_FEE,
    vehicles: vehicles.map((v) => ({
      ...serializeVehicle(v),
      active: String(user.activeVehicleId) === String(v._id),
      projection: project(v),
    })),
  };
}

export async function hireDriver(user: UserDoc, vehicleId: string) {
  const progress = await ensureProgress(String(user._id));
  if (!levelDef(progress.level).canHire) throw ApiError.forbidden('Reach level 4 (Professional Driver) to hire drivers');
  const vehicle = await Vehicle.findOne({ _id: vehicleId, owner: user._id });
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  if (String(user.activeVehicleId) === String(vehicle._id)) throw ApiError.conflict('You are driving this vehicle yourself. Assign a different vehicle.', 'ACTIVE_VEHICLE');
  if (vehicle.hiredDriver) throw ApiError.conflict('This vehicle already has a driver', 'ALREADY_HIRED');
  await debit(String(user._id), HIRING_FEE, 'OTHER_EXPENSE', 'Driver recruitment fee', { vehicle: vehicleId });
  vehicle.hiredDriver = {
    name: npcName(),
    skill: Math.round((0.65 + Math.random() * 0.35) * 100) / 100,
    wagePercent: pick([25, 28, 30, 33, 35]),
    hiredAt: new Date(),
    lastCollectedAt: new Date(),
  };
  await vehicle.save();
  return serializeVehicle(vehicle);
}

export async function dismissDriver(user: UserDoc, vehicleId: string) {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, owner: user._id });
  if (!vehicle?.hiredDriver) throw ApiError.notFound('No driver on this vehicle');
  await collectOne(user, vehicle);
  vehicle.hiredDriver = null;
  await vehicle.save();
  return serializeVehicle(vehicle);
}

async function collectOne(user: UserDoc, vehicle: VehicleDoc) {
  const p = project(vehicle);
  const userId = String(user._id);
  if (!p || !vehicle.hiredDriver) return null;
  if (p.blocked) {
    vehicle.hiredDriver.lastCollectedAt = new Date();
    await vehicle.save();
    return { vehicleId: String(vehicle._id), ...p };
  }
  if (p.trips <= 0) return { vehicleId: String(vehicle._id), ...p };
  const takings = p.gross - p.fuelCost;
  const spec = vehicleSpec(vehicle.specId)!;
  if (takings > 0) await credit(userId, takings, 'FLEET_INCOME', `${vehicle.hiredDriver.name} · ${spec.name}: ${p.trips} trips (after fuel)`, { vehicle: String(vehicle._id) });
  if (p.wage > 0) await debitUpTo(userId, p.wage, 'DRIVER_WAGE', `Wages: ${vehicle.hiredDriver.name}`, { vehicle: String(vehicle._id) });
  vehicle.condition = clamp(vehicle.condition - p.wear, 0, 100);
  vehicle.cleanliness = clamp(vehicle.cleanliness - p.trips * 0.6, 0, 100);
  vehicle.odometerKm += p.trips * AVG_TRIP_KM;
  vehicle.hiredDriver.lastCollectedAt = new Date();
  await vehicle.save();
  return { vehicleId: String(vehicle._id), ...p };
}

export async function collectFleet(user: UserDoc) {
  const vehicles = await Vehicle.find({ owner: user._id, 'hiredDriver.name': { $exists: true } });
  const results = [];
  for (const v of vehicles) {
    const r = await collectOne(user, v);
    if (r) results.push(r);
  }
  const total = results.reduce((a, r) => a + (r.net ?? 0), 0);
  return { results, total };
}
