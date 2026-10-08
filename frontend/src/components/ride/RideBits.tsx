import { ArrowRight, Clock, MapPin, Route } from 'lucide-react';
import { Badge, Stars } from '@/components/ui';
import { km, naira } from '@/lib/format';
import type { Ride } from '@/types';

export function RouteLine({ ride, compact }: { ride: Pick<Ride, 'origin' | 'destination'>; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">From</p>
        <p className={`truncate font-display font-bold uppercase leading-tight ${compact ? 'text-lg' : 'text-xl'}`}>{ride.origin.name}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-taxi" />
      <div className="min-w-0 flex-1 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-asphalt-300">To</p>
        <p className={`truncate font-display font-bold uppercase leading-tight ${compact ? 'text-lg' : 'text-xl'}`}>{ride.destination.name}</p>
      </div>
    </div>
  );
}

export function RideFacts({ ride }: { ride: Pick<Ride, 'distanceKm' | 'durationMin' | 'roads'> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-asphalt-300">
      <span className="flex items-center gap-1"><Route className="h-4 w-4" />{km(ride.distanceKm)}</span>
      <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{ride.durationMin} min</span>
      {ride.roads?.[0] && <span className="flex items-center gap-1 truncate"><MapPin className="h-4 w-4" />via {ride.roads[0]}</span>}
    </div>
  );
}

export function PassengerChip({ ride }: { ride: Ride }) {
  const p = ride.npcPassenger;
  if (!p) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{p.name}</span>
      <Stars value={p.rating} size={12} />
      {p.tier === 'VIP' && <Badge tone="gold">VIP</Badge>}
      {p.tier === 'PREMIUM' && <Badge tone="blue">Premium</Badge>}
      {(p.groupSize ?? 1) > 1 && <Badge>{p.groupSize} passengers</Badge>}
    </div>
  );
}

export const FareTag = ({ amount, big }: { amount: number; big?: boolean }) => (
  <span className={`font-display font-extrabold text-taxi tabular ${big ? 'text-4xl' : 'text-3xl'}`}>{naira(amount)}</span>
);
