import { LOCATIONS, districtById, locationByKey, type LocationDef, type LocationType } from '../data/world';
import { vehicleSpec, type VehicleSpec } from '../data/vehicles';
import { Ride, Vehicle, type RideDoc, type UserDoc, type VehicleDoc } from '../models';
import { haversineKm } from '../utils/geo';
import { clamp, randInt, weightedPick } from '../utils/rng';
import { quoteFare, type Tier } from './fare.service';
import { npcName, npcRating, purposeFor } from './npc.service';
import { OFFER_TTL_SEC, serializeRide } from './ride.helpers';
import { ensureProgress, unlockedDistricts } from './progress.service';
import { availability } from './quote.service';
import { routeBetweenLocations } from './routing.service';
import { emitToUser } from './socket.service';
import { getWorld, type WorldSnapshot } from './world.service';

const MAX_PICKUP_KM = 9;
const MIN_SPACING_MS = 3500;

const TYPE_WEIGHT: Record<LocationType, number> = {
  BUS_STOP: 1.5, MARKET: 1.4, MALL: 1.2, HOTEL: 1, GOVERNMENT: 1, BUSINESS: 1.2, RESIDENTIAL: 1.2, MOTOR_PARK: 1.3,
  AIRPORT: 0.8, DISTRICT: 1, LANDMARK: 0.8, HOSPITAL: 0.7, SCHOOL: 0.3, PETROL_STATION: 0.15, GARAGE: 0.15, PARKING: 0.4,
};

function typeWeight(type: LocationType, hour: number, as: 'origin' | 'dest'): number {
  let w = TYPE_WEIGHT[type];
  const morning = hour >= 5 && hour < 10;
  const evening = hour >= 16 && hour < 20;
  if (type === 'SCHOOL') w *= morning ? 5 : 0.5;
  if (morning) {
    if (as === 'origin' && (type === 'RESIDENTIAL' || type === 'BUS_STOP' || type === 'MOTOR_PARK')) w *= 1.8;
    if (as === 'dest' && (type === 'BUSINESS' || type === 'GOVERNMENT' || type === 'MARKET')) w *= 1.8;
  }
  if (evening) {
    if (as === 'dest' && (type === 'RESIDENTIAL' || type === 'BUS_STOP' || type === 'MOTOR_PARK')) w *= 1.8;
    if (as === 'origin' && (type === 'BUSINESS' || type === 'GOVERNMENT' || type === 'MALL')) w *= 1.8;
  }
  if (hour >= 21 || hour < 5) {
    if (type === 'HOTEL' || type === 'MALL' || type === 'RESIDENTIAL') w *= 1.5;
    if (type === 'GOVERNMENT' || type === 'SCHOOL' || type === 'BUSINESS') w *= 0.3;
  }
  return w;
}

function pickTier(rating: number, level: number): Tier {
  const roll = Math.random();
  if (rating >= 4.6 && level >= 3 && roll < 0.1) return 'VIP';
  if (rating >= 4.2 && level >= 2 && roll < 0.3) return 'PREMIUM';
  return 'STANDARD';
}

async function createOffer(user: UserDoc, vehicle: VehicleDoc, spec: VehicleSpec, world: WorldSnapshot): Promise<RideDoc | null> {
  const progress = await ensureProgress(String(user._id));
  const from = locationByKey(user.locationKey) ?? LOCATIONS[0];
  const allowed = new Set(unlockedDistricts(progress.level));
  const hour = world.clock.hour;
  const pool = LOCATIONS.filter((l) => allowed.has(l.district));

  for (let attempt = 0; attempt < 8; attempt++) {
    const origin = weightedPick(pool, (l) => {
      const d = districtById(l.district)!;
      const prox = Math.exp(-haversineKm(from.pos, l.pos) / 4.5);
      return typeWeight(l.type, hour, 'origin') * d.demand * prox;
    });
    if (!origin) return null;
    const dest = weightedPick(pool, (l) => {
      if (l.key === origin.key) return 0;
      const km = haversineKm(origin.pos, l.pos);
      if (km < 1.2) return 0;
      const d = districtById(l.district)!;
      return typeWeight(l.type, hour, 'dest') * d.demand * Math.exp(-km / 9);
    });
    if (!dest) continue;
    if (!availability(spec, origin, dest).ok) continue;
    const pickup = origin.key === from.key ? null : routeBetweenLocations(from, origin, spec, world);
    if (pickup && pickup.distanceKm > MAX_PICKUP_KM) continue;
    const route = routeBetweenLocations(origin, dest, spec, world);
    const tier = pickTier(progress.rating, progress.level);
    const groupSize =
      spec.maxGroup <= 1 ? 1 : spec.maxGroup === 2 ? (Math.random() < 0.3 ? 2 : 1) : randInt(Math.max(2, Math.floor(spec.maxGroup * 0.4)), spec.maxGroup);
    const fare = quoteFare({ distanceKm: route.distanceKm, durationMin: route.durationMin, spec, world, tier, groupSize });
    const now = Date.now();
    const bio = purposeFor(dest.type);
    const ride = await Ride.create({
      kind: 'DRIVER_OFFER',
      driver: user._id,
      npcPassenger: {
        name: groupSize > 1 ? `${npcName()} + ${groupSize - 1}` : npcName(),
        rating: npcRating(3.8, 5),
        tier,
        groupSize,
        bio,
      },
      vehicleClass: spec.cls,
      vehicle: vehicle._id,
      origin: { key: origin.key, name: origin.name, district: origin.district, lat: origin.pos[0], lng: origin.pos[1] },
      destination: { key: dest.key, name: dest.name, district: dest.district, lat: dest.pos[0], lng: dest.pos[1] },
      routeNodeIds: route.nodeIds,
      routeGeometry: route.geometry,
      pickupGeometry: pickup?.geometry ?? [from.pos, origin.pos],
      roads: route.roads,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      pickupDistanceKm: pickup?.distanceKm ?? 0,
      pickupMin: pickup?.durationMin ?? 0,
      fare: { base: fare.total, multiplier: 1, adjustment: 0, final: fare.total, tip: 0 },
      surge: fare.surge,
      weather: world.weather.kind,
      status: 'REQUESTED',
      history: [{ status: 'REQUESTED', at: new Date(now) }],
      requestedAt: new Date(now),
      expiresAt: new Date(now + OFFER_TTL_SEC * 1000),
    });
    return ride;
  }
  return null;
}

/** Keep a realistic trickle of ride offers flowing to an on-duty driver. */
export async function topUpOffers(user: UserDoc): Promise<RideDoc[]> {
  if (user.mode !== 'DRIVER') return [];
  const uid = user._id;
  const now = new Date();
  await Ride.updateMany(
    { driver: uid, kind: 'DRIVER_OFFER', status: 'REQUESTED', expiresAt: { $lt: now } },
    { $set: { status: 'CANCELLED', cancelledBy: 'SYSTEM', cancelReason: 'EXPIRED', cancelledAt: now } },
  );
  const progress = await ensureProgress(String(uid));
  const busy =
    !progress.dayActive ||
    (user.travel?.arriveAt && user.travel.arriveAt.getTime() > Date.now()) ||
    (await Ride.exists({ driver: uid, status: { $in: ['MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] } }));
  if (busy) return [];
  const vehicle = user.activeVehicleId ? await Vehicle.findById(user.activeVehicleId) : null;
  if (!vehicle || vehicle.condition < 8) return [];
  const spec = vehicleSpec(vehicle.specId)!;
  const world = getWorld();
  const live = await Ride.find({ driver: uid, kind: 'DRIVER_OFFER', status: 'REQUESTED', expiresAt: { $gte: now } }).sort({ requestedAt: -1 });

  const district = districtById(locationByKey(user.locationKey)?.district ?? '')?.demand ?? 1;
  const raw = clamp(world.demand * spec.demand * district * 1.7, 0, 4);
  const target = Math.floor(raw) + (Math.random() < raw - Math.floor(raw) ? 1 : 0);
  const newest = live[0]?.requestedAt.getTime() ?? 0;
  if (live.length < Math.max(1, target) && live.length < 4 && Date.now() - newest > MIN_SPACING_MS) {
    // At the quietest hours, sometimes nobody calls.
    if (target > 0 || Math.random() < 0.4) {
      const created = await createOffer(user, vehicle, spec, world);
      if (created) {
        live.unshift(created);
        emitToUser(String(uid), 'ride:offer', serializeRide(created, String(uid)));
      }
    }
  }
  return live;
}

export async function listOffers(user: UserDoc) {
  const offers = await topUpOffers(user);
  const uid = String(user._id);
  return offers.map((r) => serializeRide(r, uid));
}

