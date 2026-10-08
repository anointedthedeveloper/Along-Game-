import { VEHICLES, UPGRADES, vehicleSpec, START_VEHICLE_ID, type UpgradeKind, type VehicleSpec } from '../data/vehicles';
import { Ride, User, Vehicle, type UserDoc, type VehicleDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { clamp, pick, randInt } from '../utils/rng';
import { requireLocationType } from './game.service';
import { plate } from './npc.service';
import { ensureProgress, levelDef } from './progress.service';
import { debit, pay } from './wallet.service';
import { getWorld } from './world.service';

export interface DerivedStats {
  speedKph: number;
  fuelPer100km: number;
  tankLiters: number;
  comfort: number;
  reliability: number;
  capacity: number;
  maintenancePerKm: number;
}

export function derivedStats(vehicle: Pick<VehicleDoc, 'upgrades' | 'condition' | 'cleanliness'>, spec: VehicleSpec): DerivedStats {
  const u = vehicle.upgrades;
  return {
    speedKph: spec.speedKph * (1 + 0.06 * u.engine),
    fuelPer100km: spec.fuelPer100km * (1 - 0.06 * u.engine),
    tankLiters: spec.tankLiters,
    comfort: clamp(spec.comfort + u.interior, 1, 10),
    reliability: clamp(spec.reliability + 0.5 * u.tyres, 1, 10),
    capacity: spec.capacity,
    maintenancePerKm: spec.maintenancePerKm,
  };
}

export const repairCostPerPoint = (spec: VehicleSpec): number => Math.max(150, Math.round(spec.price * 0.0005));
export const upgradeCost = (spec: VehicleSpec, kind: UpgradeKind, currentLevel: number): number =>
  Math.round((spec.price * UPGRADES[kind].baseCostFactor * 1.8 ** currentLevel) / 100) * 100;
export const WASH_COST = 1500;

export function serializeVehicle(vehicle: VehicleDoc) {
  const spec = vehicleSpec(vehicle.specId)!;
  const stats = derivedStats(vehicle, spec);
  return {
    id: String(vehicle._id),
    specId: spec.id,
    cls: spec.cls,
    name: spec.name,
    nickname: vehicle.nickname,
    plate: vehicle.plate,
    color: vehicle.color,
    condition: Math.round(vehicle.condition * 10) / 10,
    cleanliness: Math.round(vehicle.cleanliness),
    fuel: Math.round(vehicle.fuel * 10) / 10,
    fuelPercent: Math.round((vehicle.fuel / stats.tankLiters) * 100),
    odometerKm: Math.round(vehicle.odometerKm),
    upgrades: vehicle.upgrades,
    stats,
    range: Math.round((vehicle.fuel / stats.fuelPer100km) * 100),
    repairCostPerPoint: repairCostPerPoint(spec),
    hiredDriver: vehicle.hiredDriver ?? null,
    purchasePrice: vehicle.purchasePrice,
  };
}

export function serializeSpec(spec: VehicleSpec, level: number) {
  return {
    id: spec.id,
    cls: spec.cls,
    name: spec.name,
    tagline: spec.tagline,
    price: spec.price,
    fuelPer100km: spec.fuelPer100km,
    tankLiters: spec.tankLiters,
    capacity: spec.capacity,
    speedKph: spec.speedKph,
    comfort: spec.comfort,
    reliability: spec.reliability,
    maintenancePerKm: spec.maintenancePerKm,
    demand: spec.demand,
    minLevel: spec.minLevel,
    restrictedDistricts: spec.restrictedDistricts,
    onlyDistricts: spec.onlyDistricts ?? null,
    locked: spec.minLevel > level,
    colors: spec.colors,
  };
}

export async function createVehicle(owner: string, specId: string, opts: { condition?: number; cleanliness?: number; fuelPercent?: number; price?: number } = {}): Promise<VehicleDoc> {
  const spec = vehicleSpec(specId);
  if (!spec) throw ApiError.badRequest('Unknown vehicle');
  return Vehicle.create({
    owner,
    specId,
    plate: plate(),
    color: pick(spec.colors),
    condition: opts.condition ?? 100,
    cleanliness: opts.cleanliness ?? 95,
    fuel: spec.tankLiters * (opts.fuelPercent ?? 0.3),
    purchasePrice: opts.price ?? 0,
  });
}

export async function createStarterVehicle(user: UserDoc): Promise<VehicleDoc> {
  const vehicle = await createVehicle(String(user._id), START_VEHICLE_ID, {
    condition: randInt(68, 78),
    cleanliness: randInt(55, 70),
    fuelPercent: 0.3,
  });
  await User.updateOne({ _id: user._id }, { activeVehicleId: vehicle._id });
  user.activeVehicleId = vehicle._id;
  return vehicle;
}

async function ownedVehicle(user: UserDoc, id: string): Promise<VehicleDoc> {
  const vehicle = await Vehicle.findOne({ _id: id, owner: user._id });
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  return vehicle;
}

export const listVehicles = async (user: UserDoc) => {
  const vehicles = await Vehicle.find({ owner: user._id }).sort({ createdAt: 1 });
  return vehicles.map((v) => ({ ...serializeVehicle(v), active: String(user.activeVehicleId) === String(v._id) }));
};

export async function catalog(user: UserDoc) {
  const progress = await ensureProgress(String(user._id));
  const count = await Vehicle.countDocuments({ owner: user._id });
  const def = levelDef(progress.level);
  return {
    level: progress.level,
    owned: count,
    maxVehicles: def.maxVehicles,
    items: VEHICLES.map((v) => serializeSpec(v, progress.level)),
    upgrades: UPGRADES,
  };
}

export async function buyVehicle(user: UserDoc, specId: string, paymentMethod: 'CASH' | 'BANK') {
  const spec = vehicleSpec(specId);
  if (!spec) throw ApiError.badRequest('Unknown vehicle');
  const progress = await ensureProgress(String(user._id));
  if (progress.level < spec.minLevel) throw ApiError.forbidden(`Reach driver level ${spec.minLevel} to buy a ${spec.name}`);
  const owned = await Vehicle.countDocuments({ owner: user._id });
  const def = levelDef(progress.level);
  if (owned >= def.maxVehicles) {
    throw ApiError.forbidden(`Your level allows ${def.maxVehicles} vehicle${def.maxVehicles > 1 ? 's' : ''}. Level up to own more.`);
  }
  await requireLocationType(user, ['GARAGE'], 'buy a vehicle');
  await pay(String(user._id), spec.price, 'VEHICLE_PURCHASE', `Bought ${spec.name}`, paymentMethod, { meta: { specId } });
  const vehicle = await createVehicle(String(user._id), specId, { price: spec.price, fuelPercent: 0.25 });
  if (!user.activeVehicleId) {
    user.activeVehicleId = vehicle._id;
    await user.save();
  }
  return serializeVehicle(vehicle);
}

export async function refuel(user: UserDoc, id: string, opts: { liters?: number; toPercent?: number }) {
  const vehicle = await ownedVehicle(user, id);
  await requireLocationType(user, ['PETROL_STATION'], 'buy fuel');
  const spec = vehicleSpec(vehicle.specId)!;
  const tank = spec.tankLiters;
  const room = tank - vehicle.fuel;
  if (room < 0.5) throw ApiError.conflict('The tank is already full', 'TANK_FULL');
  let liters = opts.liters ?? (opts.toPercent !== undefined ? (tank * opts.toPercent) / 100 - vehicle.fuel : room);
  liters = Math.min(room, Math.max(0, liters));
  if (liters < 0.5) throw ApiError.badRequest('Choose at least half a litre');
  const world = getWorld();
  const cost = Math.ceil(liters * world.fuelPrice);
  await debit(String(user._id), cost, 'FUEL_PURCHASE', `Fuel ${liters.toFixed(1)} L @ ₦${world.fuelPrice}/L`, {
    vehicle: String(vehicle._id),
    meta: { liters, pricePerLiter: world.fuelPrice },
  });
  vehicle.fuel = Math.min(tank, vehicle.fuel + liters);
  await vehicle.save();
  return { vehicle: serializeVehicle(vehicle), liters, cost, pricePerLiter: world.fuelPrice };
}

export async function repair(user: UserDoc, id: string, toCondition = 100) {
  const vehicle = await ownedVehicle(user, id);
  await requireLocationType(user, ['GARAGE'], 'repair a vehicle');
  const spec = vehicleSpec(vehicle.specId)!;
  const target = clamp(toCondition, 0, 100);
  const points = Math.ceil(target - vehicle.condition);
  if (points <= 0) throw ApiError.conflict('Nothing to repair at that level', 'NO_REPAIR_NEEDED');
  const cost = points * repairCostPerPoint(spec);
  await debit(String(user._id), cost, 'MAINTENANCE', `Repairs: ${spec.name} (+${points}%)`, { vehicle: String(vehicle._id), meta: { points } });
  vehicle.condition = target;
  await vehicle.save();
  return { vehicle: serializeVehicle(vehicle), cost, points };
}

export async function wash(user: UserDoc, id: string) {
  const vehicle = await ownedVehicle(user, id);
  await requireLocationType(user, ['GARAGE', 'PETROL_STATION'], 'wash your vehicle');
  if (vehicle.cleanliness >= 95) throw ApiError.conflict('Your vehicle is already spotless', 'ALREADY_CLEAN');
  await debit(String(user._id), WASH_COST, 'MAINTENANCE', 'Car wash and interior detailing', { vehicle: String(vehicle._id) });
  vehicle.cleanliness = 100;
  await vehicle.save();
  return { vehicle: serializeVehicle(vehicle), cost: WASH_COST };
}

export async function upgrade(user: UserDoc, id: string, kind: UpgradeKind) {
  const vehicle = await ownedVehicle(user, id);
  await requireLocationType(user, ['GARAGE'], 'upgrade a vehicle');
  const spec = vehicleSpec(vehicle.specId)!;
  const level = vehicle.upgrades[kind];
  if (level >= UPGRADES[kind].maxLevel) throw ApiError.conflict('Already at the maximum level', 'MAX_UPGRADE');
  const cost = upgradeCost(spec, kind, level);
  await debit(String(user._id), cost, 'VEHICLE_UPGRADE', `${UPGRADES[kind].label} (level ${level + 1}) for ${spec.name}`, { vehicle: String(vehicle._id), meta: { kind } });
  vehicle.upgrades[kind] = level + 1;
  await vehicle.save();
  return { vehicle: serializeVehicle(vehicle), cost };
}

export async function activate(user: UserDoc, id: string) {
  const vehicle = await ownedVehicle(user, id);
  const busy = await Ride.exists({ driver: user._id, status: { $in: ['MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] } });
  if (busy) throw ApiError.conflict('Finish your current ride before switching vehicles', 'RIDE_ACTIVE');
  user.activeVehicleId = vehicle._id;
  await user.save();
  return serializeVehicle(vehicle);
}

export async function rename(user: UserDoc, id: string, nickname: string) {
  const vehicle = await ownedVehicle(user, id);
  vehicle.nickname = nickname.slice(0, 24);
  await vehicle.save();
  return serializeVehicle(vehicle);
}

export { ownedVehicle };
