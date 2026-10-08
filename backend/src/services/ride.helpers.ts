import { Ride, type RideDoc } from '../models';
import type { RideStatus } from '../models/Ride';
import { gameMinToSeconds, getWorld } from './world.service';
import { emitToUser } from './socket.service';

export const LIVE_STATUSES: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS'];
export const OFFER_TTL_SEC = 30;
/** A requested passenger ride is matched with a driver after this long. */
export const MATCH_AFTER_SEC = 2.5;
export const ARRIVING_AFTER_SEC = 5;
/** Clients may complete a leg slightly early to absorb animation/latency differences. */
export const TIMING_TOLERANCE = 0.9;

export const pickupSeconds = (ride: Pick<RideDoc, 'pickupMin'>): number => gameMinToSeconds(ride.pickupMin);
export const tripSeconds = (ride: Pick<RideDoc, 'durationMin' | 'delayMin'>): number => gameMinToSeconds(ride.durationMin + ride.delayMin);

function push(ride: RideDoc, status: RideStatus, at: Date): void {
  ride.status = status;
  ride.history.push({ status, at });
}

/**
 * Passenger requests are matched and dispatched purely by elapsed time. Calling
 * this is idempotent and cheap, so it runs on every read as well as from timers.
 */
export async function advanceRide(ride: RideDoc): Promise<RideDoc> {
  if (ride.kind !== 'PASSENGER_REQUEST') return ride;
  let changed = false;
  const age = (Date.now() - ride.requestedAt.getTime()) / 1000;
  if (ride.status === 'REQUESTED' && age >= MATCH_AFTER_SEC) {
    ride.matchedAt = new Date(ride.requestedAt.getTime() + MATCH_AFTER_SEC * 1000);
    push(ride, 'MATCHED', ride.matchedAt);
    changed = true;
  }
  if (ride.status === 'MATCHED' && age >= ARRIVING_AFTER_SEC) {
    ride.arrivingAt = new Date(ride.requestedAt.getTime() + ARRIVING_AFTER_SEC * 1000);
    push(ride, 'DRIVER_ARRIVING', ride.arrivingAt);
    changed = true;
  }
  if (changed) {
    await ride.save();
    if (ride.passenger) emitToUser(String(ride.passenger), 'ride:update', serializeRide(ride, String(ride.passenger)));
  }
  return ride;
}

export function scheduleAdvance(rideId: string): void {
  const run = (delayMs: number) =>
    setTimeout(() => {
      Ride.findById(rideId)
        .then((r) => (r ? advanceRide(r) : null))
        .catch((e) => console.error('[ride] advance failed', e));
    }, delayMs);
  run(MATCH_AFTER_SEC * 1000 + 50);
  run(ARRIVING_AFTER_SEC * 1000 + 50);
}

export function serializeRide(ride: RideDoc, viewerId: string) {
  const isDriver = ride.driver ? String(ride.driver) === viewerId : false;
  const world = getWorld();
  return {
    id: String(ride._id),
    kind: ride.kind,
    status: ride.status,
    role: isDriver ? ('DRIVER' as const) : ('PASSENGER' as const),
    vehicleClass: ride.vehicleClass,
    vehicleId: ride.vehicle ? String(ride.vehicle) : null,
    origin: ride.origin,
    destination: ride.destination,
    distanceKm: Math.round(ride.distanceKm * 10) / 10,
    durationMin: Math.round(ride.durationMin),
    pickupDistanceKm: Math.round(ride.pickupDistanceKm * 10) / 10,
    pickupMin: Math.round(ride.pickupMin),
    fare: ride.fare,
    surge: Math.round(ride.surge * 100) / 100,
    weather: ride.weather,
    npcPassenger: ride.npcPassenger,
    npcDriver: ride.npcDriver,
    history: ride.history,
    requestedAt: ride.requestedAt,
    matchedAt: ride.matchedAt ?? null,
    arrivingAt: ride.arrivingAt ?? null,
    startedAt: ride.startedAt ?? null,
    completedAt: ride.completedAt ?? null,
    cancelledAt: ride.cancelledAt ?? null,
    expiresAt: ride.expiresAt ?? null,
    cancelledBy: ride.cancelledBy ?? null,
    cancelReason: ride.cancelReason ?? null,
    delayMin: ride.delayMin,
    paid: ride.paid,
    paymentMethod: ride.paymentMethod,
    rating: ride.rating ?? null,
    late: ride.late,
    xpAwarded: ride.xpAwarded,
    roads: ride.roads,
    geometry: ride.routeGeometry,
    pickupGeometry: ride.pickupGeometry,
    eventNotes: ride.eventNotes,
    timing: {
      serverNow: Date.now(),
      pickupSeconds: pickupSeconds(ride),
      tripSeconds: tripSeconds(ride),
      gameSpeed: world.clock.speed,
    },
  };
}
