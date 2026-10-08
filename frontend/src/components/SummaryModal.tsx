import { useState } from 'react';
import { Award, Star } from 'lucide-react';
import { Badge, Button, Modal, cn } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { rideApi } from '@/services';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import { RouteLine } from '@/components/ride/RideBits';

const FACTOR_LABEL: Record<string, string> = {
  cleanliness: 'Cleanliness', vehicleCondition: 'Vehicle condition', comfort: 'Comfort', punctuality: 'Punctuality', choices: 'Your decisions', highExpectations: 'VIP expectations',
};

export function SummaryModal() {
  const summary = useGame((s) => s.summary);
  const close = () => useGame.getState().showSummary(null);
  const [stars, setStars] = useState(5);
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!summary) return null;
  const { ride, summary: s } = summary;
  const driver = ride.role === 'DRIVER';

  async function submitRating() {
    setBusy(true);
    try {
      await rideApi.rate(ride.id, { stars, tip: tip || undefined });
      toast.success(tip ? `Thanks! ${naira(tip)} tip sent.` : 'Thanks for rating your driver.');
      void useGame.getState().refresh();
      close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send rating');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={driver ? close : undefined} closable={driver}>
      <div className="bg-gradient-to-b from-abuja/25 to-transparent p-5 pb-3">
        <Badge tone="green">{driver ? 'Trip complete' : 'You have arrived'}</Badge>
        <p className="mt-2 font-display text-6xl font-extrabold leading-none text-taxi tabular">{naira(driver ? s.earnings : s.paid)}</p>
        <p className="text-sm text-asphalt-300">{driver ? 'Fare received' : 'Fare paid'}{driver && s.tip ? ` · plus ${naira(s.tip)} tip` : ''}</p>
      </div>
      <div className="space-y-4 p-5 pt-2">
        <RouteLine ride={ride} compact />
        {!driver && !!s.unpaid && <p className="rounded-lg border border-taxi/40 bg-taxi/10 p-3 text-sm">You were short by {naira(s.unpaid)} — the driver took everything you had. Keep more cash handy.</p>}
        {s.levelUp && (
          <div className="flex items-center gap-3 rounded-xl border border-taxi/60 bg-taxi/10 p-3">
            <Award className="h-8 w-8 text-taxi" />
            <div>
              <p className="font-display text-xl font-extrabold uppercase text-taxi">Level up!</p>
              <p className="text-sm">You are now Level {s.levelUp.to} — {s.levelUp.title}.</p>
            </div>
          </div>
        )}
        {driver ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Passenger rating" value={<span className="flex items-center justify-center gap-1 text-taxi"><Star className="h-4 w-4 fill-current" />{s.rating}</span>} />
              <Stat label="Fuel used" value={`${s.fuelUsed ?? 0} L`} />
              <Stat label="XP" value={`+${s.xp}`} />
            </div>
            {s.ratingComment && <p className="rounded-lg bg-white/5 p-3 text-sm italic">“{s.ratingComment}”</p>}
            {s.ratingFactors && Object.keys(s.ratingFactors).length > 0 && (
              <ul className="space-y-1 text-sm">
                {Object.entries(s.ratingFactors).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-asphalt-300">{FACTOR_LABEL[k] ?? k}</span>
                    <span className={cn('tabular font-semibold', v > 0 ? 'text-abuja' : 'text-[#ff8b80]')}>{v > 0 ? '+' : ''}{v.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.late && <p className="text-sm text-[#ffb59c]">The passenger noticed the delays — arriving late hurts your reputation.</p>}
            <Button className="w-full" size="lg" onClick={close}>Back on the road</Button>
          </>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-asphalt-300">Rate {ride.npcDriver?.name}</p>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} stars`} onClick={() => setStars(n)} className="p-1">
                    <Star className={cn('h-9 w-9 transition-colors', n <= stars ? 'fill-taxi text-taxi' : 'text-asphalt-500')} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-asphalt-300">Tip your driver</p>
              <div className="grid grid-cols-4 gap-2">
                {[0, 200, 500, 1000].map((t) => (
                  <button key={t} onClick={() => setTip(t)} className={cn('rounded-lg border py-2 text-sm font-semibold', tip === t ? 'border-taxi bg-taxi/15' : 'border-white/10 bg-white/5')}>{t ? naira(t) : 'None'}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={close}>Skip</Button>
              <Button loading={busy} onClick={submitRating}>Send rating</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-2.5">
      <p className="font-display text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-asphalt-300">{label}</p>
    </div>
  );
}
