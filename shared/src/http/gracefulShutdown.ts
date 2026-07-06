import type { Server } from 'http';
import type { Logger } from 'pino';

export interface ShutdownDependencies {
  httpServer?: Server;
  onShutdown?: () => Promise<void>;
  logger: Logger;
  timeoutMs?: number;
}

export function registerGracefulShutdown(deps: ShutdownDependencies): void {
  const { httpServer, onShutdown, logger, timeoutMs = 10_000 } = deps;
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out - forcing exit');
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    try {
      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        });
        logger.info('HTTP server closed - no longer accepting new connections');
      }

      if (onShutdown) {
        await onShutdown();
      }

      logger.info('Graceful shutdown complete');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
