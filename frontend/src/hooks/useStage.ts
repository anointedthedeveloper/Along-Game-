import { useSyncExternalStore } from 'react';
import type { Stage } from '@/game/stage';

export const useStage = (stage: Stage) => useSyncExternalStore(stage.subscribe, stage.getSnapshot);
