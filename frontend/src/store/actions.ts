import { ApiError } from '@/lib/api';
import { eventApi, gameApi, rideApi } from '@/services';
import { useGame } from './game';
import { toast } from './toast';
import type { GameStateResponse, Vehicle } from '@/types';

/**
 * Player-initiated game actions. The server decides everything; these only call
 * the API, surface errors, and merge the authoritative response into the store.
 */

const fail = (e: unknown): false => {
  toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
  return false;
};

const g = () => useGame.getState();

export async function acceptOffer(id: string): Promise<boolean> {
  try {
    const { ride } = await rideApi.accept(id);
    g().removeOffer(id);
    g().setRide(ride);
    g().offers.forEach((o) => g().removeOffer(o.id));
    return true;
  } catch (e) {
    g().removeOffer(id);
    void g().loadOffers();
    return fail(e);
  }
}

export async function declineOffer(id: string): Promise<void> {
  g().removeOffer(id);
  try {
    await rideApi.decline(id);
  } catch {
    /* the offer already expired — nothing to undo */
  }
}

export async function startRide(id: string): Promise<boolean> {
  try {
    const { ride } = await rideApi.start(id);
    g().setRide(ride);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'TOO_EARLY') {
      const wait = (e.details as { retryAfterMs?: number } | undefined)?.retryAfterMs ?? 500;
      await new Promise((r) => setTimeout(r, Math.min(wait + 60, 4000)));
      return startRide(id);
    }
    return fail(e);
  }
}

/** Completes the trip. Retries briefly if the server says we are a hair early. */
export async function completeRide(id: string, attempt = 0): Promise<boolean> {
  try {
    const { ride, summary } = await rideApi.complete(id);
    g().setRide(null);
    g().showSummary({ ride, summary });
    await g().refresh();
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'TOO_EARLY' && attempt < 8) {
      const wait = (e.details as { retryAfterMs?: number } | undefined)?.retryAfterMs ?? 400;
      await new Promise((r) => setTimeout(r, Math.min(wait + 80, 3000)));
      return completeRide(id, attempt + 1);
    }
    if (e instanceof ApiError && e.code === 'EVENT_PENDING') {
      const { ride } = await rideApi.get(id);
      g().setRide(ride);
      return false;
    }
    if (e instanceof ApiError && e.code === 'INSUFFICIENT_FUNDS') {
      toast.error(`${e.message}. Withdraw from your bank in the wallet, then continue.`);
      return false;
    }
    return fail(e);
  }
}

export async function cancelRide(id: string): Promise<boolean> {
  try {
    const { fee } = await rideApi.cancel(id);
    g().setRide(null);
    if (fee > 0) toast.warn(`Cancellation fee: ₦${fee.toLocaleString('en-NG')}`);
    await g().refresh();
    return true;
  } catch (e) {
    return fail(e);
  }
}

export async function resolveEvent(eventId: string, optionId: string) {
  try {
    return await eventApi.resolve(eventId, optionId);
  } catch (e) {
    fail(e);
    return null;
  }
}

/** Merge the server's verdict into the store after the player has seen the outcome. */
export function applyEventResult(res: NonNullable<Awaited<ReturnType<typeof resolveEvent>>>): void {
  if (res.applied.cancelled) g().setRide(null);
  else g().setRide(res.ride);
  void g().refresh();
}

export async function startDay(): Promise<boolean> {
  try {
    const { progress } = await gameApi.startDay();
    g().setProgress(progress);
    void g().loadOffers();
    toast.success('Your day has started. Good luck out there.');
    return true;
  } catch (e) {
    return fail(e);
  }
}

export async function endDay() {
  try {
    const res = await gameApi.endDay();
    g().setProgress(res.progress);
    useGame.setState({ offers: [] });
    return res;
  } catch (e) {
    fail(e);
    return null;
  }
}

export async function travelTo(toKey: string) {
  try {
    const res = await gameApi.travel(toKey);
    useGame.setState((s) => ({ me: s.me ? { ...s.me, travel: res.travel } : s.me, vehicle: res.vehicle }));
    return res;
  } catch (e) {
    fail(e);
    return null;
  }
}

export function applyVehicle(v: Vehicle) {
  g().setVehicle(v);
}

export function applyMe(patch: Partial<GameStateResponse['me']>) {
  useGame.setState((s) => (s.me ? { me: { ...s.me, ...patch } } : s));
}
