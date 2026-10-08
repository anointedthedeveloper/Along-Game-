import mongoose from 'mongoose';
import { env } from './env';

let memoryServer: { stop: () => Promise<unknown> } | null = null;

export async function connectDb(): Promise<void> {
  let uri = env.mongoUri;
  if (env.useMemoryDb) {
    // Dev-only helper. The package is a devDependency and is never loaded in production.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri('along');
    console.log('[db] using in-memory MongoDB (data is NOT persisted)');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log('[db] connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
