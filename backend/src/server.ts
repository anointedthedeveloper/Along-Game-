import http from 'http';
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { seedLocations } from './services/location.service';
import { attachSockets } from './sockets';

async function main() {
  await connectDb();
  await seedLocations();
  const app = createApp();
  const server = http.createServer(app);
  attachSockets(server);
  server.listen(env.port, () => {
    console.log(`[along] API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[along] allowing origins: ${env.clientUrls.join(', ')}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[along] ${signal} received, shutting down`);
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[along] failed to start', err);
  process.exit(1);
});
