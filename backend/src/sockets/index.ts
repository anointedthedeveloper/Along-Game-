import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { Ride, User } from '../models';
import { userFromToken } from '../middleware/auth';
import { topUpOffers } from '../services/offer.service';
import { emitToUser, setIo, userRoom } from '../services/socket.service';
import { getWorld } from '../services/world.service';

const OFFER_PUMP_MS = 5000;
const WORLD_TICK_MS = 10_000;

/**
 * Real-time layer. Authoritative state still lives behind the REST API; sockets
 * only push changes (offers, ride status, wallet, world ticks) so clients stay in sync.
 */
export function attachSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrls, credentials: true },
  });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('unauthorized'));
      const user = await userFromToken(token);
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));
    socket.emit('world:tick', getWorld());

    // Drivers stream their position; it is relayed to the passenger of that ride when one is a real player.
    socket.on('driver:position', async (msg: { rideId?: string; progress?: number }) => {
      if (typeof msg?.rideId !== 'string' || typeof msg.progress !== 'number') return;
      const ride = await Ride.findOne({ _id: msg.rideId, driver: userId, status: { $in: ['DRIVER_ARRIVING', 'IN_PROGRESS'] } }).select('passenger');
      if (ride?.passenger) emitToUser(String(ride.passenger), 'driver:position', { rideId: msg.rideId, progress: Math.min(1, Math.max(0, msg.progress)) });
    });
  });

  // Push new ride offers to on-duty drivers who are connected.
  setInterval(async () => {
    const sockets = await io.fetchSockets();
    const seen = new Set<string>();
    for (const s of sockets) {
      const uid = s.data.userId as string | undefined;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      try {
        const user = await User.findById(uid);
        if (user?.mode === 'DRIVER') await topUpOffers(user);
      } catch (err) {
        console.error('[socket] offer pump failed', err);
      }
    }
  }, OFFER_PUMP_MS).unref();

  setInterval(() => io.emit('world:tick', getWorld()), WORLD_TICK_MS).unref();
  return io;
}
