import pino, { Logger } from 'pino';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
}

export function createLogger({ serviceName, level }: LoggerOptions): Logger {
  const isProduction = process.env.NODE_ENV === 'production';
  const resolvedLevel = level ?? process.env.LOG_LEVEL ?? 'info';
  const usePrettyTransport = !isProduction && resolvedLevel !== 'silent';

  return pino({
    name: serviceName,
    level: resolvedLevel,
    transport: usePrettyTransport
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
    base: { service: serviceName },
  });
}
