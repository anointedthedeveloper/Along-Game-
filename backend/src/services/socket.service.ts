import type { Server } from 'socket.io';

/** Holds the Socket.IO server so services can emit without importing the HTTP layer. */
let io: Server | null = null;

export const setIo = (server: Server): void => {
  io = server;
};

export const userRoom = (userId: string): string => `user:${userId}`;

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function broadcast(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
