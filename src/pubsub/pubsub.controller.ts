import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { PubSubService, PubSubMessage } from './pubsub.service';
import { PubSubSubscriberService } from './pubsub.subscriber.service';
import { Logger } from 'nest-common-utilities';
import { Public } from '../public.decorator';
import { PubSubLogger } from './pubsub.logger';

export class PublishMessageDto {
  eventType!: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

@Controller('api/pubsub')
export class PubSubController {
  private logger = new Logger(PubSubController.name);
  private pubsubLogger = new PubSubLogger(PubSubController.name);

  constructor(
    private readonly pubsubService: PubSubService,
    private readonly subscriberService: PubSubSubscriberService,
  ) {}

  /**
   * Publish a message to Pub/Sub
   * This is the producer endpoint that the UI will call
   */
  @Public()
  @Post('publish')
  async publishMessage(@Body() body: PublishMessageDto): Promise<{
    success: boolean;
    messageId: string;
    traceId: string;
    timestamp: Date;
  }> {
    const timer = this.pubsubLogger.createTimer();
    const trackingId = this.pubsubLogger.generateTrackingId();
    const traceId = body.traceId || this.pubsubLogger.generateTrackingId();

    try {
      if (!body.eventType) {
        this.pubsubLogger.logWarning('Publish Request Validation Failed', {
          reason: 'Missing eventType',
          trackingId,
          traceId,
        });
        throw new BadRequestException('eventType is required');
      }

      this.pubsubLogger.logApiRequest('POST', '/api/pubsub/publish', {
        eventType: body.eventType,
        userId: body.userId,
        sessionId: body.sessionId,
        trackingId,
        traceId,
      });

      const messageId = await this.pubsubService.publishMessage({
        eventType: body.eventType,
        userId: body.userId,
        sessionId: body.sessionId,
        traceId,
        metadata: body.metadata,
        publishedAt: new Date().toISOString(),
      });

      const duration = timer.end();

      this.pubsubLogger.logApiResponse(
        'POST',
        '/api/pubsub/publish',
        200,
        duration,
        {
          messageId,
          eventType: body.eventType,
          trackingId,
          traceId,
        },
      );

      return {
        success: true,
        messageId,
        traceId,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = timer.end();
      const statusCode = error instanceof BadRequestException ? 400 : 500;

      this.pubsubLogger.logError(
        'Publish Request Failed',
        error,
        {
          trackingId,
          traceId,
          duration: `${duration}ms`,
          statusCode,
        },
      );

      throw error;
    }
  }

  /**
   * Get Pub/Sub subscription details
   * Useful for monitoring and debugging
   */
  @Public()
  @Get('status')
  getStatus(): {
    connected: boolean;
    details: Record<string, any>;
  } {
    const isConnected = this.pubsubService.getConnectionStatus();
    const details = this.pubsubService.getSubscriptionDetails();

    this.pubsubLogger.logApiResponse('GET', '/api/pubsub/status', 200, 0, {
      isConnected,
      topicName: details.topicName,
    });

    return {
      connected: isConnected,
      details,
    };
  }

  /**
   * Get subscriber queue statistics
   * Shows recent messages and queue utilization
   */
  @Public()
  @Get('subscriber/stats')
  getSubscriberStats(): {
    queueStats: Record<string, any>;
    recentMessages: PubSubMessage[];
  } {
    const queueStats = this.subscriberService.getQueueStats();
    const recentMessages = this.subscriberService.getRecentMessages(10);

    this.pubsubLogger.logQueueStats(queueStats);

    return {
      queueStats,
      recentMessages,
    };
  }

  /**
   * Health check endpoint
   * Returns the overall health of Pub/Sub system
   */
  @Get('health')
  getHealth(): {
    status: string;
    pubsub: {
      connected: boolean;
      topicName: string;
      subscriptionName: string;
      stats: Record<string, any>;
    };
    subscriber: {
      active: boolean;
      queueSize: number;
      maxQueueSize: number;
    };
    timestamp: Date;
  } {
    const pubsubConnected = this.pubsubService.getConnectionStatus();
    const pubsubDetails = this.pubsubService.getSubscriptionDetails();
    const subscriberStats = this.subscriberService.getQueueStats();

    const status = pubsubConnected ? 'HEALTHY' : 'DEGRADED';
    this.pubsubLogger.logHealthCheck(
      pubsubConnected ? 'HEALTHY' : 'DEGRADED',
      {
        pubsubConnected,
        subscriberActive: pubsubConnected,
        queueSize: subscriberStats.totalMessages,
      },
    );

    return {
      status,
      pubsub: {
        connected: pubsubConnected,
        topicName: pubsubDetails.topicName,
        subscriptionName: pubsubDetails.subscriptionName,
        stats: pubsubDetails.stats,
      },
      subscriber: {
        active: pubsubConnected,
        queueSize: subscriberStats.totalMessages,
        maxQueueSize: subscriberStats.maxSize,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Pull messages from the Pub/Sub subscription
   * Returns list of available messages waiting to be processed
   */
  @Public()
  @Get('messages')
  async getMessages(): Promise<{
    success: boolean;
    messages: any[];
    count: number;
  }> {
    try {
      this.logger.info('Fetching messages from Pub/Sub');
      const messages = await this.pubsubService.pullMessages(10);

      return {
        success: true,
        messages,
        count: messages.length,
      };
    } catch (error) {
      this.logger.error('Failed to pull messages', error);
      throw new BadRequestException('Failed to pull messages from Pub/Sub');
    }
  }

  /**
   * Acknowledge a message
   * Sends ACK to GCP to mark the message as processed
   */
  @Public()
  @Post('ack')
  async acknowledgeMessage(@Body() body: { messageId: string; ackId?: string }): Promise<{
    success: boolean;
    messageId: string;
    action: string;
  }> {
    try {
      if (!body.messageId) {
        throw new BadRequestException('messageId is required');
      }

      this.logger.info('Acknowledging message', {
        methodName: 'acknowledgeMessage',
        messageId: body.messageId,
      });

      await this.pubsubService.acknowledgeMessage(body.messageId);

      return {
        success: true,
        messageId: body.messageId,
        action: 'acknowledged',
      };
    } catch (error) {
      this.logger.error('Failed to acknowledge message', error);
      throw new BadRequestException('Failed to acknowledge message');
    }
  }

  /**
   * Nack a message (negative acknowledge)
   * Sends NACK to GCP to requeue the message for reprocessing
   */
  @Public()
  @Post('nack')
  async nackMessage(@Body() body: { messageId: string; ackId?: string }): Promise<{
    success: boolean;
    messageId: string;
    action: string;
  }> {
    try {
      if (!body.messageId) {
        throw new BadRequestException('messageId is required');
      }

      this.logger.info('Nacking message', {
        methodName: 'nackMessage',
        messageId: body.messageId,
      });

      await this.pubsubService.nackMessage(body.messageId);

      return {
        success: true,
        messageId: body.messageId,
        action: 'nacked',
      };
    } catch (error) {
      this.logger.error('Failed to nack message', error);
      throw new BadRequestException('Failed to nack message');
    }
  }
}
