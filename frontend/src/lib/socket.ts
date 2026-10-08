import { io, type Socket } from 'socket.io-client';
import { socketUrl, tokenStore } from './api';

let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  const token = tokenStore.get();
  if (!token) return null;
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export const getSocket = (): Socket | null => socket;
