import { worldApi } from '@/services';
import { useGame } from '@/store/game';
import { usePlan } from '@/store/plan';
import { completeRide } from '@/store/actions';
import type { GameEvent, LatLng, Ride } from '@/types';
import type { Actor, FrameState, Pin } from './engine';
import { cumulative, fromWorld, sampleAlong, toWorld, type Pt } from './projection';

export type StagePhase = 'IDLE' | 'TRAVELLING' | 'MATCHING' | 'TO_PICKUP' | 'AT_PICKUP' | 'IN_TRIP' | 'AT_DEST';

export interface StageSnapshot {
  phase: StagePhase;
  /** 0..1 progress along the current leg. */
  progress: number;
  secondsLeft: number;
  activeEvent: GameEvent | null;
  eventResult: { event: GameEvent; text: string; chips: Array<{ label: string; tone: 'good' | 'bad' | 'neutral' }> } | null;
}

interface Leg {
  key: string;
  latlng: LatLng[];
  world: Pt[];
  cum: number[];
}

const VEHICLE_FALLBACK = '#f4f4f0';

/**
 * Drives everything the player sees moving on the map. It reads the
 * authoritative game state from the store and turns it into animation: the
 * server decides when legs begin and the minimum time they take, the stage only
 * interpolates along the server-provided route and raises events at the right spot.
 */
export class Stage {
  private legs = new Map<string, Leg>();
  private lastHeading = 0;
  private tripProgress = 0;
  private tripRideId: string | null = null;
  private completing = false;
  private travelRoute: { key: string; leg: Leg } | null = null;
  private travelLoading = '';
  private travelResolved = '';
  private listeners = new Set<() => void>();
  private snap: StageSnapshot = { phase: 'IDLE', progress: 0, secondsLeft: 0, activeEvent: null, eventResult: null };
  private shownEvents = new Set<string>();
  readonly frame: FrameState = { actors: [], pins: [], route: null, secondaryRoute: null, follow: null, selectedLocation: null, highlightTypes: [] };
  selected: string | null = null;
  highlight: string[] = [];
  /** Passenger fare preview route, shown while planning a trip. */
  preview: LatLng[] | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  private emit(next: StageSnapshot) {
    const a = this.snap;
    const changed =
      a.phase !== next.phase ||
      Math.round(a.progress * 100) !== Math.round(next.progress * 100) ||
      Math.round(a.secondsLeft) !== Math.round(next.secondsLeft) ||
      a.activeEvent?.id !== next.activeEvent?.id ||
      a.eventResult !== next.eventResult;
    if (changed) {
      this.snap = next;
      this.listeners.forEach((l) => l());
    }
  }

  setEventResult(r: StageSnapshot['eventResult']) {
    this.emit({ ...this.snap, eventResult: r });
  }

  private leg(key: string, pts: LatLng[]): Leg {
    const hit = this.legs.get(key);
    if (hit) return hit;
    const world = pts.map(toWorld);
    const leg = { key, latlng: pts, world, cum: cumulative(world) };
    this.legs.set(key, leg);
    if (this.legs.size > 12) this.legs.delete(this.legs.keys().next().value as string);
    return leg;
  }

  private place(leg: Leg, t: number): { pos: LatLng; heading: number } {
    const total = leg.cum[leg.cum.length - 1];
    const s = sampleAlong(leg.world, leg.cum, total * t);
    const ahead = sampleAlong(leg.world, leg.cum, Math.min(total, total * t + total * 0.004 + 1e-9));
    const heading = total > 0 && (ahead.p[0] !== s.p[0] || ahead.p[1] !== s.p[1]) ? Math.atan2(ahead.p[1] - s.p[1], ahead.p[0] - s.p[0]) : s.heading;
    this.lastHeading = heading;
    return { pos: fromWorld(s.p), heading };
  }

  private lastT = performance.now();

  /** Called every animation frame by the engine. */
  step(): FrameState {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    return this.tick(dt);
  }

  tick(dt: number): FrameState {
    const g = useGame.getState();
    const f = this.frame;
    f.actors = [];
    f.pins = [];
    f.route = null;
    f.secondaryRoute = null;
    f.follow = null;
    f.selectedLocation = this.selected;
    f.highlightTypes = this.highlight;

    const { me, ride, vehicle, map } = g;
    if (!me || !map) return f;
    const now = Date.now() + g.skew;
    const loc = map.locations.find((l) => l.key === me.locationKey);
    const here: LatLng = loc ? loc.pos : [9.0745, 7.4755];
    let phase: StagePhase = 'IDLE';
    let progress = 0;
    let secondsLeft = 0;
    let activeEvent: GameEvent | null = this.snap.activeEvent;

    const driverVeh = { cls: vehicle?.cls ?? 'SEDAN_TAXI', color: vehicle?.color ?? VEHICLE_FALLBACK };

    if (ride && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED') {
      const npcVeh = { cls: ride.vehicleClass, color: ride.npcDriver?.color ?? VEHICLE_FALLBACK };
      const veh = ride.role === 'DRIVER' ? driverVeh : npcVeh;
      const origin: LatLng = [ride.origin.lat, ride.origin.lng];
      const dest: LatLng = [ride.destination.lat, ride.destination.lng];
      const pickPin: Pin = { id: 'pickup', pos: origin, kind: 'pickup', label: ride.role === 'DRIVER' ? ride.npcPassenger?.name : 'Pick-up' };
      const dropPin: Pin = { id: 'drop', pos: dest, kind: 'dropoff', label: ride.destination.name };

      if (ride.status === 'REQUESTED' || ride.status === 'MATCHED') {
        phase = 'MATCHING';
        f.pins.push(pickPin, dropPin);
        f.follow = origin;
      } else if (ride.status === 'DRIVER_ARRIVING') {
        const leg = this.leg(`${ride.id}:pickup`, ride.pickupGeometry.length > 1 ? ride.pickupGeometry : [here, origin]);
        const start = ride.arrivingAt ? new Date(ride.arrivingAt).getTime() : now;
        const dur = Math.max(0.2, ride.timing.pickupSeconds);
        const p = Math.min(1, Math.max(0, (now - start) / 1000 / dur));
        const { pos, heading } = this.place(leg, p);
        progress = p;
        secondsLeft = Math.max(0, dur * (1 - p));
        phase = p >= 0.999 ? 'AT_PICKUP' : 'TO_PICKUP';
        f.actors.push({ id: 'me', pos, heading, cls: veh.cls, color: veh.color, moving: p < 0.999, primary: true, label: ride.role === 'DRIVER' ? 'YOU' : ride.npcDriver?.name });
        f.route = { pts: leg.latlng, progress: p, color: '#4fc3f7' };
        f.secondaryRoute = { pts: ride.geometry, color: '#f2b705' };
        f.pins.push(pickPin, dropPin);
        f.follow = pos;
        this.tripRideId = null;
      } else if (ride.status === 'IN_PROGRESS') {
        const leg = this.leg(`${ride.id}:trip`, ride.geometry);
        if (this.tripRideId !== ride.id) {
          this.tripRideId = ride.id;
          const startedAt = ride.startedAt ? new Date(ride.startedAt).getTime() : now;
          this.tripProgress = Math.min(0.97, Math.max(0, (now - startedAt) / 1000 / Math.max(1, ride.timing.tripSeconds)));
          this.completing = false;
        }
        const events = (ride.events ?? []).slice().sort((a, b) => a.triggerAt - b.triggerAt);
        const due = events.find((e) => e.status === 'PENDING' && e.triggerAt <= this.tripProgress);
        const paused = !!this.snap.eventResult || !!activeEvent;
        if (due && !activeEvent && !this.snap.eventResult) {
          activeEvent = due;
          this.shownEvents.add(due.id);
        }
        if (activeEvent && !events.some((e) => e.id === activeEvent!.id && e.status === 'PENDING') && !this.snap.eventResult) activeEvent = null;
        if (!paused && !due) this.tripProgress = Math.min(1, this.tripProgress + dt / Math.max(1, ride.timing.tripSeconds));
        const p = this.tripProgress;
        const { pos, heading } = this.place(leg, p);
        progress = p;
        secondsLeft = Math.max(0, ride.timing.tripSeconds * (1 - p));
        phase = p >= 0.999 ? 'AT_DEST' : 'IN_TRIP';
        f.actors.push({ id: 'me', pos, heading, cls: veh.cls, color: veh.color, moving: !paused && p < 0.999, primary: true, label: ride.role === 'DRIVER' ? 'YOU' : 'Your ride' });
        f.route = { pts: leg.latlng, progress: p, color: '#f2b705' };
        f.pins.push(dropPin);
        if (activeEvent) f.pins.push({ id: 'event', pos, kind: 'event', severity: activeEvent.severity });
        f.follow = pos;
        if (p >= 0.999 && !this.completing && !activeEvent && !this.snap.eventResult) {
          this.completing = true;
          void completeRide(ride.id).then((ok) => {
            if (!ok) this.completing = false;
          });
        }
      }
    } else {
      this.tripRideId = null;
      this.completing = false;
      activeEvent = null;
      const travel = me.travel;
      if (travel && new Date(travel.arriveAt).getTime() > now - 50) {
        const key = `${travel.fromKey}>${travel.toKey}@${travel.startedAt}`;
        if (this.travelRoute?.key !== key && this.travelLoading !== key) {
          this.travelLoading = key;
          const from = travel.fromKey;
          const to = travel.toKey;
          worldApi
            .route(from, to, vehicle?.specId ?? 'sedan_taxi')
            .then((r) => {
              this.travelRoute = { key, leg: this.leg(key, r.route.geometry as LatLng[]) };
            })
            .catch(() => undefined);
        }
        const start = new Date(travel.startedAt).getTime();
        const end = new Date(travel.arriveAt).getTime();
        const p = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
        progress = p;
        secondsLeft = Math.max(0, (end - now) / 1000);
        phase = 'TRAVELLING';
        if (this.travelRoute?.key === key) {
          const { pos, heading } = this.place(this.travelRoute.leg, p);
          f.actors.push({ id: 'me', pos, heading, cls: driverVeh.cls, color: driverVeh.color, moving: true, primary: true, label: 'YOU' });
          f.route = { pts: this.travelRoute.leg.latlng, progress: p, color: '#4fc3f7' };
          f.follow = pos;
        } else {
          f.actors.push({ id: 'me', pos: here, heading: this.lastHeading, cls: driverVeh.cls, color: driverVeh.color, moving: false, primary: true, label: 'YOU' });
        }
      } else {
        if (me.travel && this.travelResolved !== me.travel.startedAt) {
          // Arrived: let the server move us to the destination.
          this.travelResolved = me.travel.startedAt;
          void g.refresh();
        }
        if (me.mode === 'PASSENGER') {
          const plan = usePlan.getState();
          const from = map.locations.find((l) => l.key === plan.from);
          const to = map.locations.find((l) => l.key === plan.to);
          if (from) f.pins.push({ id: 'from', pos: from.pos, kind: 'pickup', label: from.name });
          if (to) f.pins.push({ id: 'to', pos: to.pos, kind: 'dropoff', label: to.name });
          if (this.preview && to) f.secondaryRoute = { pts: this.preview, color: '#f2b705' };
        }
        if (me.mode === 'DRIVER') {
          f.actors.push({ id: 'me', pos: here, heading: this.lastHeading, cls: driverVeh.cls, color: driverVeh.color, moving: false, primary: true, label: 'YOU' });
        } else if (!usePlan.getState().from) {
          f.pins.push({ id: 'you', pos: here, kind: 'pickup', label: 'You are here' });
        }
      }
    }
    this.emit({ phase, progress, secondsLeft, activeEvent, eventResult: this.snap.eventResult });
    return f;
  }
}

export type { Ride, Actor };
