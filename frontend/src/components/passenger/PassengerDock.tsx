import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Banknote, Landmark, Users } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Stars, cn } from '@/components/ui';
import { ActiveRideCard } from '@/components/ride/ActiveRideCard';
import { VehicleImage } from '@/components/VehicleImage';
import type { Stage } from '@/game/stage';
import { ApiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { rideApi } from '@/services';
import { useGame } from '@/store/game';
import { usePlan } from '@/store/plan';
import { toast } from '@/store/toast';
import { useUI } from '@/store/ui';
import type { LatLng, Quote, QuoteOption } from '@/types';
import { LocationPicker } from './LocationPicker';

export function PassengerDock({ stage, onPreview }: { stage: Stage; onPreview: (pts: LatLng[]) => void }) {
  const ride = useGame((s) => s.ride);
  const me = useGame((s) => s.me);
  const selectedKey = useUI((s) => s.selectedKey);
  if (!me) return null;
  const body = ride && ride.role === 'PASSENGER' ? <ActiveRideCard stage={stage} ride={ride} /> : selectedKey ? null : <Planner stage={stage} onPreview={onPreview} />;
  return <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] flex justify-center p-3 pb-4">{body}</div>;
}

function Planner({ stage, onPreview }: { stage: Stage; onPreview: (pts: LatLng[]) => void }) {
  const me = useGame((s) => s.me)!;
  const plan = usePlan();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pay, setPay] = useState<'CASH' | 'BANK'>('CASH');
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  // The passenger always starts from where they are standing.
  useEffect(() => {
    if (!plan.from) plan.set('from', me.locationKey);
  }, [me.locationKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stale quotes must not survive a changed plan.
  useEffect(() => {
    setQuote(null);
    setChosen(null);
    setError(null);
    stage.preview = null;
  }, [plan.from, plan.to, stage]);

  async function check() {
    if (!plan.from || !plan.to) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const q = await rideApi.quote(plan.from, plan.to);
      if (id !== reqId.current) return;
      setQuote(q);
      setChosen(q.options.find((o) => o.available)?.optionId ?? null);
      stage.preview = q.geometry;
      onPreview(q.geometry);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load fares');
    } finally {
      setLoading(false);
    }
  }

  const option = quote?.options.find((o) => o.optionId === chosen) ?? null;
  const canAfford = option ? (pay === 'CASH' ? me.cash : me.bank) >= option.fare : true;

  async function request() {
    if (!option?.quoteToken) return;
    setBusy(true);
    try {
      const { ride } = await rideApi.request(option.quoteToken, pay);
      stage.preview = null;
      usePlan.getState().clear();
      useGame.getState().setRide(ride);
      void useGame.getState().refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'QUOTE_EXPIRED') {
        toast.warn(e.message);
        void check();
      } else toast.error(e instanceof ApiError ? e.message : 'Could not request the ride');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="anim-slide-up pointer-events-auto flex max-h-[78vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-asphalt-900/97 shadow-2xl backdrop-blur">
      <div className="space-y-2 p-4 pb-3">
        <LocationPicker label="From" tone="from" target="from" value={plan.from} onChange={(k) => plan.set('from', k)} exclude={plan.to} />
        <div className="flex items-center gap-2">
          <div className="flex-1"><LocationPicker label="To" tone="to" target="to" value={plan.to} onChange={(k) => plan.set('to', k)} exclude={plan.from} /></div>
          <button aria-label="Swap" onClick={plan.swap} className="rounded-xl border border-white/10 bg-asphalt-950/70 p-3 hover:border-white/25"><ArrowDownUp className="h-5 w-5" /></button>
        </div>
        {!quote && (
          <Button size="lg" className="w-full" disabled={!plan.from || !plan.to} loading={loading} onClick={check}>
            {plan.to ? 'See fares' : 'Where to?'}
          </Button>
        )}
        {error && <ErrorState message={error} onRetry={check} />}
      </div>

      {quote && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-white/10">
          <div className="flex items-center justify-between px-4 pt-3 text-sm text-asphalt-300">
            <span>{quote.distanceKm} km{quote.roads[0] ? ` · via ${quote.roads[0]}` : ''}</span>
            <button className="font-semibold text-taxi hover:underline" onClick={check}>Refresh</button>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 scroll-thin">
            {quote.options.map((o) => (
              <OptionRow key={o.optionId} o={o} active={o.optionId === chosen} onPick={() => o.available && setChosen(o.optionId)} />
            ))}
            {!quote.options.some((o) => o.available) && <EmptyState title="No rides available" hint="Nothing can serve this route right now. Try different places." />}
          </ul>
          <div className="space-y-2 border-t border-white/10 p-3">
            <div className="grid grid-cols-2 gap-2">
              {(['CASH', 'BANK'] as const).map((m) => (
                <button key={m} onClick={() => setPay(m)} className={cn('flex items-center justify-between rounded-lg border px-3 py-2 text-sm', pay === m ? 'border-taxi bg-taxi/10' : 'border-white/10 bg-white/5')}>
                  <span className="flex items-center gap-2">{m === 'CASH' ? <Banknote className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}{m === 'CASH' ? 'Cash' : 'Bank'}</span>
                  <span className="tabular text-asphalt-300">{naira(m === 'CASH' ? me.cash : me.bank)}</span>
                </button>
              ))}
            </div>
            <Button size="lg" className="w-full" disabled={!option || !canAfford} loading={busy} onClick={request}>
              {option ? (canAfford ? `Request ride · ${naira(option.fare)}` : `Not enough ${pay === 'CASH' ? 'cash' : 'in bank'}`) : 'Choose a ride'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({ o, active, onPick }: { o: QuoteOption; active: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        onClick={onPick}
        disabled={!o.available}
        className={cn('flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors', active ? 'border-taxi bg-taxi/10' : 'border-white/10 bg-white/5 hover:bg-white/10', !o.available && 'cursor-not-allowed opacity-45')}
      >
        <VehicleImage cls={o.vehicleClass} className="h-16 w-24 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold uppercase leading-tight">{o.vehicleName}</p>
          {o.available ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-asphalt-300">
              <Stars value={o.driver.rating} size={12} />
              <span>{o.etaMin} min away</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{o.capacity}</span>
              {o.surge > 1.15 && <Badge tone="gold">Busy {o.surge.toFixed(1)}×</Badge>}
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-[#ffb59c]">{o.reason}</p>
          )}
        </div>
        <div className="text-right">
          {o.available ? <p className="font-display text-3xl font-extrabold leading-none text-taxi tabular">{naira(o.fare)}</p> : <p className="text-xs uppercase text-asphalt-300">N/A</p>}
          {o.available && <p className="text-xs text-asphalt-300">{o.durationMin} min trip</p>}
        </div>
      </button>
    </li>
  );
}
