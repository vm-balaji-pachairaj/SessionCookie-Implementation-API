import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PubSub, Topic, Subscription } from '@google-cloud/pubsub';
import { PubSubLogger } from './pubsub.logger';

export interface PubSubMessage {
  data: Record<string, any>;
  timestamp?: Date;
  id?: string;
  trackingId?: string;
  traceId?: string;
}

@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private pubsub: PubSub;
  private topic: Topic;
  private subscription: Subscription;
  private readonly logger = new Logger(PubSubService.name);
  private readonly pubsubLogger = new PubSubLogger(PubSubService.name);
  private readonly topicName =
    process.env.PUBSUB_TOPIC_NAME || 'session-cookie-topic';
  private readonly subscriptionName =
    process.env.PUBSUB_SUBSCRIPTION_NAME || 'session-cookie-subscription';
  private messageHandlers: ((message: PubSubMessage) => Promise<void>)[] = [];
  private isConnected = false;
  private receivedMessages: Map<string, any> = new Map();
  private messageStats = {
    published: 0,
    received: 0,
    processed: 0,
    failed: 0,
  };

  async onModuleInit() {
    this.pubsubLogger.logServiceInit({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? '***configured***' : 'NOT_SET',
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ? '***configured***' : 'NOT_SET',
    });

    try {
      this.pubsub = new PubSub({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });

      // Ensure topic exists
      this.topic = this.pubsub.topic(this.topicName);
      const [topicExists] = await this.topic.exists();

      if (!topicExists) {
        this.pubsubLogger.logResourceCreated('TOPIC', this.topicName);
        const [newTopic] = await this.pubsub.createTopic(this.topicName);
        this.topic = newTopic;
      } else {
        this.pubsubLogger.logResourceExists('TOPIC', this.topicName);
      }

      // Ensure subscription exists
      this.subscription = this.topic.subscription(this.subscriptionName);
      const [subscriptionExists] = await this.subscription.exists();

      if (!subscriptionExists) {
        this.pubsubLogger.logResourceCreated('SUBSCRIPTION', this.subscriptionName);
        await this.topic.createSubscription(this.subscriptionName);
      } else {
        this.pubsubLogger.logResourceExists('SUBSCRIPTION', this.subscriptionName);
      }

      this.isConnected = true;
      this.pubsubLogger.logConnected(this.topicName, this.subscriptionName);

      // Start listening to messages
      this.startListening();
    } catch (error) {
      this.pubsubLogger.logError(
        'Failed to initialize PubSub Service',
        error,
        { topicName: this.topicName, subscriptionName: this.subscriptionName },
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.subscription) {
      this.subscription.removeAllListeners();
      this.pubsubLogger.logListenerStopped();
    }
  }

  /**
   * Publish a message to the Pub/Sub topic
   * @param data The message data to publish
   * @returns The message ID
   */
  async publishMessage(data: Record<string, any>): Promise<string> {
    if (!this.isConnected) {
      this.pubsubLogger.logError('Publish Failed - Not Connected', new Error('PubSub service is not connected'));
      throw new Error('PubSub service is not connected');
    }

    const timer = this.pubsubLogger.createTimer();
    const trackingId = this.pubsubLogger.generateTrackingId();
    const traceId = data.traceId || this.pubsubLogger.generateTrackingId();
    const eventType = data.eventType || 'UNKNOWN';

    try {
      const messageId = await this.topic.publish(
        Buffer.from(
          JSON.stringify({
            data,
            timestamp: new Date().toISOString(),
            trackingId,
            traceId,
          }),
        ),
      );

      const duration = timer.end();
      this.messageStats.published++;

      this.pubsubLogger.logMessagePublished(
        messageId,
        eventType,
        JSON.stringify(data).length,
        {
          trackingId,
          traceId,
          userId: data.userId,
          sessionId: data.sessionId,
          duration: `${duration}ms`,
        },
      );

      return messageId;
    } catch (error) {
      const duration = timer.end();
      this.messageStats.failed++;
      
      this.pubsubLogger.logError(
        'Publish Failed',
        error,
        {
          eventType,
          trackingId,
          traceId,
          duration: `${duration}ms`,
          userId: data.userId,
        },
      );
      throw error;
    }
  }

  /**
   * Register a message handler to be called when messages are received
   * @param handler Async function to handle messages
   */
  registerMessageHandler(
    handler: (message: PubSubMessage) => Promise<void>,
  ): void {
    this.messageHandlers.push(handler);
    this.pubsubLogger.logHandlerRegistered(this.messageHandlers.length);
  }

  /**
   * Start listening to messages from the subscription
   */
  private startListening(): void {
    if (!this.subscription) return;

    this.pubsubLogger.logListenerStarted(this.topicName, this.subscriptionName);

    this.subscription.on('message', async (message) => {
      const timer = this.pubsubLogger.createTimer();
      let pubsubMessage: PubSubMessage;
      let trackingId = this.pubsubLogger.generateTrackingId();
      let traceId = this.pubsubLogger.generateTrackingId();

      try {
        pubsubMessage = JSON.parse(
          message.data.toString(),
        ) as PubSubMessage;
        trackingId = pubsubMessage.trackingId || trackingId;
        traceId = pubsubMessage.traceId || traceId;

        this.messageStats.received++;
        const eventType = pubsubMessage.data?.eventType || 'UNKNOWN';

        this.pubsubLogger.logMessageReceived(
          message.id,
          eventType,
          {
            trackingId,
            traceId,
            userId: pubsubMessage.data?.userId,
            sessionId: pubsubMessage.data?.sessionId,
            receivedAt: new Date().toISOString(),
          },
        );

        // Store message with ackId for later acknowledgement
        this.receivedMessages.set(message.id, {
          id: message.id,
          ackId: message.ackId,
          message: message,
          data: pubsubMessage.data,
          timestamp: pubsubMessage.timestamp,
          trackingId,
          traceId,
        });

        // Call all registered handlers
        for (const handler of this.messageHandlers) {
          try {
            this.pubsubLogger.logProcessingStarted(
              message.id,
              eventType,
              { trackingId, traceId },
            );

            await handler(pubsubMessage);

            const duration = timer.end();
            this.messageStats.processed++;

            this.pubsubLogger.logProcessingCompleted(
              message.id,
              eventType,
              duration,
              { trackingId, traceId, userId: pubsubMessage.data?.userId },
            );
          } catch (handlerError) {
            this.messageStats.failed++;
            const duration = timer.end();

            this.pubsubLogger.logError(
              'Handler Processing Failed',
              handlerError,
              {
                messageId: message.id,
                eventType,
                trackingId,
                traceId,
                duration: `${duration}ms`,
              },
            );
          }
        }

        // Acknowledge the message
        this.pubsubLogger.logMessageAcknowledged(message.id, eventType);
        message.ack();
      } catch (error) {
        this.messageStats.failed++;
        const duration = timer.end();

        this.pubsubLogger.logError(
          'Message Processing Failed',
          error,
          {
            messageId: message.id,
            trackingId,
            traceId,
            duration: `${duration}ms`,
          },
        );
        message.nack();
      }
    });

    this.subscription.on('error', (error) => {
      this.pubsubLogger.logError('Subscription Error', error);
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get subscription details
   */
  getSubscriptionDetails() {
    return {
      topicName: this.topicName,
      subscriptionName: this.subscriptionName,
      isConnected: this.isConnected,
      messageHandlersCount: this.messageHandlers.length,
      stats: this.messageStats,
    };
  }

  /**
   * Pull messages from the subscription
   * Returns messages that have been received by the subscriber
   */
  async pullMessages(maxMessages: number = 10): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('PubSub service is not connected');
    }

    try {
      // Get messages from the receivedMessages map (populated by startListening)
      const messageEntries = Array.from(this.receivedMessages.entries()).slice(
        0,
        maxMessages,
      );

      this.logger.log(`Retrieved ${messageEntries.length} messages from buffer`);

      // Convert to array format for the frontend
      const formattedMessages = messageEntries.map(([, msg]) => {
        return {
          id: msg.id,
          ackId: msg.ackId,
          data: msg.data,
          timestamp: msg.timestamp,
        };
      });

      return formattedMessages;
    } catch (error) {
      this.logger.error('Failed to pull messages', error);
      throw error;
    }
  }

  /**
   * Acknowledge a message by its ID
   */
  async acknowledgeMessage(messageId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PubSub service is not connected');
    }

    try {
      const storedMessage = this.receivedMessages.get(messageId);
      if (!storedMessage) {
        throw new Error(`Message ${messageId} not found in cache`);
      }

      // Acknowledge the message
      await storedMessage.message.ack();

      // Remove from cache
      this.receivedMessages.delete(messageId);

      this.logger.log(`Message acknowledged: ${messageId}`);
    } catch (error) {
      this.logger.error('Failed to acknowledge message', error);
      throw error;
    }
  }

  /**
   * Nack (negative acknowledge) a message by its ID
   */
  async nackMessage(messageId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PubSub service is not connected');
    }

    try {
      const storedMessage = this.receivedMessages.get(messageId);
      if (!storedMessage) {
        throw new Error(`Message ${messageId} not found in cache`);
      }

      // Nack the message (requeue it)
      await storedMessage.message.nack();

      // Remove from cache
      this.receivedMessages.delete(messageId);

      this.logger.log(`Message nacked: ${messageId}`);
    } catch (error) {
      this.logger.error('Failed to nack message', error);
      throw error;
    }
  }
}
