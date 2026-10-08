import { useEffect, useState } from 'react';
import { currentMinuteOfDay, formatClock } from '@/store/game';

/** Re-renders about once per real second with the extrapolated in-game time. */
export function useClock(): { label: string; minute: number } {
  const [minute, setMinute] = useState(currentMinuteOfDay());
  useEffect(() => {
    const id = setInterval(() => setMinute(currentMinuteOfDay()), 500);
    return () => clearInterval(id);
  }, []);
  return { label: formatClock(minute), minute };
}
