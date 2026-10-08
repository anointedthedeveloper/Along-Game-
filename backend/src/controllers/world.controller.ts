import type { Request, Response } from 'express';
import { DISTRICTS, EDGES, LOCATIONS, NODES, ROADS } from '../data/world';
import { vehicleSpec } from '../data/vehicles';
import { Location } from '../models';
import { me } from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import * as game from '../services/game.service';
import { LEVELS, ensureProgress, serializeProgress } from '../services/progress.service';
import { routeBetweenKeys } from '../services/routing.service';
import { getWorld } from '../services/world.service';
import { PlayerProgress } from '../models';

export const snapshot = (_req: Request, res: Response) => res.json({ world: getWorld() });

export const map = (_req: Request, res: Response) => {
  res.json({
    districts: DISTRICTS,
    nodes: NODES,
    roads: ROADS.map((r) => ({ id: r.id, name: r.name, cls: r.cls })),
    edges: EDGES.map((e) => ({ id: e.id, roadId: e.roadId, name: e.name, cls: e.cls, from: e.from, to: e.to, geometry: e.geometry, km: e.km })),
    locations: LOCATIONS,
    levels: LEVELS,
  });
};

export const route = (req: Request, res: Response) => {
  const q = req.query as { from: string; to: string; vehicle: string };
  const spec = vehicleSpec(q.vehicle);
  if (!spec) throw ApiError.badRequest('Unknown vehicle');
  const { route } = routeBetweenKeys(q.from, q.to, spec, getWorld());
  res.json({ route: { ...route, distanceKm: Math.round(route.distanceKm * 10) / 10, durationMin: Math.round(route.durationMin) } });
};

export const locations = async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.type === 'string') filter.type = req.query.type;
  if (typeof req.query.district === 'string') filter.district = req.query.district;
  const items = await Location.find(filter).sort({ district: 1, name: 1 });
  res.json({ locations: items.map((l) => ({ key: l.key, name: l.name, type: l.type, district: l.district, lat: l.lat, lng: l.lng, description: l.description })) });
};

export const state = async (req: Request, res: Response) => res.json(await game.gameState(me(req)));
export const checklist = async (req: Request, res: Response) => res.json(await game.dayChecklist(me(req)));
export const startDay = async (req: Request, res: Response) => res.json(await game.startDay(me(req)));
export const endDay = async (req: Request, res: Response) => res.json(await game.endDay(me(req)));
export const travel = async (req: Request, res: Response) => res.json(await game.travelTo(me(req), req.body.toKey));
export const setLocation = async (req: Request, res: Response) => {
  await game.setPassengerLocation(me(req), req.body.locationKey);
  res.json({ locationKey: me(req).locationKey });
};
export const progress = async (req: Request, res: Response) => res.json({ progress: serializeProgress(await ensureProgress(String(me(req)._id))) });

export const leaderboard = async (_req: Request, res: Response) => {
  const rows = await PlayerProgress.find({ ridesAsDriver: { $gt: 0 } }).sort({ totalEarnings: -1 }).limit(10).populate<{ user: { name: string } }>('user', 'name');
  res.json({
    leaders: rows.map((p, i) => ({ rank: i + 1, name: p.user?.name ?? 'Driver', level: p.level, rating: p.rating, rides: p.ridesAsDriver, totalEarnings: p.totalEarnings })),
  });
};
