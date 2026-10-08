import { create } from 'zustand';

interface UIState {
  selectedKey: string | null;
  pickTarget: null | 'from' | 'to';
  menuOpen: boolean;
  select: (key: string | null) => void;
  setPickTarget: (t: UIState['pickTarget']) => void;
  setMenu: (open: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  selectedKey: null,
  pickTarget: null,
  menuOpen: false,
  select: (selectedKey) => set({ selectedKey }),
  setPickTarget: (pickTarget) => set({ pickTarget }),
  setMenu: (menuOpen) => set({ menuOpen }),
}));
