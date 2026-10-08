import type { Scene } from './cityGen';
import { AMBIENT_COLORS } from './sprites';
import { mToPx0, type Pt } from './projection';

/** Ambient traffic cruising along the real road graph, thinning out at night and bunching up in rush hour. */

interface Seg {
  pts: Pt[];
  cum: number[];
  cls: 'EXPRESSWAY' | 'ARTERIAL' | 'LOCAL';
  from: string;
  to: string;
}

export interface Car {
  seg: number;
  dir: 1 | -1;
  d: number; // distance along segment (zoom-0 px)
  v: number; // current speed (zoom-0 px / s)
  cruise: number;
  cls: string;
  color: string;
  lane: number;
  braking: boolean;
  x: number;
  y: number;
  heading: number;
}

const SPEED_KPH = { EXPRESSWAY: 62, ARTERIAL: 38, LOCAL: 22 };

export class TrafficSim {
  cars: Car[] = [];
  private segs: Seg[] = [];
  private byNode = new Map<string, number[]>();
  private m2p = mToPx0(1);

  constructor(scene: Scene, edges: Array<{ from: string; to: string }>) {
    this.segs = scene.roads.map((r, i) => ({ pts: r.pts, cum: r.cum, cls: r.cls, from: edges[i].from, to: edges[i].to }));
    this.segs.forEach((s, i) => {
      for (const n of [s.from, s.to]) (this.byNode.get(n) ?? this.byNode.set(n, []).get(n)!).push(i);
    });
  }

  private spawn(): Car | null {
    if (!this.segs.length) return null;
    const si = Math.floor(Math.random() * this.segs.length);
    const s = this.segs[si];
    const total = s.cum[s.cum.length - 1];
    const roll = Math.random();
    const cls = roll < 0.4 ? 'SEDAN_TAXI' : roll < 0.7 ? 'PRIVATE' : roll < 0.78 ? 'MINIBUS' : roll < 0.84 ? 'BUS' : roll < 0.93 && s.cls !== 'EXPRESSWAY' ? 'KEKE' : 'COROLLA';
    const color = cls === 'SEDAN_TAXI' ? '#f4f4f0' : cls === 'KEKE' ? '#f2b705' : cls === 'MINIBUS' ? (Math.random() < 0.5 ? '#f4f4f0' : '#f2b705') : cls === 'BUS' ? '#f4f4f0' : AMBIENT_COLORS[Math.floor(Math.random() * AMBIENT_COLORS.length)];
    const kph = SPEED_KPH[s.cls] * (0.7 + Math.random() * 0.5);
    return {
      seg: si,
      dir: Math.random() < 0.5 ? 1 : -1,
      d: Math.random() * total,
      v: 0,
      cruise: (kph / 3.6) * this.m2p,
      cls,
      color,
      lane: 0,
      braking: false,
      x: 0,
      y: 0,
      heading: 0,
    };
  }

  /** Adjust the fleet size and advance everything by dt seconds. */
  update(dt: number, target: number, congestion: number): void {
    while (this.cars.length < target) {
      const c = this.spawn();
      if (!c) break;
      this.cars.push(c);
    }
    if (this.cars.length > target) this.cars.length = target;
    const slow = 1 - 0.65 * congestion;
    // sort within lanes for a simple car-following model
    const lanes = new Map<string, Car[]>();
    for (const c of this.cars) {
      const k = `${c.seg}:${c.dir}`;
      (lanes.get(k) ?? lanes.set(k, []).get(k)!).push(c);
    }
    for (const list of lanes.values()) {
      list.sort((a, b) => (a.dir === 1 ? b.d - a.d : a.d - b.d));
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const ahead = i > 0 ? list[i - 1] : null;
        let target_v = c.cruise * slow;
        c.braking = false;
        if (ahead) {
          const gap = Math.abs(ahead.d - c.d) - 22 * this.m2p;
          if (gap < 18 * this.m2p) {
            target_v = Math.min(target_v, Math.max(0, ahead.v * 0.9 * (gap / (18 * this.m2p))));
            c.braking = true;
          }
        }
        c.v += (target_v - c.v) * Math.min(1, dt * 2.2);
      }
    }
    for (const c of this.cars) {
      const s = this.segs[c.seg];
      const total = s.cum[s.cum.length - 1];
      c.d += c.dir * c.v * dt;
      if (c.d > total || c.d < 0) {
        // pick the next road at the junction
        const node = c.d > total ? s.to : s.from;
        const options = (this.byNode.get(node) ?? []).filter((i) => i !== c.seg);
        const next = options.length ? options[Math.floor(Math.random() * options.length)] : c.seg;
        const ns = this.segs[next];
        const ntotal = ns.cum[ns.cum.length - 1];
        if (next === c.seg) {
          c.dir = (c.dir * -1) as 1 | -1;
          c.d = Math.min(Math.max(c.d, 0), total);
        } else {
          c.seg = next;
          const atStart = ns.from === node;
          c.dir = atStart ? 1 : -1;
          c.d = atStart ? 0 : ntotal;
          c.cruise = ((SPEED_KPH[ns.cls] * (0.7 + Math.random() * 0.5)) / 3.6) * this.m2p;
        }
      }
      this.place(c);
    }
  }

  private place(c: Car) {
    const s = this.segs[c.seg];
    const pts = s.pts;
    const cum = s.cum;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= c.d) lo = mid;
      else hi = mid;
    }
    const t = (c.d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    const a = pts[lo];
    const b = pts[hi];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const hd = Math.atan2(dy, dx) + (c.dir === -1 ? Math.PI : 0);
    // drive on the right (Nigeria): offset to the right of travel direction
    const laneOff = (s.cls === 'EXPRESSWAY' ? 6.5 : s.cls === 'ARTERIAL' ? 4 : 2.2) * this.m2p;
    const ux = Math.cos(hd), uy = Math.sin(hd);
    c.x = a[0] + dx * t + -uy * laneOff * -1;
    c.y = a[1] + dy * t + ux * laneOff * -1;
    c.x = a[0] + dx * t - uy * laneOff;
    c.y = a[1] + dy * t + ux * laneOff;
    c.heading = hd;
    void len;
  }
}
