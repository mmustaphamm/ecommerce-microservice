import express, { Express } from 'express';
import helmet from 'helmet';
import { ConfirmChannel } from 'amqplib';
import client from 'prom-client';
import { TOPOLOGY } from '@ecommerce/shared';

export function createMonitoringServer(
  channel: ConfirmChannel,
  isReady: () => boolean,
): Express {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  const register = new client.Registry();
  register.setDefaultLabels({ service: 'transaction-worker' });
  client.collectDefaultMetrics({ register });

  const dlqDepthGauge = new client.Gauge({
    name: 'dead_letter_queue_depth',
    help: 'Number of messages currently sitting in the transaction-history dead-letter queue',
    registers: [register],
  });

  app.get('/health', (_req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({
      service: 'transaction-worker',
      status: ready ? 'ok' : 'not_ready',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/metrics', async (_req, res) => {
    try {
      const dlqStatus = await channel.checkQueue(TOPOLOGY.transactionEvents.deadLetterQueue);
      dlqDepthGauge.set(dlqStatus.messageCount);
    } catch {
      // If the check itself fails, we simply don't update the gauge this
      // scrape - better than crashing the metrics endpoint.
    }
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  return app;
}
