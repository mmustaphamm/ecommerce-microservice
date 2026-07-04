import type { Logger } from 'pino';
import {
  UpstreamServiceError,
  Publisher,
  TOPOLOGY,
  PaymentRetryRequestedEvent,
} from '@ecommerce/shared';
import { IPaymentClient } from './clients/IPaymentClient';
import { IOrderClient } from './clients/IOrderClient';

/**
 * This is the fix for "Payment retry queue exists, but no retry worker
 * consumes it" - the single biggest gap flagged in review. Order Service
 * publishes here when Payment Service is down; this worker is what
 * actually closes the loop.
 *
 * On each attempt:
 *  - SUCCESS -> tell Order Service the order is `confirmed`. Done.
 *  - FAILURE, attempts remain -> republish to the delay queue with
 *    attempts+1. RabbitMQ holds it there for a fixed TTL, then
 *    automatically dead-letters it back into the main retry queue - this
 *    is the "TTL + DLX bounce" pattern for delayed retries, since core
 *    RabbitMQ has no native delay/schedule feature without a plugin.
 *  - FAILURE, attempts exhausted -> tell Order Service the order is
 *    permanently `failed`, then re-throw so the Consumer nacks the message
 *    to the terminal DLQ as a durable record for a human/alerting system.
 *
 * A genuinely unexpected error (not an UpstreamServiceError - e.g. a bug)
 * is re-thrown immediately without consuming an attempt or touching order
 * state, since we can't safely reason about what happened.
 */
export class PaymentRetryProcessor {
  constructor(
    private readonly paymentClient: IPaymentClient,
    private readonly orderClient: IOrderClient,
    private readonly publisher: Publisher,
    private readonly logger: Logger,
  ) {}

  async handle(event: PaymentRetryRequestedEvent): Promise<void> {
    try {
      await this.paymentClient.initiatePayment({
        customerId: event.customerId,
        orderId: event.orderId,
        productId: event.productId,
        amount: event.amount,
      });

      await this.orderClient.updatePaymentStatus(event.orderId, {
        paymentInitiated: true,
        orderStatus: 'confirmed',
      });

      this.logger.info({ orderId: event.orderId, attempts: event.attempts }, 'Payment retry succeeded');
    } catch (err) {
      if (!(err instanceof UpstreamServiceError)) {
        // Unexpected error shape (e.g. a bug in our own code) - don't
        // consume a retry attempt or touch order state for something we
        // can't reason about safely. Let it dead-letter for investigation.
        throw err;
      }

      const attemptsRemaining = event.attempts < TOPOLOGY.paymentRetry.maxAttempts;

      if (attemptsRemaining) {
        const nextEvent: PaymentRetryRequestedEvent = { ...event, attempts: event.attempts + 1 };

        this.logger.warn(
          { orderId: event.orderId, attempt: event.attempts, err },
          'Payment retry attempt failed - scheduling another attempt after delay',
        );

        // Hand off to the delay queue and return normally: the caller
        // (Consumer) will ack this original message, since a follow-up
        // attempt has already been durably queued.
        await this.publisher.sendToQueue(TOPOLOGY.paymentRetry.delayQueue, nextEvent);
        return;
      }

      this.logger.error(
        { orderId: event.orderId, attempts: event.attempts, err },
        'Payment retry attempts exhausted - marking order as permanently failed',
      );

      try {
        await this.orderClient.updatePaymentStatus(event.orderId, {
          paymentInitiated: false,
          orderStatus: 'failed',
        });
      } catch (updateErr) {
        this.logger.error(
          { updateErr, orderId: event.orderId },
          'Failed to mark order as failed after exhausting retries - order will be stuck as pending until manually reconciled',
        );
      }

      // Re-throw so the Consumer nacks this message to the terminal DLQ -
      // a durable, inspectable record that this order's payment ultimately
      // failed, for alerting/manual follow-up.
      throw err;
    }
  }
}
