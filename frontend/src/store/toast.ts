import { create } from 'zustand';

export interface Toast { id: number; kind: 'info' | 'success' | 'error' | 'warn'; text: string }
let nextId = 1;

interface ToastState {
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string, ms?: number) => void;
  dismiss: (id: number) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, text, ms = 4200) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (t: string) => useToasts.getState().push('info', t),
  success: (t: string) => useToasts.getState().push('success', t),
  error: (t: string) => useToasts.getState().push('error', t, 6000),
  warn: (t: string) => useToasts.getState().push('warn', t, 5000),
};
