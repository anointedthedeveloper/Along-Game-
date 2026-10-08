import { useEffect, useRef } from 'react';
import { CityEngine } from '@/game/engine';
import type { Stage } from '@/game/stage';
import { currentMinuteOfDay, useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { usePlan } from '@/store/plan';

interface Props {
  stage: Stage;
  engineRef: React.MutableRefObject<CityEngine | null>;
}

/** Hosts the Leaflet map + procedural city engine. Everything inside is canvas; React only mounts it. */
export function MapStage({ stage, engineRef }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useGame((s) => s.map);

  useEffect(() => {
    if (!map || !el.current) return;
    const g = useGame.getState();
    const loc = map.locations.find((l) => l.key === g.me?.locationKey);
    const engine = new CityEngine(el.current, {
      data: map,
      getFrame: () => stage.step(),
      getEnv: () => {
        const s = useGame.getState();
        const w = s.world;
        return {
          minuteOfDay: currentMinuteOfDay(),
          weather: w?.weather.kind ?? 'SUNNY',
          intensity: w?.weather.intensity ?? 0,
          traffic: w?.traffic ?? 0.4,
          incidents: w?.incidents ?? [],
        };
      },
      onLocationClick: (l) => {
        const ui = useUI.getState();
        if (l && ui.pickTarget) {
          usePlan.getState().set(ui.pickTarget, l.key);
          ui.setPickTarget(null);
          return;
        }
        ui.select(l ? l.key : null);
      },
      initialCenter: loc?.pos ?? [9.0745, 7.4755],
      initialZoom: 16,
    });
    engineRef.current = engine;
    const unsub = useUI.subscribe((s) => {
      stage.selected = s.selectedKey;
    });
    return () => {
      unsub();
      engine.destroy();
      engineRef.current = null;
    };
  }, [map, stage, engineRef]);

  return <div ref={el} className="absolute inset-0" aria-label="City map" />;
}
