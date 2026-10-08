import { EDGES, NODES, locationByKey, type LocationDef, type RoadClass, type RoadEdge } from '../data/world';
import type { VehicleSpec } from '../data/vehicles';
import { haversineKm, type LatLng } from '../utils/geo';
import { ApiError } from '../utils/ApiError';
import type { WorldSnapshot } from './world.service';

const ROAD_SPEED: Record<RoadClass, number> = { EXPRESSWAY: 80, ARTERIAL: 50, LOCAL: 30 };
const TRAFFIC_SENSITIVITY: Record<RoadClass, number> = { EXPRESSWAY: 0.55, ARTERIAL: 0.9, LOCAL: 1 };
const JUNCTION_PENALTY_MIN = 0.4;

export interface RouteResult {
  nodeIds: string[];
  edgeIds: string[];
  roads: string[];
  geometry: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** Incident ids that sit on this route. */
  incidentIds: string[];
}

interface Adjacent {
  to: string;
  edge: RoadEdge;
  reversed: boolean;
}

const adjacency = new Map<string, Adjacent[]>();
for (const n of NODES) adjacency.set(n.id, []);
for (const e of EDGES) {
  adjacency.get(e.from)!.push({ to: e.to, edge: e, reversed: false });
  adjacency.get(e.to)!.push({ to: e.from, edge: e, reversed: true });
}
const nodePos = new Map(NODES.map((n) => [n.id, n.pos] as const));

function edgeMinutes(edge: RoadEdge, spec: VehicleSpec, world: WorldSnapshot, incidentFactor: number): number {
  const vehicleSpeed = spec.speedKph * 0.8;
  const base = Math.min(ROAD_SPEED[edge.cls], vehicleSpeed);
  const congestion = 1 - 0.55 * world.traffic * TRAFFIC_SENSITIVITY[edge.cls];
  const speed = Math.max(4, base * world.weather.speedFactor * congestion * incidentFactor);
  return (edge.km / speed) * 60 + JUNCTION_PENALTY_MIN;
}

export function routeBetweenNodes(fromNode: string, toNode: string, spec: VehicleSpec, world: WorldSnapshot): RouteResult {
  const incidentByEdge = new Map(world.incidents.map((i) => [i.edgeId, i]));
  const dist = new Map<string, number>([[fromNode, 0]]);
  const prev = new Map<string, { node: string; adj: Adjacent }>();
  const open = new Set<string>([fromNode]);
  while (open.size) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of open) {
      const d = dist.get(id)!;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) break;
    open.delete(current);
    if (current === toNode) break;
    for (const adj of adjacency.get(current)!) {
      const incident = incidentByEdge.get(adj.edge.id);
      if (incident?.blocked) continue;
      const cost = edgeMinutes(adj.edge, spec, world, incident ? incident.speedFactor : 1);
      const nd = best + cost;
      if (nd < (dist.get(adj.to) ?? Infinity)) {
        dist.set(adj.to, nd);
        prev.set(adj.to, { node: current, adj });
        open.add(adj.to);
      }
    }
  }
  if (fromNode !== toNode && !prev.has(toNode)) throw ApiError.conflict('No route is currently available between those places', 'NO_ROUTE');

  const steps: Adjacent[] = [];
  const nodeIds: string[] = [toNode];
  for (let cur = toNode; cur !== fromNode; ) {
    const p = prev.get(cur)!;
    steps.unshift(p.adj);
    nodeIds.unshift(p.node);
    cur = p.node;
  }
  let geometry: LatLng[] = [];
  let distanceKm = 0;
  let durationMin = 0;
  const roads: string[] = [];
  const incidentIds: string[] = [];
  for (const step of steps) {
    const pts = step.reversed ? [...step.edge.geometry].reverse() : step.edge.geometry;
    geometry = geometry.length ? geometry.concat(pts.slice(1)) : pts.slice();
    distanceKm += step.edge.km;
    const incident = incidentByEdge.get(step.edge.id);
    durationMin += edgeMinutes(step.edge, spec, world, incident ? incident.speedFactor : 1);
    if (!roads.includes(step.edge.name)) roads.push(step.edge.name);
    if (incident) incidentIds.push(incident.id);
  }
  if (!steps.length) geometry = [nodePos.get(fromNode)!];
  return { nodeIds, edgeIds: steps.map((s) => s.edge.id), roads, geometry, distanceKm, durationMin, incidentIds };
}

/** Route between two places, including the short walk/drive from the place to its nearest junction. */
export function routeBetweenLocations(a: LocationDef, b: LocationDef, spec: VehicleSpec, world: WorldSnapshot): RouteResult {
  const core = routeBetweenNodes(a.nodeId, b.nodeId, spec, world);
  const first = haversineKm(a.pos, nodePos.get(a.nodeId)!);
  const last = haversineKm(nodePos.get(b.nodeId)!, b.pos);
  const extra = first + last;
  const slow = 22 * world.weather.speedFactor;
  const geometry: LatLng[] = [a.pos, ...core.geometry, b.pos];
  return {
    ...core,
    geometry,
    distanceKm: Math.max(0.3, core.distanceKm + extra),
    durationMin: Math.max(2, core.durationMin + (extra / slow) * 60),
  };
}

export function routeBetweenKeys(fromKey: string, toKey: string, spec: VehicleSpec, world: WorldSnapshot): { from: LocationDef; to: LocationDef; route: RouteResult } {
  const from = locationByKey(fromKey);
  const to = locationByKey(toKey);
  if (!from || !to) throw ApiError.notFound('Unknown location');
  return { from, to, route: routeBetweenLocations(from, to, spec, world) };
}

export const incidentsOnRoute = (route: RouteResult, world: WorldSnapshot) =>
  world.incidents.filter((i) => route.edgeIds.includes(i.edgeId));
