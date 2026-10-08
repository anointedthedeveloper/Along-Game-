import type { LatLng } from '@/types';

/** Exact web-mercator at zoom 0 (a 256px world). Everything static is stored in this space. */
export const toWorld = ([lat, lng]: LatLng): [number, number] => {
  const x = ((lng + 180) / 360) * 256;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256;
  return [x, y];
};

export const fromWorld = ([x, y]: [number, number]): LatLng => {
  const lng = (x / 256) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / 256;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lat, lng];
};

export const CITY_CENTER: LatLng = [9.06, 7.43];
const EARTH = 40075016.686;

/** Metres covered by one zoom-0 pixel at the city's latitude. */
export const M_PER_PX0 = (EARTH * Math.cos((CITY_CENTER[0] * Math.PI) / 180)) / 256;

/** Metres → zoom-0 pixels. */
export const mToPx0 = (m: number): number => m / M_PER_PX0;

export function metersToLatLng(origin: LatLng, dx: number, dy: number): LatLng {
  const kLat = 110574;
  const kLng = 111320 * Math.cos((origin[0] * Math.PI) / 180);
  return [origin[0] + dy / kLat, origin[1] + dx / kLng];
}

export function latLngToMeters(origin: LatLng, p: LatLng): [number, number] {
  const kLat = 110574;
  const kLng = 111320 * Math.cos((origin[0] * Math.PI) / 180);
  return [(p[1] - origin[1]) * kLng, (p[0] - origin[0]) * kLat];
}

export type Pt = [number, number];

export function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

/** Point and heading at a distance along a polyline. */
export function sampleAlong(pts: Pt[], cum: number[], dist: number): { p: Pt; heading: number } {
  const total = cum[cum.length - 1];
  const d = Math.min(Math.max(dist, 0), total);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  const a = pts[lo];
  const b = pts[hi];
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

export function cumulative(pts: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

export function offsetPath(pts: Pt[], d: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push([pts[i][0] + (-dy / len) * d, pts[i][1] + (dx / len) * d]);
  }
  return out;
}
