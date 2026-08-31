import { NotificationPocConsumer } from './NotificationPoc.Consumer';

describe('NotificationPocConsumer', () => {
  it('should keep and return the latest pubsub message payload', () => {
    const consumer = new NotificationPocConsumer();
    const payload = {
      event: 'NOTIFICATION_TEST',
      message: 'Hello from NestJS',
      timestamp: '2026-08-27T00:00:00.000Z',
    };

    consumer.setLatestMessage(payload);

    expect(consumer.getLatestMessage()).toEqual(payload);
  });
});
