import { create } from 'zustand';
import { ApiError, setUnauthorizedHandler, tokenStore } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { authApi } from '@/services';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** 'booting' until we have checked for a stored session. */
  status: 'booting' | 'anonymous' | 'authenticated';
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (b: { name: string; email: string; password: string; mode: 'DRIVER' | 'PASSENGER' }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'booting',
  init: async () => {
    if (!tokenStore.get()) return set({ status: 'anonymous' });
    try {
      const { user } = await authApi.session();
      set({ user, status: 'authenticated' });
    } catch (err) {
      // Only an explicit rejection ends the session; a flaky network should not log players out.
      if (err instanceof ApiError && err.status === 401) tokenStore.set(null);
      set({ user: null, status: err instanceof ApiError && err.status === 0 ? 'anonymous' : 'anonymous' });
    }
  },
  login: async (email, password) => {
    const { token, user } = await authApi.login({ email, password });
    tokenStore.set(token);
    set({ user, status: 'authenticated' });
  },
  register: async (b) => {
    const { token, user } = await authApi.register(b);
    tokenStore.set(token);
    set({ user, status: 'authenticated' });
  },
  logout: async () => {
    try {
      if (get().user) await authApi.logout();
    } catch {
      /* already signed out server-side */
    }
    tokenStore.set(null);
    disconnectSocket();
    set({ user: null, status: 'anonymous' });
  },
  setUser: (user) => set({ user }),
}));

setUnauthorizedHandler(() => {
  tokenStore.set(null);
  disconnectSocket();
  useAuth.setState({ user: null, status: 'anonymous' });
});
