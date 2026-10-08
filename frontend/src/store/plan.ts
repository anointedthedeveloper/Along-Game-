import { create } from 'zustand';

/** The passenger's trip plan: where from, where to. */
interface PlanState {
  from: string | null;
  to: string | null;
  set: (which: 'from' | 'to', key: string | null) => void;
  swap: () => void;
  clear: () => void;
}

export const usePlan = create<PlanState>((set) => ({
  from: null,
  to: null,
  set: (which, key) => set({ [which]: key } as Partial<PlanState>),
  swap: () => set((s) => ({ from: s.to, to: s.from })),
  clear: () => set({ to: null }),
}));
