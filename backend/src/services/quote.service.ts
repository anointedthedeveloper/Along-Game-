import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { LOCATIONS, districtById, locationByKey, type LocationDef } from '../data/world';
import { VEHICLES, type VehicleSpec } from '../data/vehicles';
import type { UserDoc } from '../models';
import { ApiError } from '../utils/ApiError';
import { hashString, mulberry32, pick } from '../utils/rng';
import { quoteFare } from './fare.service';
import { npcName, plate, purposeFor } from './npc.service';
import { routeBetweenLocations } from './routing.service';
import { getWorld, type WorldSnapshot } from './world.service';

export interface QuoteOption {
  optionId: string;
  specId: string;
  vehicleClass: string;
  vehicleName: string;
  available: boolean;
  reason?: string;
  fare: number;
  surge: number;
  etaMin: number;
  distanceKm: number;
  durationMin: number;
  driver: { name: string; rating: number; trips: number; plate: string; color: string; bio: string };
  comfort: number;
  capacity: number;
  quoteToken?: string;
}

export interface QuotePayload {
  purpose: 'ride-quote';
  uid: string;
  originKey: string;
  destinationKey: string;
  specId: string;
  driver: QuoteOption['driver'];
  fare: number;
  surge: number;
  distanceKm: number;
  durationMin: number;
  pickupMin: number;
  pickupDistanceKm: number;
  roads: string[];
  startKey: string;
  routeNodeIds: string[];
  weather: string;
}

const QUOTE_TTL_SEC = 120;

export function availability(spec: VehicleSpec, origin: LocationDef, dest: LocationDef): { ok: boolean; reason?: string } {
  const bad = [origin, dest].find((l) => spec.restrictedDistricts.includes(l.district));
  if (bad) return { ok: false, reason: `${spec.name.split(' ')[0]}s are not allowed in ${districtById(bad.district)?.name ?? 'this district'}` };
  if (spec.onlyDistricts) {
    const out = [origin, dest].find((l) => !spec.onlyDistricts!.includes(l.district));
    if (out) return { ok: false, reason: `Only operates in ${spec.onlyDistricts.map((d) => districtById(d)?.name).join(', ')}` };
  }
  return { ok: true };
}

/** A believable driver waiting somewhere near the pickup point. */
function nearbyStart(origin: LocationDef, rng: () => number): LocationDef {
  const near = LOCATIONS.filter((l) => l.key !== origin.key && l.district === origin.district);
  const pool = near.length ? near : LOCATIONS.filter((l) => l.key !== origin.key);
  return pick(pool, rng);
}

export function buildQuote(user: UserDoc, originKey: string, destinationKey: string, world: WorldSnapshot = getWorld()) {
  const origin = locationByKey(originKey);
  const dest = locationByKey(destinationKey);
  if (!origin || !dest) throw ApiError.notFound('Unknown location');
  if (origin.key === dest.key) throw ApiError.badRequest('Choose a different destination');
  const bucket = Math.floor(Date.now() / 30_000);
  const options: QuoteOption[] = [];
  for (const spec of VEHICLES) {
    const avail = availability(spec, origin, dest);
    const rng = mulberry32(hashString(`${user._id}|${originKey}|${destinationKey}|${spec.id}|${bucket}`));
    const route = routeBetweenLocations(origin, dest, spec, world);
    const start = nearbyStart(origin, rng);
    const pickup = routeBetweenLocations(start, origin, spec, world);
    const supplyPenalty = 1 + Math.max(0, world.demand - spec.demand) * 0.6;
    const etaMin = Math.max(2, Math.round(pickup.durationMin * supplyPenalty));
    const fare = quoteFare({ distanceKm: route.distanceKm, durationMin: route.durationMin, spec, world });
    const rating = Math.round((3.9 + rng() * 1.05) * 10) / 10;
    const driver = {
      name: npcName(rng),
      rating: Math.min(5, rating),
      trips: Math.floor(120 + rng() * 2600),
      plate: plate(rng),
      color: pick(spec.colors, rng),
      bio: purposeFor('DISTRICT', rng) && pick(['Knows the shortcuts', 'Quiet and professional', 'Plays gospel music softly', 'Always has change', 'Chatty and friendly', 'AC always on'], rng),
    };
    const option: QuoteOption = {
      optionId: `${spec.id}`,
      specId: spec.id,
      vehicleClass: spec.cls,
      vehicleName: spec.name,
      available: avail.ok,
      reason: avail.reason,
      fare: fare.perPerson,
      surge: Math.round(fare.surge * 100) / 100,
      etaMin,
      distanceKm: Math.round(route.distanceKm * 10) / 10,
      durationMin: Math.round(route.durationMin),
      driver,
      comfort: spec.comfort,
      capacity: spec.capacity,
    };
    if (avail.ok) {
      const payload: QuotePayload = {
        purpose: 'ride-quote',
        uid: String(user._id),
        originKey,
        destinationKey,
        specId: spec.id,
        driver,
        fare: fare.perPerson,
        surge: fare.surge,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        pickupMin: etaMin,
        pickupDistanceKm: pickup.distanceKm,
        roads: route.roads,
        startKey: start.key,
        routeNodeIds: route.nodeIds,
        weather: world.weather.kind,
      };
      option.quoteToken = jwt.sign(payload, env.jwtSecret, { expiresIn: QUOTE_TTL_SEC });
    }
    options.push(option);
  }
  options.sort((a, b) => Number(b.available) - Number(a.available) || a.fare - b.fare);
  const reference = routeBetweenLocations(origin, dest, VEHICLES[2], world);
  return {
    origin,
    destination: dest,
    distanceKm: Math.round(reference.distanceKm * 10) / 10,
    roads: reference.roads,
    geometry: reference.geometry,
    expiresInSec: QUOTE_TTL_SEC,
    options,
    world: { weather: world.weather.kind, traffic: world.traffic, surge: world.surge },
  };
}

export function verifyQuote(token: string, userId: string): QuotePayload {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as QuotePayload;
    if (payload.purpose !== 'ride-quote' || payload.uid !== userId) throw new Error('mismatch');
    return payload;
  } catch {
    throw ApiError.conflict('This price has expired. Please check fares again.', 'QUOTE_EXPIRED');
  }
}
