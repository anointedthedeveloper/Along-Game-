import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useGame } from '@/store/game';
import { toast } from '@/store/toast';
import type { Ride, World } from '@/types';

/** Subscribes the game store to server pushes while the player is in the city. */
export function useRealtime(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();
    if (!socket) return;
    const g = useGame.getState;
    const onWorld = (w: World) => g().setWorld(w);
    const onOffer = (r: Ride) => g().addOffer(r);
    const onRide = (r: Ride) => {
      const current = g().ride;
      if (current && current.id === r.id) g().setRide({ ...current, ...r, events: current.events });
    };
    const onWallet = (b: { cash: number; bank: number }) => g().setBalances(b.cash, b.bank);
    const onNote = (n: { title: string; body: string }) => toast.info(n.body ? `${n.title} — ${n.body}` : n.title);
    socket.on('world:tick', onWorld);
    socket.on('ride:offer', onOffer);
    socket.on('ride:update', onRide);
    socket.on('wallet:update', onWallet);
    socket.on('notification', onNote);
    return () => {
      socket.off('world:tick', onWorld);
      socket.off('ride:offer', onOffer);
      socket.off('ride:update', onRide);
      socket.off('wallet:update', onWallet);
      socket.off('notification', onNote);
      disconnectSocket();
    };
  }, [enabled]);
}
