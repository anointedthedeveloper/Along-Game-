import { create } from 'zustand';
import { ApiError } from '@/lib/api';
import { gameApi, rideApi, worldApi } from '@/services';
import { toast } from './toast';
import type { CompleteSummary, GameStateResponse, MapData, Progress, Ride, Vehicle, World } from '@/types';

export interface RideSummary {
  ride: Ride;
  summary: CompleteSummary;
}

interface GameStore {
  map: MapData | null;
  mapError: string | null;
  world: World | null;
  /** Local receive time of the last world snapshot, used to extrapolate the clock. */
  worldReceivedAt: number;
  skew: number;
  me: GameStateResponse['me'] | null;
  progress: Progress | null;
  vehicle: Vehicle | null;
  ride: Ride | null;
  offers: Ride[];
  summary: RideSummary | null;
  loading: boolean;
  error: string | null;

  loadMap: () => Promise<void>;
  refresh: () => Promise<void>;
  setWorld: (w: World) => void;
  setRide: (r: Ride | null) => void;
  setVehicle: (v: Vehicle) => void;
  setBalances: (cash: number, bank: number) => void;
  setProgress: (p: Progress) => void;
  loadOffers: () => Promise<void>;
  addOffer: (r: Ride) => void;
  removeOffer: (id: string) => void;
  showSummary: (s: RideSummary | null) => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  map: null,
  mapError: null,
  world: null,
  worldReceivedAt: 0,
  skew: 0,
  me: null,
  progress: null,
  vehicle: null,
  ride: null,
  offers: [],
  summary: null,
  loading: false,
  error: null,

  loadMap: async () => {
    if (get().map) return;
    try {
      set({ map: await worldApi.map(), mapError: null });
    } catch (e) {
      set({ mapError: e instanceof ApiError ? e.message : 'Could not load the city map' });
    }
  },

  refresh: async () => {
    set({ loading: get().me === null });
    try {
      const [state, active] = await Promise.all([gameApi.state(), rideApi.active()]);
      get().setWorld(state.world);
      set({ me: state.me, progress: state.progress, vehicle: state.vehicle, ride: active.ride, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: e instanceof ApiError ? e.message : 'Could not load your game' });
    }
  },

  setWorld: (world) => set({ world, worldReceivedAt: Date.now(), skew: world.serverTime - Date.now() }),
  setRide: (ride) => set({ ride }),
  setVehicle: (vehicle) => set({ vehicle }),
  setBalances: (cash, bank) => set((s) => (s.me ? { me: { ...s.me, cash, bank } } : s)),
  setProgress: (progress) => set({ progress }),

  loadOffers: async () => {
    try {
      const { offers } = await rideApi.offers();
      set({ offers });
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) toast.error(e.message);
    }
  },
  addOffer: (r) => set((s) => (s.offers.some((o) => o.id === r.id) ? s : { offers: [...s.offers, r].slice(-4) })),
  removeOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id) })),
  showSummary: (summary) => set({ summary }),
  reset: () => set({ me: null, progress: null, vehicle: null, ride: null, offers: [], summary: null, error: null }),
}));

/** Smoothly extrapolated in-game minutes since midnight, computed from the last server snapshot. */
export function currentMinuteOfDay(): number {
  const { world, worldReceivedAt } = useGame.getState();
  if (!world) return 8 * 60;
  const elapsed = (Date.now() - worldReceivedAt) / 1000;
  return (((world.clock.minuteOfDay + elapsed * world.clock.speed) % 1440) + 1440) % 1440;
}

export function formatClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = Math.floor(minuteOfDay % 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 0 (night) .. 1 (day), mirrors the backend so visuals and gameplay agree. */
export function daylightAt(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return smooth(5.6, 7.2, h) * (1 - smooth(17.8, 19.6, h));
}
