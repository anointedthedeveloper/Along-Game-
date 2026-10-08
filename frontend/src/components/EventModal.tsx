import { useState } from 'react';
import { AlertTriangle, Fuel, Gavel, Info, ShieldAlert, Siren, Users, Wrench, CloudRain, TrafficCone, TrendingUp, Construction } from 'lucide-react';
import { Button, Modal, cn } from '@/components/ui';
import type { Stage } from '@/game/stage';
import { useStage } from '@/hooks/useStage';
import { naira } from '@/lib/format';
import { applyEventResult, resolveEvent } from '@/store/actions';
import type { GameEvent } from '@/types';

const ICON: Record<string, typeof Info> = {
  HEAVY_TRAFFIC: TrafficCone, ACCIDENT_TRAFFIC: Siren, ROAD_CONSTRUCTION: Construction, ROAD_CLOSURE: TrafficCone, TRAFFIC_DIVERSION: TrafficCone,
  SUDDEN_RAIN: CloudRain, FLOODED_ROAD: CloudRain, VEHICLE_BREAKDOWN: Wrench, FLAT_TYRE: Wrench, ENGINE_OVERHEATING: Wrench,
  FUEL_SHORTAGE: Fuel, FUEL_SURCHARGE: Fuel, PASSENGER_CANCEL: Users, CHANGE_DESTINATION: Users, DISCOUNT_REQUEST: Users, VIP_PASSENGER: Users,
  DEMAND_SURGE: TrendingUp, POLICE_CHECKPOINT: Gavel, TRAFFIC_VIOLATION: Gavel, UNSAFE_AREA: ShieldAlert, ROBBERY_RISK: ShieldAlert,
};

const TONE = {
  INFO: { bar: 'bg-sky', text: 'text-sky' },
  WARNING: { bar: 'bg-taxi', text: 'text-taxi' },
  DANGER: { bar: 'bg-brake', text: 'text-[#ff8b80]' },
};

function chipsFrom(applied: Record<string, unknown>): Array<{ label: string; tone: 'good' | 'bad' | 'neutral' }> {
  const chips: Array<{ label: string; tone: 'good' | 'bad' | 'neutral' }> = [];
  const n = (k: string) => Number(applied[k] ?? 0);
  if (n('delayMin') > 0) chips.push({ label: `+${n('delayMin')} min delay`, tone: 'bad' });
  if (n('cash') > 0) chips.push({ label: `+${naira(n('cash'))}`, tone: 'good' });
  if (n('cash') < 0) chips.push({ label: `−${naira(-n('cash'))}`, tone: 'bad' });
  if (n('lostCash') > 0) chips.push({ label: `Lost ${naira(n('lostCash'))}`, tone: 'bad' });
  if (n('fareChange') > 0) chips.push({ label: `Fare +${naira(n('fareChange'))}`, tone: 'good' });
  if (n('fareChange') < 0) chips.push({ label: `Fare −${naira(-n('fareChange'))}`, tone: 'bad' });
  if (n('fuel') < 0) chips.push({ label: `${(-n('fuel')).toFixed(1)} L fuel used`, tone: 'bad' });
  if (n('fuel') > 0) chips.push({ label: `+${n('fuel').toFixed(0)} L fuel`, tone: 'good' });
  if (n('condition') < 0) chips.push({ label: `Vehicle −${Math.abs(n('condition'))}%`, tone: 'bad' });
  if (n('condition') > 0) chips.push({ label: `Vehicle +${n('condition')}%`, tone: 'good' });
  if (n('xp') > 0) chips.push({ label: `+${n('xp')} XP`, tone: 'good' });
  if (applied.cancelled) chips.push({ label: 'Trip ended', tone: 'neutral' });
  if (!chips.length) chips.push({ label: 'No lasting effect', tone: 'neutral' });
  return chips;
}

export function EventModal({ stage }: { stage: Stage }) {
  const snap = useStage(stage);
  const [busy, setBusy] = useState<string | null>(null);
  const event: GameEvent | null = snap.eventResult?.event ?? snap.activeEvent;
  if (!event) return null;
  const tone = TONE[event.severity];
  const Icon = ICON[event.type] ?? AlertTriangle;
  const result = snap.eventResult;

  async function choose(optionId: string) {
    if (!event) return;
    setBusy(optionId);
    const res = await resolveEvent(event.id, optionId);
    setBusy(null);
    if (!res) return;
    // Show the outcome first, then merge the new ride state once the player has read it.
    stage.setEventResult({ event, text: res.event.outcome?.message ?? '', chips: chipsFrom(res.applied as unknown as Record<string, unknown>) });
    applyEventResult(res);
  }

  return (
    <Modal open closable={false}>
      <div className={cn('h-1.5', tone.bar)} />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-white/10', tone.text)}><Icon className="h-6 w-6" /></span>
          <div>
            <p className={cn('text-[10px] font-semibold uppercase tracking-widest', tone.text)}>{event.category.replace('_', ' ')} · {event.severity}</p>
            <h2 className="font-display text-3xl font-extrabold uppercase leading-none">{event.title}</h2>
          </div>
        </div>
        <p className="mt-3 text-lg leading-snug">{event.description}</p>

        {!result ? (
          <div className="mt-4 space-y-2">
            {event.options.map((o) => (
              <button
                key={o.id}
                disabled={!!busy}
                onClick={() => void choose(o.id)}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:border-taxi hover:bg-taxi/10 disabled:opacity-60"
              >
                <span>
                  <span className="block font-display text-xl font-bold uppercase tracking-wide">{o.label}</span>
                  <span className="block text-sm text-asphalt-300">{o.hint}</span>
                </span>
                {busy === o.id && <span className="h-4 w-4 animate-spin rounded-full border-2 border-taxi border-t-transparent" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-lg">{result.text}</p>
            <div className="flex flex-wrap gap-2">
              {result.chips.map((c, i) => (
                <span key={i} className={cn('rounded-full px-3 py-1 text-sm font-semibold', c.tone === 'good' ? 'bg-abuja/20 text-[#7be3a6]' : c.tone === 'bad' ? 'bg-brake/20 text-[#ff9f95]' : 'bg-white/10')}>{c.label}</span>
              ))}
            </div>
            <Button className="w-full" size="lg" onClick={() => stage.setEventResult(null)}>Continue driving</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
