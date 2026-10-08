import type { MapData, RoadEdge } from '@/types';
import { CITY_CENTER, M_PER_PX0, cumulative, mToPx0, offsetPath, toWorld, type Pt } from './projection';

/**
 * Procedural city. The road network comes from the server; blocks, buildings,
 * trees, parks and water are generated deterministically from it so every
 * player sees the same city.
 */

export interface Building {
  /** Footprint corners (zoom-0 px). */
  pts: [Pt, Pt, Pt, Pt];
  /** Height in metres. */
  h: number;
  wall: string;
  roof: string;
  /** Bounding box (zoom-0 px). */
  bb: [number, number, number, number];
}

export interface RoadSeg {
  id: string;
  name: string;
  cls: RoadEdge['cls'];
  pts: Pt[];
  cum: number[];
  /** Lane marking offsets (zoom-0 px) */
  left: Pt[];
  right: Pt[];
  bb: [number, number, number, number];
}

export interface Blob { x: number; y: number; r: number; color: string; kind: string }
export interface Tree { x: number; y: number; r: number; tone: number; bb: [number, number, number, number] }

export interface Scene {
  roads: RoadSeg[];
  streets: Array<{ pts: Pt[]; bb: [number, number, number, number] }>;
  buildings: Building[];
  trees: Tree[];
  parks: Array<{ pts: Pt[]; bb: [number, number, number, number] }>;
  water: Array<{ pts: Pt[]; bb: [number, number, number, number] }>;
  roundabouts: Array<{ x: number; y: number; r: number }>;
  lights: Pt[];
  blobs: Blob[];
  grids: { buildings: SpatialGrid; trees: SpatialGrid; streets: SpatialGrid; roads: SpatialGrid };
}

export const ROAD_WIDTH_M: Record<RoadEdge['cls'], number> = { EXPRESSWAY: 26, ARTERIAL: 17, LOCAL: 9 };

function rng32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bbOf = (pts: Pt[]): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

/** Uniform grid in zoom-0 px for fast tile queries. */
export class SpatialGrid {
  private cells = new Map<number, number[]>();
  constructor(private size: number, private items: Array<{ bb: [number, number, number, number] }>) {
    items.forEach((it, i) => {
      const [x0, y0, x1, y1] = it.bb;
      for (let cx = Math.floor(x0 / size); cx <= Math.floor(x1 / size); cx++)
        for (let cy = Math.floor(y0 / size); cy <= Math.floor(y1 / size); cy++) {
          const k = cx * 100003 + cy;
          (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(i);
        }
    });
  }
  query(x0: number, y0: number, x1: number, y1: number): number[] {
    const out = new Set<number>();
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++)
      for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) {
        const list = this.cells.get(cx * 100003 + cy);
        if (list) for (const i of list) out.add(i);
      }
    return [...out].filter((i) => {
      const b = this.items[i].bb;
      return b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1;
    });
  }
}

const PALETTES: Record<string, { walls: string[]; roofs: string[]; tall: number; fill: number }> = {
  COMMERCIAL: { walls: ['#d9d2c3', '#e8e3d8', '#cfc7b6', '#bfc7cc'], roofs: ['#b8b2a6', '#a9b0b4', '#c9c4b8', '#9fa8ad'], tall: 0.5, fill: 0.85 },
  GOVERNMENT: { walls: ['#e6e0d2', '#dcd5c4', '#efe9dc'], roofs: ['#c2bba9', '#b7b0a0'], tall: 0.35, fill: 0.55 },
  RESIDENTIAL: { walls: ['#e5ddcf', '#d8cdbb', '#efe7da', '#dcc9b0'], roofs: ['#b4664a', '#a35a40', '#8d8c86', '#b9795a', '#7c8b7a'], tall: 0.05, fill: 0.62 },
  MIXED: { walls: ['#dfd6c6', '#d3c8b6', '#e9e1d3'], roofs: ['#a9604a', '#9b9a94', '#b8704f', '#82827d'], tall: 0.2, fill: 0.8 },
  TRANSIT: { walls: ['#d6d0c2', '#cac3b3'], roofs: ['#9a9890', '#8c8a84'], tall: 0.05, fill: 0.3 },
};

function rectCorners(cx: number, cy: number, w: number, d: number, angle: number): [Pt, Pt, Pt, Pt] {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const hw = w / 2;
  const hd = d / 2;
  const c = (x: number, y: number): Pt => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  return [c(-hw, -hd), c(hw, -hd), c(hw, hd), c(-hw, hd)];
}

function distToSegs(p: Pt, segs: Pt[][]): number {
  let best = Infinity;
  for (const s of segs) {
    for (let i = 1; i < s.length; i++) {
      const [ax, ay] = s[i - 1];
      const [bx, by] = s[i];
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2));
      const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
}

export function buildScene(map: MapData): Scene {
  const m2p = mToPx0(1);
  const rand = rng32(20260101);
  const roads: RoadSeg[] = map.edges.map((e) => {
    const pts = e.geometry.map(toWorld);
    const half = (ROAD_WIDTH_M[e.cls] * m2p) / 4;
    return { id: e.id, name: e.name, cls: e.cls, pts, cum: cumulative(pts), left: offsetPath(pts, half), right: offsetPath(pts, -half), bb: bbOf(pts) };
  });
  const mainPaths = roads.map((r) => r.pts);

  const buildings: Building[] = [];
  const trees: Tree[] = [];
  const streets: Scene['streets'] = [];
  const blobs: Blob[] = [];
  const lights: Pt[] = [];

  const districtOf = (p: Pt) => {
    let best = map.districts[0];
    let bd = Infinity;
    for (const d of map.districts) {
      const c = toWorld(d.center);
      const dist = Math.hypot(p[0] - c[0], p[1] - c[1]) / (mToPx0(d.radiusKm * 1000));
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return { d: best, k: bd };
  };

  const pushTree = (x: number, y: number, r: number) => trees.push({ x, y, r, tone: rand(), bb: [x - r, y - r, x + r, y + r] });

  const placeBuilding = (cx: number, cy: number, w: number, d: number, angle: number, kind: string, k: number) => {
    const pal = PALETTES[kind] ?? PALETTES.MIXED;
    const tallRoll = rand();
    const core = Math.max(0, 1 - k * 1.6);
    const tall = tallRoll < pal.tall * core * core;
    const h = tall ? 26 + rand() * 60 * (0.4 + core) : kind === 'COMMERCIAL' || kind === 'GOVERNMENT' ? 7 + rand() * 12 : 3.5 + rand() * 5;
    const pts = rectCorners(cx, cy, w * m2p, d * m2p, angle);
    buildings.push({
      pts,
      h,
      wall: pal.walls[Math.floor(rand() * pal.walls.length)],
      roof: pal.roofs[Math.floor(rand() * pal.roofs.length)],
      bb: bbOf(pts),
    });
  };

  const lineBuildings = (pts: Pt[], halfRoad: number, density: number, depthMax: number) => {
    const cum = cumulative(pts);
    const step = 20 * m2p;
    for (let dist = step; dist < cum[cum.length - 1]; dist += step * (0.9 + rand() * 0.9)) {
      let lo = 0;
      while (lo < cum.length - 2 && cum[lo + 1] < dist) lo++;
      const t = (dist - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
      const px = pts[lo][0] + (pts[lo + 1][0] - pts[lo][0]) * t;
      const py = pts[lo][1] + (pts[lo + 1][1] - pts[lo][1]) * t;
      const ang = Math.atan2(pts[lo + 1][1] - pts[lo][1], pts[lo + 1][0] - pts[lo][0]);
      for (const side of [-1, 1]) {
        if (rand() > density) continue;
        const { d: dist0, k } = districtOf([px, py]);
        if (k > 1.15) continue;
        const depth = 9 + rand() * depthMax;
        const w = 11 + rand() * 18;
        const off = (halfRoad + 7 + depth / 2 + rand() * 6) * m2p;
        const cx = px + Math.cos(ang + (Math.PI / 2) * side) * off;
        const cy = py + Math.sin(ang + (Math.PI / 2) * side) * off;
        placeBuilding(cx, cy, w, depth, ang, dist0.kind, k);
        // second row, further back
        if (rand() < 0.45 * density) {
          const off2 = off + (depth + 14 + rand() * 8) * m2p;
          placeBuilding(px + Math.cos(ang + (Math.PI / 2) * side) * off2, py + Math.sin(ang + (Math.PI / 2) * side) * off2, 10 + rand() * 16, 9 + rand() * 12, ang, dist0.kind, k);
        }
      }
    }
  };

  // Local street grids per district + buildings along them
  for (const d of map.districts) {
    const c = toWorld(d.center);
    const R = d.radiusKm * 1000 * (d.kind === 'TRANSIT' ? 0.35 : 0.85);
    const spacing = d.kind === 'RESIDENTIAL' ? 150 : d.kind === 'COMMERCIAL' ? 120 : 135;
    const angle = (rand() - 0.5) * 0.9;
    const dirs = [angle, angle + Math.PI / 2];
    const keep = d.kind === 'TRANSIT' ? 0.3 : 0.92;
    dirs.forEach((a, di) => {
      const ux = Math.cos(a), uy = Math.sin(a);
      for (let off = -R; off <= R; off += spacing * (0.85 + rand() * 0.3)) {
        const half = Math.sqrt(Math.max(0, R * R - off * off));
        for (let s = -half; s < half; s += spacing) {
          const mid = Math.hypot(s + spacing / 2, off) / R;
          if (rand() > keep * (1 - mid ** 3) + 0.04) continue;
          const a0: Pt = [c[0] + (ux * s - uy * off) * m2p, c[1] + (uy * s + ux * off) * m2p];
          const b0: Pt = [c[0] + (ux * (s + spacing) - uy * off) * m2p, c[1] + (uy * (s + spacing) + ux * off) * m2p];
          const jog = (rand() - 0.5) * 6 * m2p;
          const seg: Pt[] = [a0, [(a0[0] + b0[0]) / 2 + jog, (a0[1] + b0[1]) / 2 + jog], b0];
          streets.push({ pts: seg, bb: bbOf(seg) });
          if (di === 0 || rand() < 0.6) lineBuildings(seg, 4.5, 0.62, 9);
        }
      }
    });
  }

  for (const r of roads) {
    const halfRoad = ROAD_WIDTH_M[r.cls] / 2;
    lineBuildings(r.pts, halfRoad, r.cls === 'EXPRESSWAY' ? 0.28 : 0.72, r.cls === 'LOCAL' ? 12 : 16);
    // tree lines
    const total = r.cum[r.cum.length - 1];
    for (let dist = 0; dist < total; dist += 26 * m2p * (0.8 + rand() * 0.6)) {
      let lo = 0;
      while (lo < r.cum.length - 2 && r.cum[lo + 1] < dist) lo++;
      const t = (dist - r.cum[lo]) / (r.cum[lo + 1] - r.cum[lo] || 1);
      const px = r.pts[lo][0] + (r.pts[lo + 1][0] - r.pts[lo][0]) * t;
      const py = r.pts[lo][1] + (r.pts[lo + 1][1] - r.pts[lo][1]) * t;
      const ang = Math.atan2(r.pts[lo + 1][1] - r.pts[lo][1], r.pts[lo + 1][0] - r.pts[lo][0]);
      for (const side of [-1, 1]) {
        if (rand() < 0.25) continue;
        const off = (halfRoad + 3.5 + rand() * 2) * m2p;
        pushTree(px + Math.cos(ang + (Math.PI / 2) * side) * off, py + Math.sin(ang + (Math.PI / 2) * side) * off, (2.6 + rand() * 3) * m2p);
      }
    }
    // streetlights on arterials/expressways
    if (r.cls !== 'LOCAL') {
      const gap = (r.cls === 'EXPRESSWAY' ? 70 : 55) * m2p;
      for (let dist = 0; dist < total; dist += gap) {
        let lo = 0;
        while (lo < r.cum.length - 2 && r.cum[lo + 1] < dist) lo++;
        const t = (dist - r.cum[lo]) / (r.cum[lo + 1] - r.cum[lo] || 1);
        lights.push([r.pts[lo][0] + (r.pts[lo + 1][0] - r.pts[lo][0]) * t, r.pts[lo][1] + (r.pts[lo + 1][1] - r.pts[lo][1]) * t]);
      }
    }
  }

  // Parks and verges: green blobs inside districts, away from roads
  const parks: Scene['parks'] = [];
  for (const d of map.districts) {
    const c = toWorld(d.center);
    const greenness = d.kind === 'RESIDENTIAL' ? 7 : d.kind === 'GOVERNMENT' ? 6 : d.kind === 'TRANSIT' ? 9 : 3;
    for (let i = 0; i < greenness; i++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * d.radiusKm * 1000 * 0.9;
      const px = c[0] + Math.cos(a) * rr * m2p;
      const py = c[1] + Math.sin(a) * rr * m2p;
      const size = (90 + rand() * 220) * m2p;
      if (distToSegs([px, py], mainPaths) < size * 0.7) continue;
      const pts: Pt[] = [];
      const n = 9;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2;
        const rad = size * (0.7 + rand() * 0.4);
        pts.push([px + Math.cos(ang) * rad, py + Math.sin(ang) * rad * 0.75]);
      }
      parks.push({ pts, bb: bbOf(pts) });
      for (let k = 0; k < 14; k++) {
        const ang = rand() * Math.PI * 2;
        const rad = Math.sqrt(rand()) * size * 0.8;
        pushTree(px + Math.cos(ang) * rad, py + Math.sin(ang) * rad * 0.75, (3 + rand() * 4) * m2p);
      }
    }
  }

  // Jabi Lake, a stream through Maitama
  const lakeNode = map.nodes.find((n) => n.id === 'jabi_lake');
  const water: Scene['water'] = [];
  if (lakeNode) {
    const c = toWorld([lakeNode.pos[0] + 0.0045, lakeNode.pos[1] - 0.012]);
    const pts: Pt[] = [];
    const n = 28;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2;
      const wob = 0.82 + 0.28 * Math.sin(ang * 3 + 1) * Math.cos(ang * 2);
      pts.push([c[0] + Math.cos(ang) * 1100 * m2p * wob, c[1] + Math.sin(ang) * 520 * m2p * wob]);
    }
    water.push({ pts, bb: bbOf(pts) });
  }

  // Roundabouts and interchanges
  const roundabouts = map.nodes
    .filter((n) => /Roundabout|Interchange/.test(n.name))
    .map((n) => {
      const [x, y] = toWorld(n.pos);
      return { x, y, r: 32 * m2p };
    });

  // Soft land-use blobs for the ground
  const kindColor: Record<string, string> = { COMMERCIAL: '#d6d2c6', GOVERNMENT: '#d9d7c8', RESIDENTIAL: '#cfd3b4', MIXED: '#d3d0bd', TRANSIT: '#cdd1b0' };
  for (const d of map.districts) {
    const c = toWorld(d.center);
    blobs.push({ x: c[0], y: c[1], r: d.radiusKm * 1000 * 1.35 * m2p, color: kindColor[d.kind], kind: d.kind });
  }

  const cell = 0.005;
  const roadGrid = new SpatialGrid(cell, roads);
  const streetGrid = new SpatialGrid(cell, streets);
  // Drop buildings that would sit on a road.
  const margin = 40 * m2p;
  const clear = buildings.filter((b) => {
    const cx = (b.bb[0] + b.bb[2]) / 2, cy = (b.bb[1] + b.bb[3]) / 2;
    const rw = (b.bb[2] - b.bb[0]) / 2;
    for (const i of roadGrid.query(cx - margin, cy - margin, cx + margin, cy + margin)) {
      const r = roads[i];
      if (distToSegs([cx, cy], [r.pts]) < (ROAD_WIDTH_M[r.cls] / 2 + 4) * m2p + rw * 0.6) return false;
    }
    for (const i of streetGrid.query(cx - margin, cy - margin, cx + margin, cy + margin)) {
      if (distToSegs([cx, cy], [streets[i].pts]) < 8.5 * m2p + rw * 0.45) return false;
    }
    return true;
  });
  buildings.length = 0;
  buildings.push(...clear);
  return {
    roads,
    streets,
    buildings,
    trees,
    parks,
    water,
    roundabouts,
    lights,
    blobs,
    grids: { buildings: new SpatialGrid(cell, buildings), trees: new SpatialGrid(cell, trees), streets: new SpatialGrid(cell, streets), roads: new SpatialGrid(cell, roads) },
  };
}

export const worldCenter = toWorld(CITY_CENTER);
export const mPerPx0 = M_PER_PX0;
