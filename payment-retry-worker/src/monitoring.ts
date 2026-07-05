import express, { Express } from 'express';
import helmet from 'helmet';
import { ConfirmChannel } from 'amqplib';
import client from 'prom-client';
import { TOPOLOGY } from '@ecommerce/shared/src';

export function createMonitoringServer(channel: ConfirmChannel, isReady: () => boolean): Express {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  const register = new client.Registry();
  register.setDefaultLabels({ service: 'payment-retry-worker' });
  client.collectDefaultMetrics({ register });

  const dlqDepthGauge = new client.Gauge({
    name: 'dead_letter_queue_depth',
    help: 'Number of messages currently sitting in the payment-retry dead-letter queue (permanently failed payments needing manual reconciliation)',
    registers: [register],
  });

  app.get('/health', (_req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({
      service: 'payment-retry-worker',
      status: ready ? 'ok' : 'not_ready',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/metrics', async (_req, res) => {
    try {
      const dlqStatus = await channel.checkQueue(TOPOLOGY.paymentRetry.deadLetterQueue);
      dlqDepthGauge.set(dlqStatus.messageCount);
    } catch {
      // Don't fail the whole scrape if the queue check itself has a hiccup.
    }
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  return app;
}
