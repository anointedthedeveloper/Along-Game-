import L from 'leaflet';
import { ROAD_WIDTH_M, type Scene } from './cityGen';
import { mToPx0 } from './projection';

const TILE = 256;

interface Palette {
  ground: string;
  road: Record<'EXPRESSWAY' | 'ARTERIAL' | 'LOCAL', { fill: string; casing: string }>;
}

const PAL: Palette = {
  ground: '#c8cda6',
  road: {
    EXPRESSWAY: { fill: '#5c5f63', casing: '#3b3d40' },
    ARTERIAL: { fill: '#6a6d70', casing: '#46484b' },
    LOCAL: { fill: '#74777a', casing: '#5a5d60' },
  },
};

const GREENS = ['#7da15a', '#6d9350', '#8bad62', '#5f8648'];

/**
 * Static city drawn tile by tile. Tiles are procedural, so there are no image
 * downloads and the whole city works offline and at any zoom.
 */
export class CityTileLayer extends L.GridLayer {
  constructor(private scene: Scene, options?: L.GridLayerOptions) {
    super({ tileSize: TILE, ...options });
  }

  protected createTile(coords: L.Coords): HTMLElement {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = TILE * dpr;
    canvas.height = TILE * dpr;
    canvas.style.width = `${TILE}px`;
    canvas.style.height = `${TILE}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      this.draw(ctx, coords.x, coords.y, coords.z);
    }
    return canvas;
  }

  private draw(ctx: CanvasRenderingContext2D, tx: number, ty: number, z: number) {
    const sc = this.scene;
    const k = 2 ** z; // zoom-0 px → zoom-z px
    const ox = tx * TILE;
    const oy = ty * TILE;
    const mpp = 1 / (mToPx0(1) * k); // metres per screen px
    const X = (x: number) => x * k - ox;
    const Y = (y: number) => y * k - oy;
    const pad = 60;
    const x0 = (ox - pad) / k, y0 = (oy - pad) / k, x1 = (ox + TILE + pad) / k, y1 = (oy + TILE + pad) / k;
    const m = (metres: number, min = 0) => Math.max(min, metres / mpp);
    // Main roads are drawn a little wider than life so the hierarchy reads at game zoom levels.
    const mw = (cls: 'EXPRESSWAY' | 'ARTERIAL' | 'LOCAL', metres: number, min = 0) => m(metres * (cls === 'LOCAL' ? 1 : 1.3), min);

    // --- ground
    ctx.fillStyle = PAL.ground;
    ctx.fillRect(0, 0, TILE, TILE);
    for (const b of sc.blobs) {
      const r = b.r * k;
      const cx = X(b.x), cy = Y(b.y);
      if (cx + r < 0 || cx - r > TILE || cy + r < 0 || cy - r > TILE) continue;
      const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      g.addColorStop(0, b.color);
      g.addColorStop(0.7, b.color + 'cc');
      g.addColorStop(1, b.color + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TILE, TILE);
    }

    // --- parks
    const poly = (pts: Array<[number, number]>) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      ctx.closePath();
    };
    for (const p of sc.parks) {
      if (p.bb[2] < x0 || p.bb[0] > x1 || p.bb[3] < y0 || p.bb[1] > y1) continue;
      poly(p.pts);
      ctx.fillStyle = '#a9c081';
      ctx.fill();
      ctx.strokeStyle = 'rgba(94,128,70,0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // --- water
    for (const w of sc.water) {
      if (w.bb[2] < x0 || w.bb[0] > x1 || w.bb[3] < y0 || w.bb[1] > y1) continue;
      poly(w.pts);
      ctx.fillStyle = '#86b4d1';
      ctx.fill();
      ctx.lineWidth = m(10, 2);
      ctx.strokeStyle = '#d9d2b6';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
    }

    const line = (pts: Array<[number, number]>) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // --- local streets
    if (z >= 15) {
      for (const i of sc.grids.streets.query(x0, y0, x1, y1)) {
        const s = sc.streets[i];
        line(s.pts);
        ctx.strokeStyle = '#b9b6aa';
        ctx.lineWidth = m(ROAD_WIDTH_M.LOCAL + 3, 1.4);
        ctx.stroke();
        ctx.strokeStyle = '#85888a';
        ctx.lineWidth = m(ROAD_WIDTH_M.LOCAL - 1, 0.9);
        ctx.stroke();
      }
    }

    // --- main roads: sidewalk casing, asphalt, markings
    const visibleRoads = sc.grids.roads.query(x0, y0, x1, y1).map((i) => sc.roads[i]);
    const order = { LOCAL: 0, ARTERIAL: 1, EXPRESSWAY: 2 } as const;
    visibleRoads.sort((a, b) => order[a.cls] - order[b.cls]);
    for (const r of visibleRoads) {
      const w = ROAD_WIDTH_M[r.cls];
      line(r.pts);
      const minW = r.cls === 'EXPRESSWAY' ? 6 : r.cls === 'ARTERIAL' ? 4.2 : 2.6;
      ctx.strokeStyle = z >= 15 ? '#c4c1b6' : PAL.road[r.cls].casing;
      ctx.lineWidth = mw(r.cls, w + 7, minW + 1.6);
      ctx.stroke();
      ctx.strokeStyle = PAL.road[r.cls].casing;
      ctx.lineWidth = mw(r.cls, w + 1.6, minW + 0.6);
      ctx.stroke();
    }
    for (const r of visibleRoads) {
      const w = ROAD_WIDTH_M[r.cls];
      line(r.pts);
      const minF = r.cls === 'EXPRESSWAY' ? 4.6 : r.cls === 'ARTERIAL' ? 3 : 1.8;
      ctx.strokeStyle = z < 15 ? (r.cls === 'EXPRESSWAY' ? '#e0a93a' : r.cls === 'ARTERIAL' ? '#f1efe6' : '#f1efe6') : PAL.road[r.cls].fill;
      ctx.lineWidth = mw(r.cls, w, minF);
      ctx.stroke();
    }
    if (z >= 15) {
      for (const r of visibleRoads) {
        if (r.cls === 'LOCAL') {
          line(r.pts);
          ctx.setLineDash([m(3.5), m(5)]);
          ctx.strokeStyle = 'rgba(240,240,225,0.75)';
          ctx.lineWidth = Math.max(0.8, m(0.18));
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
        if (r.cls === 'EXPRESSWAY') {
          line(r.pts);
          ctx.strokeStyle = '#6f8a55';
          ctx.lineWidth = m(3.2, 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(245,245,235,0.9)';
          ctx.lineWidth = Math.max(0.7, m(0.2));
          for (const off of [r.left, r.right]) {
            ctx.setLineDash([m(4), m(8)]);
            line(off);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else {
          line(r.pts);
          ctx.strokeStyle = '#e5c24a';
          ctx.lineWidth = Math.max(0.8, m(0.2));
          ctx.stroke();
          ctx.setLineDash([m(3), m(6)]);
          ctx.strokeStyle = 'rgba(245,245,235,0.75)';
          for (const off of [r.left, r.right]) {
            line(off);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
      }
    }

    // --- roundabouts
    for (const rb of sc.roundabouts) {
      const cx = X(rb.x), cy = Y(rb.y), r = rb.r * k;
      if (cx + r < -10 || cx - r > TILE + 10 || cy + r < -10 || cy - r > TILE + 10) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r + m(9), 0, Math.PI * 2);
      ctx.fillStyle = '#5d6063';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#8fb06a';
      ctx.fill();
      ctx.lineWidth = Math.max(1, m(1.2));
      ctx.strokeStyle = '#c8c4b5';
      ctx.stroke();
      if (z >= 16) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = '#d9d2b6';
        ctx.fill();
      }
    }

    // --- trees (under building shadows is fine)
    if (z >= 15) {
      for (const i of sc.grids.trees.query(x0, y0, x1, y1)) {
        const t = sc.trees[i];
        const r = Math.max(1.2, t.r * k);
        ctx.fillStyle = 'rgba(30,50,20,0.25)';
        ctx.beginPath();
        ctx.arc(X(t.x) + r * 0.35, Y(t.y) + r * 0.35, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = GREENS[Math.floor(t.tone * GREENS.length)];
        ctx.beginPath();
        ctx.arc(X(t.x), Y(t.y), r, 0, Math.PI * 2);
        ctx.fill();
        if (r > 4) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.arc(X(t.x) - r * 0.3, Y(t.y) - r * 0.3, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // --- buildings with a 2.5D extrusion: roofs shift up-left with height
    if (z >= 15) {
      const idx = sc.grids.buildings.query(x0, y0, x1, y1).sort((a, b) => sc.buildings[a].bb[1] - sc.buildings[b].bb[1]);
      const lift = (h: number) => (z <= 15 ? 0 : (h / mpp) * 0.34); // px of roof lift
      for (const i of idx) {
        const b = sc.buildings[i];
        const base = b.pts.map((p) => [X(p[0]), Y(p[1])] as [number, number]);
        const L = lift(b.h);
        const dx = -L * 0.45;
        const dy = -L;
        // shadow (cast to the south-east)
        if (L >= 0.8) {
          ctx.fillStyle = 'rgba(40,36,30,0.28)';
          ctx.beginPath();
          base.forEach((p, n) => (n ? ctx.lineTo(p[0] - dx * 0.9, p[1] - dy * 0.55) : ctx.moveTo(p[0] - dx * 0.9, p[1] - dy * 0.55)));
          base.slice().reverse().forEach((p) => ctx.lineTo(p[0], p[1]));
          ctx.closePath();
          ctx.fill();
        }
        // walls
        const roof = base.map((p) => [p[0] + dx, p[1] + dy] as [number, number]);
        ctx.fillStyle = b.wall;
        for (let n = 0; n < 4; n++) {
          const a = base[n], c = base[(n + 1) % 4];
          const ra = roof[n], rc = roof[(n + 1) % 4];
          const ex = c[0] - a[0], ey = c[1] - a[1];
          // outward normal facing the viewer (south / east side)
          const facing = ey * dx - ex * dy;
          if (L < 0.8) continue;
          ctx.fillStyle = facing > 0 ? shade(b.wall, -0.18) : shade(b.wall, -0.32);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.lineTo(rc[0], rc[1]);
          ctx.lineTo(ra[0], ra[1]);
          ctx.closePath();
          ctx.fill();
        }
        // roof
        ctx.fillStyle = b.roof;
        ctx.beginPath();
        roof.forEach((p, n) => (n ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        if (z >= 17 && b.h > 18) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          const cx = (roof[0][0] + roof[2][0]) / 2, cy = (roof[0][1] + roof[2][1]) / 2;
          ctx.fillRect(cx - 3, cy - 3, 6, 6);
        }
      }
    }
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + c * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
