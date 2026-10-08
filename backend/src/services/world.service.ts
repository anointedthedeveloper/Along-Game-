import { env } from '../config/env';
import { EDGES, NODES, type RoadEdge } from '../data/world';
import { clamp, hashString, mulberry32, pick } from '../utils/rng';

/**
 * World state is a pure function of server time, so every player and every
 * server instance sees exactly the same clock, weather and incidents without
 * any shared mutable state.
 */

const GAME_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

export type Phase = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
export type WeatherKind = 'SUNNY' | 'CLOUDY' | 'RAIN' | 'HEAVY_RAIN';
export type IncidentKind = 'CONSTRUCTION' | 'CLOSURE' | 'ACCIDENT' | 'FLOOD';

export interface GameClock {
  totalMinutes: number;
  day: number;
  minuteOfDay: number;
  hour: number;
  minute: number;
  label: string;
  phase: Phase;
  /** 0 (dark) .. 1 (full daylight) */
  daylight: number;
  speed: number;
}

export interface Weather {
  kind: WeatherKind;
  label: string;
  /** Multiplier on road speed. */
  speedFactor: number;
  /** Added to traffic level (0..1). */
  trafficAdd: number;
  /** Multiplier on passenger demand. */
  demandFactor: number;
  fareFactor: number;
  intensity: number;
}

export interface Incident {
  id: string;
  kind: IncidentKind;
  edgeId: string;
  label: string;
  roadName: string;
  pos: [number, number];
  speedFactor: number;
  blocked: boolean;
}

export interface WorldSnapshot {
  serverTime: number;
  clock: GameClock;
  weather: Weather;
  /** 0..1 congestion across the city. */
  traffic: number;
  /** Multiplier on passenger demand. */
  demand: number;
  surge: number;
  fuelPrice: number;
  fuelShortage: boolean;
  incidents: Incident[];
}

export const gameMinutesNow = (now = Date.now()): number =>
  Math.floor(((now - GAME_EPOCH_MS) / 1000) * env.gameSpeed);

export function clockAt(totalMinutes: number): GameClock {
  const minuteOfDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const h = minuteOfDay / 60;
  const phase: Phase = h >= 5 && h < 12 ? 'MORNING' : h >= 12 && h < 17 ? 'AFTERNOON' : h >= 17 && h < 20 ? 'EVENING' : 'NIGHT';
  const smooth = (e0: number, e1: number, x: number) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const daylight = smooth(5.6, 7.2, h) * (1 - smooth(17.8, 19.6, h));
  return {
    totalMinutes,
    day: Math.floor(totalMinutes / 1440) + 1,
    minuteOfDay,
    hour,
    minute,
    label: `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`,
    phase,
    daylight,
    speed: env.gameSpeed,
  };
}

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

/** Passenger demand: commuter peaks in the morning and evening, quiet nights. */
export function demandAt(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  return clamp(0.3 + 1.3 * gauss(h, 7.6, 1.3) + 0.55 * gauss(h, 12.8, 2.2) + 1.5 * gauss(h, 17.6, 1.6) + 0.45 * gauss(h, 21, 1.5), 0.3, 1.9);
}

export function trafficAt(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  return clamp(0.12 + 0.72 * gauss(h, 7.9, 1.2) + 0.3 * gauss(h, 12.8, 1.6) + 0.8 * gauss(h, 17.8, 1.5), 0, 1);
}

const WEATHER: Record<WeatherKind, Omit<Weather, 'kind'>> = {
  SUNNY: { label: 'Sunny', speedFactor: 1, trafficAdd: 0, demandFactor: 1, fareFactor: 1, intensity: 0 },
  CLOUDY: { label: 'Cloudy', speedFactor: 0.98, trafficAdd: 0.02, demandFactor: 1, fareFactor: 1, intensity: 0.2 },
  RAIN: { label: 'Rain', speedFactor: 0.82, trafficAdd: 0.18, demandFactor: 1.2, fareFactor: 1.1, intensity: 0.6 },
  HEAVY_RAIN: { label: 'Heavy rain', speedFactor: 0.6, trafficAdd: 0.34, demandFactor: 1.35, fareFactor: 1.25, intensity: 1 },
};

const WEATHER_BLOCK_MIN = 150;

export function weatherAt(totalMinutes: number): Weather {
  const block = Math.floor(totalMinutes / WEATHER_BLOCK_MIN);
  const day = Math.floor(totalMinutes / 1440);
  const rng = mulberry32(hashString(`weather:${block}`));
  const wetSeason = day % 40 < 22;
  const hour = ((totalMinutes % 1440) / 60) | 0;
  const afternoonBias = hour >= 14 && hour < 20 ? 0.15 : 0;
  const wet = (wetSeason ? 0.42 : 0.14) + afternoonBias;
  const r = rng();
  let kind: WeatherKind;
  if (r < wet * 0.3) kind = 'HEAVY_RAIN';
  else if (r < wet) kind = 'RAIN';
  else if (r < wet + 0.28) kind = 'CLOUDY';
  else kind = 'SUNNY';
  return { kind, ...WEATHER[kind] };
}

export function fuelPriceAt(totalMinutes: number): { price: number; shortage: boolean } {
  const day = Math.floor(totalMinutes / 1440);
  const rng = mulberry32(hashString(`fuel:${day}`));
  const drift = 1 + (rng() - 0.5) * 0.12;
  const shortage = rng() < 0.12;
  return { price: Math.round((897 * drift * (shortage ? 1.25 : 1)) / 5) * 5, shortage };
}

const EDGE_BY_ID = new Map(EDGES.map((e) => [e.id, e]));

function connectedWithout(blocked: Set<string>): boolean {
  const adj = new Map<string, string[]>();
  for (const n of NODES) adj.set(n.id, []);
  for (const e of EDGES) {
    if (blocked.has(e.id)) continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  const seen = new Set<string>([NODES[0].id]);
  const stack = [NODES[0].id];
  while (stack.length) {
    for (const nb of adj.get(stack.pop()!)!) {
      if (!seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === NODES.length;
}

const INCIDENT_BLOCK_MIN = 120;

export function incidentsAt(totalMinutes: number, weather: Weather): Incident[] {
  const block = Math.floor(totalMinutes / INCIDENT_BLOCK_MIN);
  const rng = mulberry32(hashString(`incidents:${block}`));
  const count = rng() < 0.2 ? 0 : 1 + Math.floor(rng() * 3);
  const chosen = new Set<string>();
  const blocked = new Set<string>();
  const out: Incident[] = [];
  for (let i = 0; i < count; i++) {
    const edge: RoadEdge = pick(EDGES, rng);
    if (chosen.has(edge.id)) continue;
    chosen.add(edge.id);
    const raining = weather.kind === 'RAIN' || weather.kind === 'HEAVY_RAIN';
    const roll = rng();
    let kind: IncidentKind;
    if (raining && edge.cls !== 'EXPRESSWAY' && roll < 0.4) kind = 'FLOOD';
    else if (roll < 0.45) kind = 'CONSTRUCTION';
    else if (roll < 0.75) kind = 'ACCIDENT';
    else kind = 'CLOSURE';
    if (kind === 'CLOSURE') {
      const next = new Set(blocked).add(edge.id);
      if (!connectedWithout(next)) kind = 'CONSTRUCTION';
      else blocked.add(edge.id);
    }
    const mid = edge.geometry[Math.floor(edge.geometry.length / 2)];
    const meta: Record<IncidentKind, { label: string; speed: number }> = {
      CONSTRUCTION: { label: 'Road construction', speed: 0.5 },
      CLOSURE: { label: 'Road closed', speed: 0 },
      ACCIDENT: { label: 'Accident causing traffic', speed: 0.35 },
      FLOOD: { label: 'Flooded road', speed: 0.4 },
    };
    out.push({
      id: `${block}:${edge.id}`,
      kind,
      edgeId: edge.id,
      label: meta[kind].label,
      roadName: edge.name,
      pos: [mid[0], mid[1]],
      speedFactor: meta[kind].speed,
      blocked: kind === 'CLOSURE',
    });
  }
  return out;
}

export function getWorld(now = Date.now()): WorldSnapshot {
  const minutes = gameMinutesNow(now);
  const clock = clockAt(minutes);
  const weather = weatherAt(minutes);
  const traffic = clamp(trafficAt(clock.minuteOfDay) + weather.trafficAdd, 0, 1);
  const demand = clamp(demandAt(clock.minuteOfDay) * weather.demandFactor, 0.3, 2.2);
  const fuel = fuelPriceAt(minutes);
  return {
    serverTime: now,
    clock,
    weather,
    traffic,
    demand,
    surge: clamp(1 + (demand - 1) * 0.22, 0.92, 1.45),
    fuelPrice: fuel.price,
    fuelShortage: fuel.shortage,
    incidents: incidentsAt(minutes, weather),
  };
}

export const incidentEdge = (id: string): RoadEdge | undefined => EDGE_BY_ID.get(id);

/** Real seconds that a number of in-game minutes takes. */
export const gameMinToSeconds = (min: number): number => min / env.gameSpeed;
