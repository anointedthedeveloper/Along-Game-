import L from 'leaflet';
import { buildScene, type Scene } from './cityGen';
import { drawPoiGlyph, POI_COLOR } from './poi';
import { toWorld, type Pt } from './projection';
import { getSprite, SPRITE_SIZE } from './sprites';
import { CityTileLayer } from './tiles';
import { TrafficSim } from './traffic';
import type { GameLocation, LatLng, MapData, Incident, WeatherKind } from '@/types';

export interface Actor {
  id: string;
  pos: LatLng;
  heading: number;
  cls: string;
  color: string;
  moving: boolean;
  primary?: boolean;
  label?: string;
}

export interface Pin {
  id: string;
  pos: LatLng;
  kind: 'pickup' | 'dropoff' | 'event' | 'dest';
  label?: string;
  severity?: 'INFO' | 'WARNING' | 'DANGER';
}

export interface FrameState {
  actors: Actor[];
  route?: { pts: LatLng[]; progress: number; color?: string } | null;
  secondaryRoute?: { pts: LatLng[]; color?: string } | null;
  pins: Pin[];
  follow?: LatLng | null;
  selectedLocation?: string | null;
  highlightTypes?: string[];
}

export interface EnvState {
  minuteOfDay: number;
  weather: WeatherKind;
  intensity: number;
  traffic: number;
  incidents: Incident[];
}

export interface EngineOptions {
  data: MapData;
  getFrame: () => FrameState;
  getEnv: () => EnvState;
  onLocationClick: (loc: GameLocation | null) => void;
  initialCenter: LatLng;
  initialZoom: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const bell = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

const REAL_LEN: Record<string, number> = { MOTORCYCLE: 2.1, KEKE: 2.8, SEDAN_TAXI: 4.5, COROLLA: 4.5, CAMRY: 4.9, PRIVATE_CAR: 4.8, PRIVATE: 4.6, MINIBUS: 5.6, BUS: 11 };
const MIN_LEN: Record<string, number> = { MOTORCYCLE: 9, KEKE: 12, SEDAN_TAXI: 16, COROLLA: 16, CAMRY: 17, PRIVATE_CAR: 17, PRIVATE: 16, MINIBUS: 20, BUS: 30 };

interface RainDrop { x: number; y: number; v: number; l: number }

export class CityEngine {
  readonly map: L.Map;
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dark: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private traffic: TrafficSim;
  private raf = 0;
  private last = performance.now();
  private rain: RainDrop[] = [];
  private hits: Array<{ x: number; y: number; r: number; loc: GameLocation }> = [];
  private locations: GameLocation[];
  private worldPts = new Map<string, Pt>();
  private userDragging = false;
  private resumeFollowAt = 0;
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private t = 0;
  private destroyed = false;

  constructor(container: HTMLElement, private opts: EngineOptions) {
    this.scene = buildScene(opts.data);
    this.locations = opts.data.locations;
    for (const l of this.locations) this.worldPts.set(l.key, toWorld(l.pos));
    this.traffic = new TrafficSim(this.scene, opts.data.edges);

    this.map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      center: opts.initialCenter,
      zoom: opts.initialZoom,
      minZoom: 12,
      maxZoom: 19,
      maxBounds: L.latLngBounds([8.93, 7.2], [9.22, 7.62]),
      maxBoundsViscosity: 0.9,
      wheelPxPerZoomLevel: 90,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      keyboard: false,
    });
    new CityTileLayer(this.scene, { updateWhenZooming: false, keepBuffer: 3 }).addTo(this.map);

    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '500' });
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.dark = document.createElement('canvas');
    this.dctx = this.dark.getContext('2d')!;

    this.map.on('click', (e: L.LeafletMouseEvent) => this.handleClick(e.containerPoint));
    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const hit = this.hitTest(e.containerPoint);
      container.style.cursor = hit ? 'pointer' : '';
    });
    this.map.on('dragstart', () => {
      this.userDragging = true;
    });
    this.map.on('dragend', () => {
      this.userDragging = false;
      this.resumeFollowAt = performance.now() + 4000;
    });
    this.map.on('zoomstart', () => {
      this.resumeFollowAt = performance.now() + 2500;
    });
    this.resize();
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.loop);
  }

  private resize = () => {
    const size = this.map.getSize();
    this.canvas.width = Math.round(size.x * this.dpr);
    this.canvas.height = Math.round(size.y * this.dpr);
    this.dark.width = Math.max(2, Math.round(size.x / 2));
    this.dark.height = Math.max(2, Math.round(size.y / 2));
    this.map.invalidateSize();
  };

  flyTo(pos: LatLng, zoom?: number): void {
    this.resumeFollowAt = 0;
    this.map.setView(pos, zoom ?? this.map.getZoom(), { animate: false });
  }

  setView(pos: LatLng, zoom: number): void {
    this.map.setView(pos, zoom, { animate: false });
  }

  fitRoute(pts: LatLng[], padding = 90): void {
    if (pts.length < 2) return;
    this.resumeFollowAt = performance.now() + 6000;
    this.map.fitBounds(L.latLngBounds(pts), { padding: [padding, padding], animate: false, maxZoom: 17 });
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.map.remove();
    this.canvas.remove();
  }

  /* ----------------------------------------------------------------- input */

  private hitTest(p: L.Point) {
    let best: (typeof this.hits)[number] | null = null;
    let bd = Infinity;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d < Math.max(14, h.r + 6) && d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  private handleClick(p: L.Point) {
    const hit = this.hitTest(p);
    this.opts.onLocationClick(hit ? hit.loc : null);
  }

  /* ------------------------------------------------------------ main loop */

  private loop = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    try {
      this.frame(dt, now);
    } catch (e) {
      console.error('[engine] frame error', e);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private frame(dt: number, now: number) {
    const map = this.map;
    const size = map.getSize();
    const z = map.getZoom();
    const env = this.opts.getEnv();
    const f = this.opts.getFrame();

    // camera follow
    if (f.follow && !this.userDragging && now > this.resumeFollowAt) {
      const cp = map.latLngToContainerPoint(f.follow);
      const dx = cp.x - size.x / 2;
      const dy = cp.y - size.y * 0.4;
      if (Math.hypot(dx, dy) > 1.5) map.panBy([dx * Math.min(1, dt * 5), dy * Math.min(1, dt * 5)], { animate: false });
    }

    const night = 1 - daylight(env.minuteOfDay);
    const target = Math.round((14 + 40 * Math.max(0.15, env.traffic) + (night > 0.5 ? -8 : 0)) * clamp((z - 11) / 4, 0.4, 1.3));
    this.traffic.update(dt, target, env.traffic);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    this.hits = [];

    const wp = (p: Pt): L.Point => this.worldToScreen(p);

    // ambient traffic
    const view = this.viewWorldBounds();
    if (z >= 13.5) {
      for (const c of this.traffic.cars) {
        if (c.x < view[0] || c.x > view[2] || c.y < view[1] || c.y > view[3]) continue;
        const s = wp([c.x, c.y]);
        this.drawVehicle(ctx, c.cls, c.color, s.x, s.y, c.heading, z, false, c.braking);
      }
    }

    // pins' route under actors
    this.drawRoutes(ctx, f);

    // incidents
    if (z >= 14) this.drawIncidents(ctx, env.incidents, z);

    // actors on top of ambient traffic
    for (const a of f.actors) {
      const s = map.latLngToContainerPoint(a.pos);
      if (a.primary) this.drawPrimaryRing(ctx, s.x, s.y, z, a.moving);
      this.drawVehicle(ctx, a.cls, a.color, s.x, s.y, a.heading, z, !!a.primary, false);
    }

    // darkness, streetlights and headlights
    if (night > 0.04 || env.intensity > 0.5) this.drawNight(ctx, size, env, night, z, f, view);

    // time-of-day tint
    this.drawTint(ctx, size, env.minuteOfDay, night, env);

    // weather
    this.drawWeather(ctx, size, env, dt);

    // map furniture on top of the lighting
    this.drawLabelsAndPois(ctx, size, z, f);
    this.drawPins(ctx, f, z);
    for (const a of f.actors) {
      if (!a.label) continue;
      const s = map.latLngToContainerPoint(a.pos);
      this.drawTag(ctx, a.label, s.x, s.y - 22, a.primary ? '#f2b705' : '#ffffff', a.primary ? '#111' : '#222');
    }
  }

  /* ------------------------------------------------------------- geometry */

  private worldToScreen(p: Pt): L.Point {
    const z = this.map.getZoom();
    const k = 2 ** z;
    const origin = this.map.getPixelOrigin();
    const pane = (this.map as unknown as { _getMapPanePos(): L.Point })._getMapPanePos();
    return L.point(p[0] * k - origin.x + pane.x, p[1] * k - origin.y + pane.y);
  }

  private viewWorldBounds(): [number, number, number, number] {
    const size = this.map.getSize();
    const b = this.map.getBounds();
    const sw = toWorld([b.getSouth(), b.getWest()]);
    const ne = toWorld([b.getNorth(), b.getEast()]);
    const pad = 0.0002 * (size.x / 800);
    return [sw[0] - pad, ne[1] - pad, ne[0] + pad, sw[1] + pad];
  }

  private spriteScale(cls: string, z: number, primary: boolean) {
    const mpp = 156543.03 * Math.cos((9.06 * Math.PI) / 180) / 2 ** z;
    const [L0] = SPRITE_SIZE[cls] ?? SPRITE_SIZE.SEDAN_TAXI;
    const real = (REAL_LEN[cls] ?? 4.5) * 1.5 / mpp;
    const len = Math.min(120, Math.max(real, MIN_LEN[cls] ?? 12) * (primary ? 1.9 : 1));
    return len / L0;
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, cls: string, color: string, x: number, y: number, heading: number, z: number, primary: boolean, braking: boolean) {
    const spr = getSprite(cls, color);
    const s = this.spriteScale(cls, z, primary);
    const w = spr.width / 3;
    const h = spr.height / 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(s, s);
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    if (braking) {
      ctx.fillStyle = 'rgba(255,40,30,0.85)';
      const [Lg, Wg] = SPRITE_SIZE[cls] ?? SPRITE_SIZE.SEDAN_TAXI;
      ctx.fillRect(-Lg / 2 - 0.5, -Wg / 2 + 2.6, 2.4, 4);
      ctx.fillRect(-Lg / 2 - 0.5, Wg / 2 - 6.6, 2.4, 4);
    }
    ctx.restore();
  }

  private drawPrimaryRing(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, moving: boolean) {
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    const r = clamp(10 + (z - 14) * 5, 16, 46) + (moving ? 0 : pulse * 3);
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.5);
    g.addColorStop(0, 'rgba(242,183,5,0.38)');
    g.addColorStop(1, 'rgba(242,183,5,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,183,5,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* --------------------------------------------------------------- routes */

  private drawRoutes(ctx: CanvasRenderingContext2D, f: FrameState) {
    const stroke = (pts: LatLng[], color: string, w: number, alpha: number, dash?: number[]) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const s = this.map.latLngToContainerPoint(p);
        if (i) ctx.lineTo(s.x, s.y);
        else ctx.moveTo(s.x, s.y);
      });
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.setLineDash(dash ?? []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (f.secondaryRoute) {
      stroke(f.secondaryRoute.pts, 'rgba(0,0,0,0.5)', 8, 0.55);
      stroke(f.secondaryRoute.pts, f.secondaryRoute.color ?? '#4fc3f7', 5, 0.95, [10, 8]);
    }
    if (f.route && f.route.pts.length > 1) {
      const pts = f.route.pts;
      const idx = Math.max(1, Math.min(pts.length - 1, Math.floor(f.route.progress * (pts.length - 1))));
      const done = pts.slice(0, idx + 1);
      const rest = pts.slice(idx);
      stroke(rest, 'rgba(0,0,0,0.55)', 9, 0.7);
      stroke(rest, f.route.color ?? '#f2b705', 5.5, 1);
      stroke(rest, 'rgba(255,255,255,0.55)', 1.6, 1, [2, 12]);
      stroke(done, 'rgba(0,0,0,0.35)', 7, 0.4);
      stroke(done, '#8a8a8a', 3.5, 0.6);
    }
  }

  /* ------------------------------------------------------------ incidents */

  private drawIncidents(ctx: CanvasRenderingContext2D, incidents: Incident[], z: number) {
    for (const inc of incidents) {
      const s = this.map.latLngToContainerPoint(inc.pos);
      const size = this.map.getSize();
      if (s.x < -30 || s.y < -30 || s.x > size.x + 30 || s.y > size.y + 30) continue;
      const r = clamp(8 + (z - 14) * 2.2, 8, 18);
      ctx.save();
      ctx.translate(s.x, s.y);
      if (inc.kind === 'FLOOD') {
        ctx.fillStyle = 'rgba(80,150,210,0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 2.2, r * 1.1, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      const flash = inc.kind === 'ACCIDENT' ? (Math.floor(this.t * 4) % 2 === 0 ? '#e53935' : '#1e88e5') : null;
      ctx.fillStyle = flash ?? (inc.kind === 'CLOSURE' ? '#c62828' : '#f57c00');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (inc.kind === 'CONSTRUCTION' || inc.kind === 'FLOOD') {
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.95, r * 0.8);
        ctx.lineTo(-r * 0.95, r * 0.8);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      if (inc.kind === 'CLOSURE') ctx.fillRect(-r * 0.6, -r * 0.16, r * 1.2, r * 0.32);
      else {
        ctx.font = `bold ${Math.round(r)}px Barlow, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, inc.kind === 'CONSTRUCTION' || inc.kind === 'FLOOD' ? r * 0.2 : 1);
      }
      ctx.restore();
      if (z >= 15.5) this.drawTag(ctx, inc.label, s.x, s.y + r + 12, '#fff', '#b71c1c');
    }
  }

  /* -------------------------------------------------------------- lighting */

  private drawNight(ctx: CanvasRenderingContext2D, size: L.Point, env: EnvState, night: number, z: number, f: FrameState, view: [number, number, number, number]) {
    const rainDim = env.weather === 'HEAVY_RAIN' ? 0.14 : env.weather === 'RAIN' ? 0.07 : env.weather === 'CLOUDY' ? 0.02 : 0;
    const darkAlpha = clamp(0.7 * night + rainDim * (1 - night * 0.5), 0, 0.82);
    if (darkAlpha < 0.02) return;
    const dw = this.dark.width, dh = this.dark.height;
    const d = this.dctx;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, dw, dh);
    d.fillStyle = `rgba(7,12,34,${darkAlpha})`;
    d.fillRect(0, 0, dw, dh);
    d.globalCompositeOperation = 'destination-out';
    const sc = 0.5;
    const hole = (x: number, y: number, r: number, a: number) => {
      const g = d.createRadialGradient(x * sc, y * sc, 0, x * sc, y * sc, r * sc);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath();
      d.arc(x * sc, y * sc, r * sc, 0, Math.PI * 2);
      d.fill();
    };
    const lit = night > 0.25;
    const zs = clamp(1.3 ** (z - 16), 0.35, 2.4);
    const lightsOn = lit && z >= 14.5;
    const lightList: Array<[number, number]> = [];
    if (lightsOn) {
      for (const lp of this.scene.lights) {
        if (lp[0] < view[0] || lp[0] > view[2] || lp[1] < view[1] || lp[1] > view[3]) continue;
        const s = this.worldToScreen(lp);
        lightList.push([s.x, s.y]);
        hole(s.x, s.y, 40 * zs + 8, 0.7 * night);
      }
      for (const l of this.locations) {
        if (l.type !== 'PETROL_STATION' && l.type !== 'MALL' && l.type !== 'HOTEL' && l.type !== 'AIRPORT' && l.type !== 'MARKET') continue;
        const s = this.map.latLngToContainerPoint(l.pos);
        if (s.x < -80 || s.y < -80 || s.x > size.x + 80 || s.y > size.y + 80) continue;
        hole(s.x, s.y, (l.type === 'PETROL_STATION' ? 62 : 48) * zs + 10, 0.85 * night);
        lightList.push([s.x, s.y]);
      }
    }
    // headlights of vehicles
    const beams: Array<{ x: number; y: number; h: number; len: number }> = [];
    const addBeam = (x: number, y: number, h: number, cls: string, primary: boolean) => {
      const len = (this.spriteScale(cls, z, primary) * (SPRITE_SIZE[cls]?.[0] ?? 58)) * 2.4;
      beams.push({ x, y, h, len });
      const fx = x + Math.cos(h) * len * 0.55;
      const fy = y + Math.sin(h) * len * 0.55;
      hole(fx, fy, len * 0.95, 0.95 * Math.min(1, night * 1.4 + 0.2));
    };
    if (z >= 14) {
      for (const c of this.traffic.cars) {
        const s = this.worldToScreen([c.x, c.y]);
        if (s.x < -80 || s.y < -80 || s.x > size.x + 80 || s.y > size.y + 80) continue;
        addBeam(s.x, s.y, c.heading, c.cls, false);
      }
    }
    for (const a of f.actors) {
      const s = this.map.latLngToContainerPoint(a.pos);
      addBeam(s.x, s.y, a.heading, a.cls, !!a.primary);
    }
    d.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.dark, 0, 0, size.x, size.y);

    // additive glow
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y] of lightList) {
      const r = 13 * zs + 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,205,120,${0.3 * night})`);
      g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of beams) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.h);
      const g = ctx.createLinearGradient(b.len * 0.2, 0, b.len * 1.5, 0);
      g.addColorStop(0, `rgba(255,244,200,${0.38 * Math.min(1, night * 1.5)})`);
      g.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(b.len * 0.45, -b.len * 0.07);
      ctx.lineTo(b.len * 1.5, -b.len * 0.5);
      ctx.lineTo(b.len * 1.5, b.len * 0.5);
      ctx.lineTo(b.len * 0.45, b.len * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // lit windows
    if (z >= 16 && night > 0.45) {
      ctx.fillStyle = `rgba(255,214,140,${0.55 * night})`;
      for (const i of this.scene.grids.buildings.query(view[0], view[1], view[2], view[3])) {
        const b = this.scene.buildings[i];
        if (((i * 2654435761) >>> 0) % 100 > 38) continue;
        const cx = (b.pts[0][0] + b.pts[2][0]) / 2, cy = (b.pts[0][1] + b.pts[2][1]) / 2;
        const s = this.worldToScreen([cx, cy]);
        const w = clamp(2.4 * zs, 1.5, 5);
        ctx.fillRect(s.x - w / 2, s.y - w / 2 - (b.h / 3) * zs * 0.3, w, w * 0.8);
      }
    }
    ctx.restore();
  }

  private drawTint(ctx: CanvasRenderingContext2D, size: L.Point, minute: number, night: number, env: EnvState) {
    const h = minute / 60;
    const warm = Math.max(bell(h, 18.6, 0.85), bell(h, 6.2, 0.7), 0);
    const a = 0.3 * warm * (1 - night * 0.6);
    if (a > 0.01) {
      ctx.fillStyle = `rgba(255,122,48,${a})`;
      ctx.fillRect(0, 0, size.x, size.y);
    }
    // gentle vignette keeps the player's eye on the action
    const g = ctx.createRadialGradient(size.x / 2, size.y / 2, Math.min(size.x, size.y) * 0.45, size.x / 2, size.y / 2, Math.max(size.x, size.y) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(5,10,20,${0.22 + night * 0.16 + env.intensity * 0.06})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size.x, size.y);
  }

  private drawWeather(ctx: CanvasRenderingContext2D, size: L.Point, env: EnvState, dt: number) {
    const cloud = env.weather === 'SUNNY' ? 0 : env.weather === 'CLOUDY' ? 0.5 : env.weather === 'RAIN' ? 0.9 : 1.2;
    if (cloud > 0) {
      for (let i = 0; i < 4; i++) {
        const cx = ((this.t * (6 + i * 3) + i * 400) % (size.x + 600)) - 300;
        const cy = size.y * (0.2 + 0.2 * i) + Math.sin(this.t * 0.2 + i) * 30;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 340);
        g.addColorStop(0, `rgba(30,40,55,${0.16 * cloud})`);
        g.addColorStop(1, 'rgba(30,40,55,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 340, cy - 340, 680, 680);
      }
    }
    const want = env.weather === 'HEAVY_RAIN' ? 520 : env.weather === 'RAIN' ? 220 : 0;
    while (this.rain.length < want) this.rain.push({ x: Math.random() * (size.x + 200), y: Math.random() * size.y, v: 700 + Math.random() * 400, l: 10 + Math.random() * 14 });
    if (this.rain.length > want) this.rain.length = want;
    if (!want) return;
    ctx.strokeStyle = 'rgba(205,225,245,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of this.rain) {
      r.y += r.v * dt;
      r.x -= r.v * dt * 0.22;
      if (r.y > size.y) {
        r.y = -20;
        r.x = Math.random() * (size.x + 200);
      }
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.l * 0.22, r.y - r.l);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(90,120,150,${env.weather === 'HEAVY_RAIN' ? 0.14 : 0.07})`;
    ctx.fillRect(0, 0, size.x, size.y);
  }

  /* ------------------------------------------------- labels, POIs, markers */

  private drawLabelsAndPois(ctx: CanvasRenderingContext2D, size: L.Point, z: number, f: FrameState) {
    const hi = new Set(f.highlightTypes ?? []);
    if (z <= 15.5) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const d of this.opts.data.districts) {
        const s = this.map.latLngToContainerPoint(d.center);
        if (s.x < -200 || s.y < -60 || s.x > size.x + 200 || s.y > size.y + 60) continue;
        const fs = clamp(10 + (z - 12) * 2.6, 10, 19);
        ctx.font = `700 ${fs}px "Barlow Condensed", Barlow, sans-serif`;
        const text = d.name.toUpperCase().split('').join(String.fromCharCode(8202));
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(245,243,235,0.85)';
        ctx.strokeText(text, s.x, s.y);
        ctx.fillStyle = '#3d4a3d';
        ctx.fillText(text, s.x, s.y);
      }
    }
    if (z < 13.5) return;
    for (const loc of this.locations) {
      if (loc.type === 'DISTRICT') continue;
      const s = this.map.latLngToContainerPoint(loc.pos);
      if (s.x < -30 || s.y < -30 || s.x > size.x + 30 || s.y > size.y + 30) continue;
      const important = loc.type === 'AIRPORT' || loc.type === 'PETROL_STATION' || loc.type === 'GARAGE' || hi.has(loc.type) || loc.key === f.selectedLocation;
      if (z < 15 && !important) continue;
      const r = clamp(8 + (z - 14) * 1.6, 8, 15) * (loc.key === f.selectedLocation ? 1.25 : 1);
      this.drawBadge(ctx, loc, s.x, s.y, r, loc.key === f.selectedLocation);
      this.hits.push({ x: s.x, y: s.y, r, loc });
      if (z >= 16 || loc.key === f.selectedLocation) this.drawTag(ctx, loc.name, s.x, s.y + r + 10, '#fff', '#222');
    }
    for (const d of this.opts.data.districts) {
      const loc = this.locations.find((l) => l.key === `${d.id}_hub`) ?? this.locations.find((l) => l.type === 'DISTRICT' && l.district === d.id);
      if (!loc) continue;
      const s = this.map.latLngToContainerPoint(loc.pos);
      if (z >= 14.5) this.hits.push({ x: s.x, y: s.y, r: 12, loc });
    }
  }

  private drawBadge(ctx: CanvasRenderingContext2D, loc: GameLocation, x: number, y: number, r: number, selected: boolean) {
    ctx.save();
    ctx.translate(x, y);
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      ctx.strokeStyle = `rgba(242,183,5,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = POI_COLOR[loc.type] ?? '#444';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    drawPoiGlyph(ctx, loc.type, r * 0.78);
    ctx.restore();
  }

  private drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string) {
    ctx.save();
    ctx.font = '600 11px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.94;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 9, w, 18, 9);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  private drawPins(ctx: CanvasRenderingContext2D, f: FrameState, z: number) {
    for (const p of f.pins) {
      const s = this.map.latLngToContainerPoint(p.pos);
      const bounce = Math.abs(Math.sin(this.t * 3)) * 4;
      const r = clamp(11 + (z - 14) * 1.4, 11, 18);
      ctx.save();
      ctx.translate(s.x, s.y);
      // ground pulse
      const pulse = (this.t * 1.2) % 1;
      ctx.strokeStyle = p.kind === 'pickup' ? `rgba(31,157,85,${0.6 * (1 - pulse)})` : p.kind === 'event' ? `rgba(229,57,53,${0.6 * (1 - pulse)})` : `rgba(242,183,5,${0.6 * (1 - pulse)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 8 + pulse * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.translate(0, -r - 6 - bounce);
      const color = p.kind === 'pickup' ? '#1f9d55' : p.kind === 'event' ? (p.severity === 'DANGER' ? '#d32f2f' : '#f57c00') : '#111';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.5, r * 0.75);
      ctx.lineTo(0, r + 9);
      ctx.lineTo(r * 0.5, r * 0.75);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      if (p.kind === 'pickup') {
        ctx.beginPath();
        ctx.arc(0, -r * 0.3, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, r * 0.62, r * 0.5, Math.PI, 0);
        ctx.fill();
      } else if (p.kind === 'event') {
        ctx.font = `800 ${Math.round(r * 1.3)}px Barlow, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
      } else {
        // chequered flag
        const q = r * 0.34;
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 3; j++) {
            ctx.fillStyle = (i + j) % 2 ? '#fff' : '#333';
            ctx.fillRect(-r * 0.55 + i * q, -r * 0.5 + j * q, q, q);
          }
      }
      ctx.restore();
      if (p.label) this.drawTag(ctx, p.label, s.x, s.y + 14, '#fff', '#111');
    }
  }
}

function daylight(minute: number): number {
  const h = minute / 60;
  const sm = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  return sm(5.6, 7.2, h) * (1 - sm(17.8, 19.6, h));
}
