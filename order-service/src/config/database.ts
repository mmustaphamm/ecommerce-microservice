import mongoose from 'mongoose';
import type { Logger } from 'pino';
import { env } from './env';

let isConnected = false;

export async function connectDatabase(logger: Logger): Promise<void> {
  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    isConnected = false;
    logger.error({ err }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(env.MONGO_URI);
}

export function isDatabaseConnected(): boolean {
  return isConnected || mongoose.connection.readyState === 1;
}
