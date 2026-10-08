import { useEffect, useMemo, useRef } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { ErrorState, Spinner } from '@/components/ui';
import { MapStage } from '@/components/MapStage';
import { TopHud } from '@/components/hud/TopHud';
import { MenuDrawer } from '@/components/hud/MenuDrawer';
import { DriverDock } from '@/components/driver/DriverDock';
import { PassengerDock } from '@/components/passenger/PassengerDock';
import { LocationSheet } from '@/components/LocationSheet';
import { EventModal } from '@/components/EventModal';
import { SummaryModal } from '@/components/SummaryModal';
import type { CityEngine } from '@/game/engine';
import { Stage } from '@/game/stage';
import { useRealtime } from '@/hooks/useRealtime';
import { useGame } from '@/store/game';
import { usePlan } from '@/store/plan';
import { useUI } from '@/store/ui';
import { worldApi } from '@/services';

export default function Play() {
  const stage = useMemo(() => new Stage(), []);
  const engineRef = useRef<CityEngine | null>(null);
  const { map, mapError, me, loading, error } = useGame();
  const mode = me?.mode;

  useRealtime(true);

  useEffect(() => {
    void useGame.getState().loadMap();
    void useGame.getState().refresh();
    // Fallback sync in case the socket is unavailable.
    const id = setInterval(() => {
      worldApi.world().then((r) => useGame.getState().setWorld(r.world)).catch(() => undefined);
    }, 15000);
    return () => {
      clearInterval(id);
      usePlan.setState({ from: null, to: null });
      useUI.getState().select(null);
    };
  }, []);

  // Keep the camera on the player's start position until a trip begins following them.
  const locKey = me?.locationKey;
  useEffect(() => {
    if (!map || !locKey) return;
    const loc = map.locations.find((l) => l.key === locKey);
    if (loc && !useGame.getState().ride && !useGame.getState().me?.travel) engineRef.current?.flyTo(loc.pos);
  }, [locKey, map]);

  // Selecting a place pans to it.
  const selected = useUI((s) => s.selectedKey);
  useEffect(() => {
    if (!selected || !map) return;
    const loc = map.locations.find((l) => l.key === selected);
    if (loc && engineRef.current) engineRef.current.flyTo(loc.pos, Math.max(engineRef.current.map.getZoom(), 16));
  }, [selected, map]);

  if (mapError || error) {
    return <div className="flex h-full items-center justify-center p-6"><ErrorState message={mapError ?? error ?? ''} onRetry={() => { void useGame.getState().loadMap(); void useGame.getState().refresh(); }} /></div>;
  }
  if (!map || !me || loading) {
    return <div className="flex h-full items-center justify-center"><Spinner label="Loading the city…" /></div>;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-asphalt-900">
      <MapStage stage={stage} engineRef={engineRef} />
      <TopHud />
      <div className="absolute right-3 top-40 z-[600] flex flex-col gap-1.5 sm:top-32">
        <MapButton label="Zoom in" onClick={() => engineRef.current?.map.zoomIn(1, { animate: false })}><ZoomIn className="h-5 w-5" /></MapButton>
        <MapButton label="Zoom out" onClick={() => engineRef.current?.map.zoomOut(1, { animate: false })}><ZoomOut className="h-5 w-5" /></MapButton>
        <MapButton
          label="Centre on me"
          onClick={() => {
            const loc = map.locations.find((l) => l.key === useGame.getState().me?.locationKey);
            const a = stage.frame.actors[0];
            const pos = a?.pos ?? loc?.pos;
            if (pos) engineRef.current?.flyTo(pos, 16.5);
          }}
        >
          <Crosshair className="h-5 w-5" />
        </MapButton>
      </div>
      {mode === 'DRIVER' ? <DriverDock stage={stage} /> : <PassengerDock stage={stage} onPreview={(pts) => engineRef.current?.fitRoute(pts, 110)} />}
      <LocationSheet />
      <EventModal stage={stage} />
      <SummaryModal />
      <MenuDrawer />
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-asphalt-900/90 backdrop-blur hover:bg-asphalt-800">
      {children}
    </button>
  );
}
