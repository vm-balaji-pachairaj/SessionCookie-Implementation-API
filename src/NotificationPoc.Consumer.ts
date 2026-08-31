import { Injectable, OnModuleInit } from '@nestjs/common';
import { PubSub, Message } from '@google-cloud/pubsub';
import { Logger } from 'nest-common-utilities';
import {
  context,
  propagation,
  trace,
  SpanStatusCode,
} from '@opentelemetry/api';

type PubSubPayload = Record<string, unknown>;

@Injectable()
export class NotificationPocConsumer implements OnModuleInit {
  private readonly logger = new Logger(
    NotificationPocConsumer.name,
  );

  private readonly serviceInfo = {
    serviceName:
      process.env.SERVICE_NAME || 'session-cookie-api',
    serviceVersion:
      process.env.SERVICE_VERSION || '1.0.0',
    environment:
      process.env.NODE_ENV || 'development',
  };

  private latestMessage: PubSubPayload | null = null;

  private readonly pubSub = new PubSub({
    projectId: 'pubsup-506809',
  });

  async onModuleInit() {
    const subscription = this.pubSub.subscription(
      'notification-poc-sub',
    );

    subscription.on(
      'message',
      async (message: Message) => {
        const tracer = trace.getTracer(
          'notification-poc-consumer',
        );

        /**
         * Extract trace context that the publisher
         * injected into the Pub/Sub message.
         */
        const parentContext = propagation.extract(
          context.active(),
          message.attributes,
        );

        /**
         * Make the extracted context active.
         */
        await context.with(
          parentContext,
          async () => {
            /**
             * Create an active consumer span.
             *
             * This span will be connected to the
             * publisher's trace.
             */
            await tracer.startActiveSpan(
              'notification.process',
              async (span) => {
                try {
                  /**
                   * Parse Pub/Sub message.
                   */
                  let payload: PubSubPayload;

                  try {
                    payload = JSON.parse(
                      message.data.toString(),
                    ) as PubSubPayload;
                  } catch {
                    payload = {
                      rawData: message.data.toString(),
                    };
                  }

                  this.latestMessage = payload;

                  /**
                   * Pub/Sub delivery attempt.
                   *
                   * This is available when delivery-attempt
                   * tracking is configured on the subscription.
                   */
                  const deliveryAttempt =
                    message.deliveryAttempt;

                  /**
                   * Add useful messaging information
                   * to the trace.
                   */
                  span.setAttribute(
                    'messaging.system',
                    'gcp_pubsub',
                  );

                  span.setAttribute(
                    'messaging.message.id',
                    message.id,
                  );

                  span.setAttribute(
                    'messaging.destination.name',
                    'notification-poc-topic',
                  );

                  if (
                    deliveryAttempt !== undefined
                  ) {
                    span.setAttribute(
                      'messaging.delivery_attempt',
                      deliveryAttempt,
                    );
                  }

                  /**
                   * Application log.
                   *
                   * Your common Logger should automatically
                   * add traceId/spanId from the active OTel context.
                   */
                  this.logger.info(
                    'Pub/Sub message received',
                    {
                      methodName: 'onMessage',
                      api: 'pubsub:notification-poc-sub',
                      messageId: message.id,
                      deliveryAttempt,
                      eventType: payload.event,
                      serviceInfo: this.serviceInfo,
                    },
                  );

                  /**
                   * ==================================================
                   * YOUR ACTUAL BUSINESS PROCESSING
                   * ==================================================
                   *
                   * Example:
                   *
                   * await this.processNotification(payload);
                   *
                   * For now we can simulate processing.
                   */

                  await this.processMessage(payload,message.deliveryAttempt);

                  /**
                   * IMPORTANT:
                   *
                   * ACK ONLY AFTER successful processing.
                   */
                  message.ack();

                  span.setStatus({
                    code: SpanStatusCode.OK,
                  });

                  this.logger.info(
                    'Pub/Sub message processed successfully',
                    {
                      methodName: 'onMessage',
                      api: 'pubsub:notification-poc-sub',
                      messageId: message.id,
                      deliveryAttempt,
                      serviceInfo: this.serviceInfo,
                    },
                  );
                } catch (error) {
                  /**
                   * Record error in OpenTelemetry span.
                   */
                  span.recordException(
                    error as Error,
                  );

                  span.setStatus({
                    code: SpanStatusCode.ERROR,
                  });

                  /**
                   * Log processing failure.
                   */
                  this.logger.error(
                    'Pub/Sub message processing failed',
                    {
                      methodName: 'onMessage',
                      api: 'pubsub:notification-poc-sub',
                      messageId: message.id,
                      deliveryAttempt:
                        message.deliveryAttempt,
                      serviceInfo: this.serviceInfo,
                      error:
                        error instanceof Error
                          ? error.message
                          : error,
                    },
                  );

                  /**
                   * IMPORTANT:
                   *
                   * NACK tells Pub/Sub that processing failed.
                   *
                   * Pub/Sub will handle redelivery according
                   * to the subscription retry policy.
                   */
                  message.nack();
                } finally {
                  /**
                   * Always end the span.
                   */
                  span.end();
                }
              },
            );
          },
        );
      },
    );

    /**
     * Subscription-level errors.
     */
    subscription.on('error', (error) => {
      this.logger.error(
        'Pub/Sub subscription error',
        {
          methodName: 'onModuleInit',
          api: 'pubsub:notification-poc-sub',
          serviceInfo: this.serviceInfo,
          error:
            error instanceof Error
              ? error.message
              : error,
        },
      );
    });

    this.logger.info(
      'Listening to notification-poc-sub...',
      {
        methodName: 'onModuleInit',
        api: 'pubsub:notification-poc-sub',
        serviceInfo: this.serviceInfo,
      },
    );
  }

  /**
   * Temporary business processing method for POC.
   *
   * Replace this with your actual business logic.
   */
private async processMessage(
  payload: PubSubPayload,
  deliveryAttempt?: number,
): Promise<void> {

  this.logger.info(
    'Processing notification',
    {
      methodName: 'processMessage',
      eventType: payload.event,
      deliveryAttempt,
      serviceInfo: this.serviceInfo,
    },
  );

  console.log("Delivery attempt:", deliveryAttempt);

  // POC: Fail first 2 attempts
  if (
    deliveryAttempt !== undefined &&
    deliveryAttempt < 3
  ) {
    throw new Error(
      `Intentional POC failure - attempt ${deliveryAttempt}`,
    );
  }

  // Attempt 3 succeeds
  this.logger.info(
    'Notification processing completed',
    {
      methodName: 'processMessage',
      eventType: payload.event,
      deliveryAttempt,
      serviceInfo: this.serviceInfo,
    },
  );
}

  setLatestMessage(
    payload: PubSubPayload,
  ) {
    this.latestMessage = payload;
  }

  getLatestMessage():
    | PubSubPayload
    | null {
    return this.latestMessage;
  }
}