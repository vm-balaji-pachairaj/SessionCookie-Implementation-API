import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PubSubService, PubSubMessage } from './pubsub.service';
import { PrismaService } from '../PrismaService/prisma.service';
import { PubSubLogger } from './pubsub.logger';

/**
 * Subscriber Service - handles incoming Pub/Sub messages
 * Processes messages and performs necessary business logic
 */
@Injectable()
export class PubSubSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(PubSubSubscriberService.name);
  private readonly pubsubLogger = new PubSubLogger(PubSubSubscriberService.name);
  private messageQueue: PubSubMessage[] = [];
  private maxQueueSize = 1000;

  constructor(
    private readonly pubsubService: PubSubService,
    private readonly prismaService: PrismaService,
  ) {}

  async onModuleInit() {
    // Register this service as a message handler
    this.pubsubService.registerMessageHandler(
      this.handleMessage.bind(this),
    );
    this.pubsubLogger.logServiceInit({
      maxQueueSize: this.maxQueueSize,
      role: 'SUBSCRIBER',
    });
  }

  /**
   * Handle incoming Pub/Sub messages
   * This is called for every message received from Pub/Sub
   */
  private async handleMessage(message: PubSubMessage): Promise<void> {
    const timer = this.pubsubLogger.createTimer();
    const trackingId = message.trackingId || this.pubsubLogger.generateTrackingId();
    const traceId = message.traceId || this.pubsubLogger.generateTrackingId();
    const eventType = message.data?.eventType || 'UNKNOWN';

    try {
      this.pubsubLogger.logProcessingStarted(message.id || 'unknown', eventType, {
        trackingId,
        traceId,
        userId: message.data?.userId,
        sessionId: message.data?.sessionId,
      });

      // Add to queue for processing
      this.addToQueue(message);

      // Route message based on event type
      switch (eventType) {
        case 'SESSION_CREATED':
          await this.handleSessionCreated(message, trackingId, traceId);
          break;
        case 'SESSION_UPDATED':
          await this.handleSessionUpdated(message, trackingId, traceId);
          break;
        case 'USER_ACTION':
          await this.handleUserAction(message, trackingId, traceId);
          break;
        case 'COOKIE_SYNC':
          await this.handleCookieSync(message, trackingId, traceId);
          break;
        default:
          this.pubsubLogger.logWarning('Unknown Event Type', {
            eventType,
            trackingId,
            traceId,
          });
      }

      const duration = timer.end();
      this.pubsubLogger.logProcessingCompleted(
        message.id || 'unknown',
        eventType,
        duration,
        { trackingId, traceId },
      );
    } catch (error) {
      const duration = timer.end();
      this.pubsubLogger.logError(
        'Message Handler Error',
        error,
        {
          eventType,
          trackingId,
          traceId,
          duration: `${duration}ms`,
        },
      );
      throw error;
    }
  }

  /**
   * Handle SESSION_CREATED event
   */
  private async handleSessionCreated(message: PubSubMessage, trackingId: string, traceId: string): Promise<void> {
    const timer = this.pubsubLogger.createTimer();

    try {
      const sessionData = {
        event_type: 'SESSION_CREATED',
        session_id: message.data.sessionId,
        user_id: message.data.userId,
        metadata: JSON.stringify(message.data.metadata || {}),
        created_at: new Date(message.timestamp || new Date()),
      };

      this.pubsubLogger.logApiResponse('EVENT', 'SESSION_CREATED', 200, timer.end(), {
        trackingId,
        traceId,
        sessionId: message.data.sessionId,
        userId: message.data.userId,
      });

      // Uncomment if you have a session_events table
      // await this.prismaService.session_events.create({
      //   data: sessionData,
      // });
    } catch (error) {
      const duration = timer.end();
      this.pubsubLogger.logError('Session Created Handler Failed', error, {
        trackingId,
        traceId,
        sessionId: message.data.sessionId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Handle SESSION_UPDATED event
   */
  private async handleSessionUpdated(message: PubSubMessage, trackingId: string, traceId: string): Promise<void> {
    const timer = this.pubsubLogger.createTimer();

    try {
      this.pubsubLogger.logApiResponse('EVENT', 'SESSION_UPDATED', 200, timer.end(), {
        trackingId,
        traceId,
        sessionId: message.data.sessionId,
        userId: message.data.userId,
        metadata: message.data.metadata,
      });

      // Example: Update session in database
      // await this.prismaService.sessions.update({ ... });
    } catch (error) {
      const duration = timer.end();
      this.pubsubLogger.logError('Session Updated Handler Failed', error, {
        trackingId,
        traceId,
        sessionId: message.data.sessionId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Handle USER_ACTION event
   */
  private async handleUserAction(message: PubSubMessage, trackingId: string, traceId: string): Promise<void> {
    const timer = this.pubsubLogger.createTimer();

    try {
      this.pubsubLogger.logApiResponse('EVENT', 'USER_ACTION', 200, timer.end(), {
        trackingId,
        traceId,
        userId: message.data.userId,
        action: message.data.metadata?.action,
        timestamp: message.timestamp,
      });

      // Example: Log user action to analytics or database
      // await this.prismaService.user_actions.create({ ... });
    } catch (error) {
      const duration = timer.end();
      this.pubsubLogger.logError('User Action Handler Failed', error, {
        trackingId,
        traceId,
        userId: message.data.userId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Handle COOKIE_SYNC event
   */
  private async handleCookieSync(message: PubSubMessage, trackingId: string, traceId: string): Promise<void> {
    const timer = this.pubsubLogger.createTimer();

    try {
      this.pubsubLogger.logApiResponse('EVENT', 'COOKIE_SYNC', 200, timer.end(), {
        trackingId,
        traceId,
        sessionId: message.data.sessionId,
        cookieCount: message.data.metadata?.cookies?.length || 0,
      });

      // Example: Sync cookies across tabs
      // await this.pubsubService.publishMessage({
      //   eventType: 'COOKIE_SYNCED',
      //   ...
      // });
    } catch (error) {
      const duration = timer.end();
      this.pubsubLogger.logError('Cookie Sync Handler Failed', error, {
        trackingId,
        traceId,
        sessionId: message.data.sessionId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Add message to queue for tracking
   */
  private addToQueue(message: PubSubMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  /**
   * Get recent messages from queue
   */
  getRecentMessages(limit: number = 10): PubSubMessage[] {
    return this.messageQueue.slice(-limit);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalMessages: number;
    maxSize: number;
    utilizationPercent: number;
  } {
    return {
      totalMessages: this.messageQueue.length,
      maxSize: this.maxQueueSize,
      utilizationPercent: (this.messageQueue.length / this.maxQueueSize) * 100,
    };
  }
}
