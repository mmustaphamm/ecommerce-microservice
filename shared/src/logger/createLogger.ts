import pino, { Logger } from 'pino';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
}

/**
 * Creates a pino logger tagged with the owning service's name, so logs from
 * every service can be aggregated and filtered consistently (e.g. in
 * `docker-compose logs` or a real log aggregator later).
 */
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
