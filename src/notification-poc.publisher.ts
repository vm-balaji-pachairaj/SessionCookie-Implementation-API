import { Injectable } from '@nestjs/common';
import { Logger } from 'nest-common-utilities';
import { PubSub } from '@google-cloud/pubsub';
import {
  context,
  propagation,
  trace,
} from '@opentelemetry/api';

@Injectable()
export class NotificationPocPublisher {
  private readonly logger = new Logger(NotificationPocPublisher.name);
  private readonly serviceInfo = {
    serviceName: process.env.SERVICE_NAME || 'session-cookie-api',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };

  private readonly pubSub = new PubSub({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });

  async publishTestMessage() {
  const topic = this.pubSub.topic(
    'notification-poc-topic',
  );

  const message = {
    event: 'NOTIFICATION_TEST',
    message: 'Hello from NestJS',
    timestamp: new Date().toISOString(),
  };

  const attributes: Record<string, string> = {};

  propagation.inject(
    context.active(),
    attributes,
  );

  const messageId = await topic.publishMessage({
    data: Buffer.from(JSON.stringify(message)),
    attributes,
  });

  this.logger.info(
    'Pub/Sub message published',
    {
      methodName: 'publishTestMessage',
      api: 'pubsub:notification-poc-topic',
      messageId,
      payload: message,
      serviceInfo: this.serviceInfo,
    },
  );

  return {
    messageId,
    payload: message,
    serviceInfo: this.serviceInfo,
  };
}
}