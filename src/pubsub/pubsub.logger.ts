import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Pub/Sub Logging Utility
 * Provides structured, consistent, and clear logging for all Pub/Sub operations
 */
export class PubSubLogger {
  private readonly logger: Logger;
  private readonly serviceName: string;
  private readonly logPrefix = '[PubSub]';

  constructor(serviceName: string) {
    this.logger = new Logger(serviceName);
    this.serviceName = serviceName;
  }

  /**
   * Log service initialization
   */
  logServiceInit(details: Record<string, any>): void {
    const message = `${this.logPrefix} Service Initialization`;
    this.logger.log(message, {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  /**
   * Log successful connection/setup
   */
  logConnected(topicName: string, subscriptionName: string, additionalData?: Record<string, any>): void {
    const message = `${this.logPrefix} ✓ Successfully Connected`;
    this.logger.log(message, {
      service: this.serviceName,
      topicName,
      subscriptionName,
      status: 'CONNECTED',
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log resource creation (topic/subscription)
   */
  logResourceCreated(resourceType: 'TOPIC' | 'SUBSCRIPTION', resourceName: string, additionalData?: Record<string, any>): void {
    const message = `${this.logPrefix} ✓ ${resourceType} Created`;
    this.logger.log(message, {
      service: this.serviceName,
      resourceType,
      resourceName,
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log resource exists
   */
  logResourceExists(resourceType: 'TOPIC' | 'SUBSCRIPTION', resourceName: string): void {
    const message = `${this.logPrefix} ℹ ${resourceType} Already Exists`;
    this.logger.log(message, {
      service: this.serviceName,
      resourceType,
      resourceName,
      status: 'EXISTS',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log message published
   */
  logMessagePublished(
    messageId: string,
    eventType: string,
    dataSize: number,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} ✓ Message Published`;
    this.logger.log(message, {
      service: this.serviceName,
      messageId,
      eventType,
      dataSize: `${dataSize} bytes`,
      action: 'PUBLISH',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log message received
   */
  logMessageReceived(
    messageId: string,
    eventType: string,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} ◄ Message Received`;
    this.logger.log(message, {
      service: this.serviceName,
      messageId,
      eventType,
      action: 'RECEIVE',
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log message acknowledged
   */
  logMessageAcknowledged(messageId: string, eventType?: string): void {
    const message = `${this.logPrefix} ✓ Message Acknowledged`;
    this.logger.log(message, {
      service: this.serviceName,
      messageId,
      eventType,
      action: 'ACK',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log message processing started
   */
  logProcessingStarted(
    messageId: string,
    eventType: string,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} ► Processing Started`;
    this.logger.log(message, {
      service: this.serviceName,
      messageId,
      eventType,
      action: 'PROCESS_START',
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log message processing completed
   */
  logProcessingCompleted(
    messageId: string,
    eventType: string,
    duration: number,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} ✓ Processing Completed`;
    this.logger.log(message, {
      service: this.serviceName,
      messageId,
      eventType,
      duration: `${duration}ms`,
      action: 'PROCESS_END',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log listener started
   */
  logListenerStarted(topicName: string, subscriptionName: string): void {
    const message = `${this.logPrefix} ► Listener Started`;
    this.logger.log(message, {
      service: this.serviceName,
      topicName,
      subscriptionName,
      status: 'LISTENING',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log listener stopped
   */
  logListenerStopped(): void {
    const message = `${this.logPrefix} ■ Listener Stopped`;
    this.logger.log(message, {
      service: this.serviceName,
      status: 'STOPPED',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log message handler registration
   */
  logHandlerRegistered(handlersCount: number): void {
    const message = `${this.logPrefix} + Handler Registered`;
    this.logger.log(message, {
      service: this.serviceName,
      totalHandlers: handlersCount,
      action: 'HANDLER_REGISTER',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log queue statistics
   */
  logQueueStats(stats: Record<string, any>): void {
    const message = `${this.logPrefix} 📊 Queue Statistics`;
    this.logger.log(message, {
      service: this.serviceName,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log health check
   */
  logHealthCheck(status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY', details: Record<string, any>): void {
    const symbol = status === 'HEALTHY' ? '✓' : '⚠';
    const message = `${this.logPrefix} ${symbol} Health Check`;
    const logLevel = status === 'HEALTHY' ? 'log' : 'warn';
    
    this.logger[logLevel](message, {
      service: this.serviceName,
      status,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log warning
   */
  logWarning(
    title: string,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} ⚠ ${title}`;
    this.logger.warn(message, {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log error
   */
  logError(
    title: string,
    error: any,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} ✗ ${title}`;
    const errorMessage = error?.message || String(error);
    const stack = error?.stack || '';

    this.logger.error(message, {
      service: this.serviceName,
      error: errorMessage,
      stack: stack.split('\n').slice(0, 3).join('\n'),
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log API request
   */
  logApiRequest(
    method: string,
    endpoint: string,
    additionalData?: Record<string, any>,
  ): void {
    const message = `${this.logPrefix} → API Request`;
    this.logger.log(message, {
      service: this.serviceName,
      method,
      endpoint,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Log API response
   */
  logApiResponse(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    additionalData?: Record<string, any>,
  ): void {
    const statusSymbol = statusCode < 300 ? '✓' : statusCode < 400 ? 'ℹ' : '✗';
    const message = `${this.logPrefix} ${statusSymbol} API Response`;
    this.logger.log(message, {
      service: this.serviceName,
      method,
      endpoint,
      statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Generate a unique tracking ID for a message
   */
  generateTrackingId(): string {
    return randomUUID();
  }

  /**
   * Create a performance timer
   */
  createTimer(): { end: () => number } {
    const startTime = Date.now();
    return {
      end: () => Date.now() - startTime,
    };
  }
}
