import { useEffect, useMemo, useState } from 'react';
import { Fuel, MapPinned, Play, Power, Wrench, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyState, cn } from '@/components/ui';
import { acceptOffer, declineOffer, endDay, startDay, travelTo } from '@/store/actions';
import { useStage } from '@/hooks/useStage';
import type { Stage } from '@/game/stage';
import { gameApi } from '@/services';
import { naira } from '@/lib/format';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { haversine } from '@/lib/geo';
import type { Ride } from '@/types';
import { ActiveRideCard } from '@/components/ride/ActiveRideCard';
import { FareTag, PassengerChip, RouteLine } from '@/components/ride/RideBits';

function OfferCard({ offer, onAccept, onDecline }: { offer: Ride; onAccept: () => void; onDecline: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = offer.expiresAt ? Math.max(0, (new Date(offer.expiresAt).getTime() - now) / 1000) : 30;
  const frac = Math.min(1, left / 30);
  useEffect(() => {
    if (left <= 0) onDecline();
  }, [left, onDecline]);
  const premium = offer.npcPassenger?.tier !== 'STANDARD';
  return (
    <div className={cn('anim-pop pointer-events-auto relative w-[min(88vw,22rem)] shrink-0 snap-center overflow-hidden rounded-2xl border bg-asphalt-900/95 shadow-2xl backdrop-blur', premium ? 'border-taxi/70' : 'border-white/10')}>
      <div className="h-1 bg-white/10"><div className="h-full bg-taxi transition-[width] duration-300 ease-linear" style={{ width: `${frac * 100}%` }} /></div>
      <div className="space-y-2.5 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-display text-sm font-bold uppercase tracking-widest text-abuja"><Zap className="h-4 w-4" /> New ride</span>
          <span className="tabular text-xs text-asphalt-300">{Math.ceil(left)}s</span>
        </div>
        <RouteLine ride={offer} />
        <div className="flex items-end justify-between gap-2">
          <FareTag amount={offer.fare.final} big />
          <div className="text-right text-sm text-asphalt-300">
            <p>{offer.distanceKm} km · {offer.durationMin} min</p>
            <p>Pick-up {offer.pickupMin} min away</p>
          </div>
        </div>
        <PassengerChip ride={offer} />
        {offer.npcPassenger?.bio && <p className="text-xs italic text-asphalt-300">“{offer.npcPassenger.bio}”</p>}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" onClick={onDecline}>Decline</Button>
          <Button variant="green" onClick={onAccept}>Accept</Button>
        </div>
      </div>
    </div>
  );
}

function StartDayCard() {
  const vehicle = useGame((s) => s.vehicle);
  const me = useGame((s) => s.me);
  const world = useGame((s) => s.world);
  const map = useGame((s) => s.map);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Array<{ id: string; label: string; ok: boolean; detail: string }>>([]);
  const select = useUI((s) => s.select);

  useEffect(() => {
    gameApi.checklist().then((r) => setList(r.items)).catch(() => undefined);
  }, [vehicle?.fuel, vehicle?.condition, vehicle?.cleanliness, me?.cash]);

  const nearest = useMemo(() => {
    if (!map || !me?.location) return null;
    const here = me.location.pos;
    const stations = map.locations.filter((l) => l.type === 'PETROL_STATION').sort((a, b) => haversine(here, a.pos) - haversine(here, b.pos));
    return stations[0] ?? null;
  }, [map, me]);

  const lowFuel = (vehicle?.fuelPercent ?? 100) < 25;

  return (
    <div className="anim-slide-up pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-asphalt-900/95 p-4 shadow-2xl backdrop-blur">
      <p className="font-display text-3xl font-extrabold uppercase leading-none">Start your day</p>
      <p className="mt-1 text-sm text-asphalt-300">Check the car, check the fuel, then hit the road. Fuel today: ₦{world?.fuelPrice ?? '—'}/L.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {list.map((i) => (
          <li key={i.id} className={cn('rounded-lg border px-3 py-2 text-sm', i.ok ? 'border-abuja/40 bg-abuja/10' : 'border-taxi/50 bg-taxi/10')}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">{i.label}</p>
            <p className="font-semibold">{i.detail}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="green"
          size="lg"
          className="col-span-2"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await startDay();
            setBusy(false);
          }}
        >
          <Play className="h-5 w-5" /> Start day
        </Button>
        {nearest && (
          <Button variant={lowFuel ? 'primary' : 'dark'} size="sm" onClick={() => select(nearest.key)}>
            <Fuel className="h-4 w-4" /> {lowFuel ? 'Low fuel — ' : ''}Petrol station
          </Button>
        )}
        <Link to="/garage" className="contents">
          <Button variant="dark" size="sm"><Wrench className="h-4 w-4" /> Garage</Button>
        </Link>
      </div>
    </div>
  );
}

function IdleCard({ stage }: { stage: Stage }) {
  void stage;
  const offers = useGame((s) => s.offers);
  const progress = useGame((s) => s.progress);
  const [ending, setEnding] = useState(false);
  const [confirm, setConfirm] = useState<null | { summary: { day: number; earnings: number; expenses: number; rides: number; net: number; grade: string } }>(null);

  useEffect(() => {
    void useGame.getState().loadOffers();
    const id = setInterval(() => void useGame.getState().loadOffers(), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none flex w-full flex-col gap-2">
      <div className="pointer-events-auto flex snap-x snap-mandatory justify-start gap-3 overflow-x-auto px-3 pb-1 sm:justify-center scroll-thin">
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} onAccept={() => void acceptOffer(o.id)} onDecline={() => void declineOffer(o.id)} />
        ))}
        {!offers.length && (
          <div className="pointer-events-auto w-full max-w-md">
            <EmptyState icon={<MapPinned className="h-7 w-7" />} title="Looking for passengers" hint="Requests arrive as demand rises. Rush hours and rain are busiest. Try a busier district such as Wuse or Garki." />
          </div>
        )}
      </div>
      <div className="pointer-events-auto mx-auto flex gap-2 px-3">
        <Button
          variant="dark"
          size="sm"
          loading={ending}
          onClick={async () => {
            setEnding(true);
            const res = await endDay();
            setEnding(false);
            if (res) setConfirm({ summary: res.summary });
          }}
        >
          <Power className="h-4 w-4" /> End day
        </Button>
        <span className="flex items-center rounded-lg bg-asphalt-900/90 px-3 text-xs text-asphalt-300 backdrop-blur">
          {progress?.day.rides ?? 0} rides today · {naira(progress?.day.earnings)} earned
        </span>
      </div>
      {confirm && <DaySummary data={confirm.summary} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function DaySummary({ data, onClose }: { data: { day: number; earnings: number; expenses: number; rides: number; net: number; grade: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
      <div className="anim-pop w-full max-w-sm rounded-2xl border border-white/10 bg-asphalt-800 p-5 text-center">
        <Badge tone="gold">Day {data.day} complete</Badge>
        <p className="mt-2 font-display text-5xl font-extrabold uppercase text-taxi">{data.grade}</p>
        <dl className="mt-4 space-y-2 text-left text-sm">
          <div className="flex justify-between"><dt className="text-asphalt-300">Rides</dt><dd className="tabular font-semibold">{data.rides}</dd></div>
          <div className="flex justify-between"><dt className="text-asphalt-300">Earnings</dt><dd className="tabular font-semibold text-abuja">{naira(data.earnings)}</dd></div>
          <div className="flex justify-between"><dt className="text-asphalt-300">Expenses</dt><dd className="tabular font-semibold text-[#ff8b80]">−{naira(data.expenses)}</dd></div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-base"><dt>Net</dt><dd className="tabular font-bold">{naira(data.net)}</dd></div>
        </dl>
        <Button className="mt-5 w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

export function DriverDock({ stage }: { stage: Stage }) {
  const ride = useGame((s) => s.ride);
  const me = useGame((s) => s.me);
  const dayActive = useGame((s) => s.progress?.day.active);
  const snap = useStage(stage);
  const selectedKey = useUI((s) => s.selectedKey);

  if (!me) return null;
  let body: React.ReactNode;
  if (ride && ride.role === 'DRIVER') body = <ActiveRideCard stage={stage} ride={ride} />;
  else if (snap.phase === 'TRAVELLING') {
    body = (
      <div className="anim-slide-up pointer-events-auto mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-asphalt-900/95 p-4 text-center shadow-2xl backdrop-blur">
        <p className="font-display text-2xl font-extrabold uppercase text-taxi">On the road</p>
        <p className="text-sm text-asphalt-300">Arriving at {useGame.getState().map?.locations.find((l) => l.key === me.travel?.toKey)?.name} in {Math.ceil(snap.secondsLeft)}s</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-taxi" style={{ width: `${snap.progress * 100}%` }} /></div>
      </div>
    );
  } else if (selectedKey) body = null;
  else if (!dayActive) body = <StartDayCard />;
  else body = <IdleCard stage={stage} />;

  return <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] flex justify-center p-3 pb-4">{body}</div>;
}

export { travelTo };
