import { useState } from 'react';
import { Flag, Navigation, UserCheck, X } from 'lucide-react';
import { Button, Meter } from '@/components/ui';
import { cancelRide, startRide } from '@/store/actions';
import { useStage } from '@/hooks/useStage';
import type { Stage } from '@/game/stage';
import { useGame } from '@/store/game';
import { FareTag, PassengerChip, RideFacts, RouteLine } from './RideBits';
import { Stars } from '@/components/ui';
import { VehicleImage } from '@/components/VehicleImage';
import type { Ride } from '@/types';

const secs = (n: number) => `${Math.max(0, Math.ceil(n))}s`;

export function ActiveRideCard({ stage, ride }: { stage: Stage; ride: Ride }) {
  const snap = useStage(stage);
  const [busy, setBusy] = useState(false);
  const isDriver = ride.role === 'DRIVER';
  const events = (ride.events ?? []).filter((e) => e.status === 'RESOLVED').length;
  const fuel = useGame((s) => s.vehicle?.fuelPercent);

  let heading = '';
  let sub = '';
  let action: React.ReactNode = null;
  switch (snap.phase) {
    case 'MATCHING':
      heading = ride.status === 'REQUESTED' ? 'Finding you a driver…' : 'Driver found!';
      sub = 'Hold tight — matching nearby drivers.';
      break;
    case 'TO_PICKUP':
      heading = isDriver ? 'Heading to pick-up' : 'Your driver is on the way';
      sub = `${secs(snap.secondsLeft)} away`;
      break;
    case 'AT_PICKUP':
      heading = isDriver ? 'You have arrived' : 'Your driver has arrived';
      sub = isDriver ? `${ride.npcPassenger?.name} is waiting.` : 'Hop in when you are ready.';
      action = (
        <Button
          variant="green"
          size="lg"
          className="w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await startRide(ride.id);
            setBusy(false);
          }}
        >
          {isDriver ? <><UserCheck className="h-5 w-5" /> Pick up passenger</> : <><Navigation className="h-5 w-5" /> Board &amp; go</>}
        </Button>
      );
      break;
    case 'IN_TRIP':
      heading = isDriver ? 'Trip in progress' : 'On your way';
      sub = `${secs(snap.secondsLeft)} to ${ride.destination.name}`;
      break;
    case 'AT_DEST':
      heading = 'Arriving…';
      sub = isDriver ? 'Collecting your fare.' : 'Processing payment.';
      break;
    default:
      heading = 'Ride';
  }

  const canCancel = ride.status !== 'IN_PROGRESS';
  const showProgress = snap.phase === 'TO_PICKUP' || snap.phase === 'IN_TRIP' || snap.phase === 'AT_DEST';

  return (
    <div className="anim-slide-up pointer-events-auto mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-asphalt-900/95 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3 p-4 pb-3">
        {!isDriver && <VehicleImage cls={ride.vehicleClass} className="h-16 w-24 shrink-0 rounded-lg" />}
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-extrabold uppercase leading-none text-taxi">{heading}</p>
          <p className="mt-1 text-sm text-asphalt-300">{sub}</p>
        </div>
        <FareTag amount={ride.fare.final} />
      </div>
      <div className="space-y-3 border-t border-white/10 p-4 pt-3">
        <RouteLine ride={ride} compact />
        {isDriver ? (
          <div className="space-y-1">
            <PassengerChip ride={ride} />
            {ride.npcPassenger?.bio && <p className="text-sm italic text-asphalt-300">“{ride.npcPassenger.bio}”</p>}
          </div>
        ) : (
          ride.npcDriver && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">{ride.npcDriver.name}</span>
              <Stars value={ride.npcDriver.rating} size={12} />
              <span className="text-asphalt-300">{ride.npcDriver.vehicleName}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs tracking-wider">{ride.npcDriver.plate}</span>
            </div>
          )
        )}
        <RideFacts ride={ride} />
        {showProgress && <Meter value={snap.progress * 100} color="#f2b705" label={snap.phase === 'TO_PICKUP' ? 'To pick-up' : 'Trip'} right={`${Math.round(snap.progress * 100)}%`} />}
        {ride.delayMin > 0 && <p className="text-xs text-[#ffb59c]">Delays so far: +{ride.delayMin} min{events ? ` · ${events} incident${events > 1 ? 's' : ''}` : ''}</p>}
        {isDriver && typeof fuel === 'number' && fuel < 15 && <p className="text-xs text-[#ff8b80]">Low fuel — refill after this trip.</p>}
        {action}
        {canCancel && snap.phase !== 'AT_DEST' && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => cancelRide(ride.id)}>
            <X className="h-4 w-4" /> Cancel ride
          </Button>
        )}
        {snap.phase === 'AT_DEST' && (
          <p className="flex items-center justify-center gap-2 text-sm text-asphalt-300"><Flag className="h-4 w-4 text-taxi" /> Almost there</p>
        )}
      </div>
    </div>
  );
}
