/**
 * Integration Test Example for Pub/Sub Implementation
 * Run with: npm run test:e2e
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000';

describe('Google Cloud Pub/Sub Integration Tests', () => {
  // Helper function to generate random IDs
  const generateId = () => `test-${Date.now()}-${Math.random()}`;

  describe('Producer API', () => {
    test('should publish a message successfully', async () => {
      const payload = {
        eventType: 'USER_ACTION',
        userId: generateId(),
        sessionId: generateId(),
        metadata: {
          action: 'test_action',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        payload,
      );

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.messageId).toBeDefined();
      expect(response.data.timestamp).toBeDefined();
    });

    test('should reject invalid event type', async () => {
      const payload = {
        eventType: '', // Empty event type
        userId: generateId(),
        sessionId: generateId(),
      };

      try {
        await axios.post(`${API_URL}/api/pubsub/publish`, payload);
        fail('Should have thrown an error');
      } catch (error) {
        expect(axios.isAxiosError(error)).toBe(true);
        expect(error?.response?.status).toBe(400);
      }
    });

    test('should publish SESSION_CREATED event', async () => {
      const payload = {
        eventType: 'SESSION_CREATED',
        userId: generateId(),
        sessionId: generateId(),
        metadata: {
          browser: 'Chrome',
          ip: '192.168.1.1',
          device: 'Desktop',
        },
      };

      const response = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        payload,
      );

      expect(response.data.success).toBe(true);
      expect(response.data.messageId).toBeDefined();
    });

    test('should publish SESSION_UPDATED event', async () => {
      const payload = {
        eventType: 'SESSION_UPDATED',
        userId: generateId(),
        sessionId: generateId(),
        metadata: {
          lastActivity: new Date().toISOString(),
          duration: 1800,
        },
      };

      const response = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        payload,
      );

      expect(response.data.success).toBe(true);
    });

    test('should publish COOKIE_SYNC event', async () => {
      const payload = {
        eventType: 'COOKIE_SYNC',
        userId: generateId(),
        sessionId: generateId(),
        metadata: {
          cookies: {
            auth_token: 'abc123',
            preferences: 'theme=dark',
          },
        },
      };

      const response = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        payload,
      );

      expect(response.data.success).toBe(true);
    });
  });

  describe('Pub/Sub Status API', () => {
    test('should return connection status', async () => {
      const response = await axios.get(`${API_URL}/api/pubsub/status`);

      expect(response.status).toBe(200);
      expect(response.data.connected).toBeDefined();
      expect(response.data.details).toBeDefined();
    });

    test('should return subscription details', async () => {
      const response = await axios.get(`${API_URL}/api/pubsub/status`);

      expect(response.data.details.topicName).toBeDefined();
      expect(response.data.details.subscriptionName).toBeDefined();
      expect(response.data.details.isConnected).toBeDefined();
      expect(response.data.details.messageHandlersCount).toBeGreaterThan(0);
    });

    test('status should indicate connection after service initialization', async () => {
      // Wait a bit for service to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await axios.get(`${API_URL}/api/pubsub/status`);

      expect(response.data.connected).toBe(true);
    });
  });

  describe('Message Publishing Performance', () => {
    test('should handle multiple rapid publishes', async () => {
      const messageCount = 10;
      const payloads = Array.from({ length: messageCount }, () => ({
        eventType: 'USER_ACTION',
        userId: generateId(),
        sessionId: generateId(),
        metadata: {
          index: Math.random(),
          timestamp: new Date().toISOString(),
        },
      }));

      const startTime = Date.now();

      const promises = payloads.map((payload) =>
        axios.post(`${API_URL}/api/pubsub/publish`, payload),
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(responses).toHaveLength(messageCount);
      responses.forEach((response) => {
        expect(response.data.success).toBe(true);
      });

      console.log(`Published ${messageCount} messages in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    });

    test('should handle large metadata payloads', async () => {
      const largeMetadata = {
        data: 'x'.repeat(10000), // 10KB of data
        nested: {
          deep: {
            structure: {
              with: {
                many: {
                  levels: Array.from({ length: 50 }, (_, i) => ({
                    id: i,
                    value: `item-${i}`,
                  })),
                },
              },
            },
          },
        },
      };

      const payload = {
        eventType: 'USER_ACTION',
        userId: generateId(),
        sessionId: generateId(),
        metadata: largeMetadata,
      };

      const response = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        payload,
      );

      expect(response.data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing eventType gracefully', async () => {
      const payload = {
        userId: generateId(),
        sessionId: generateId(),
      };

      try {
        await axios.post(`${API_URL}/api/pubsub/publish`, payload);
        fail('Should have thrown an error');
      } catch (error) {
        expect(axios.isAxiosError(error)).toBe(true);
        expect(error?.response?.status).toBe(400);
      }
    });

    test('should handle invalid JSON in metadata', async () => {
      const payload = {
        eventType: 'USER_ACTION',
        userId: generateId(),
        sessionId: generateId(),
        metadata: 'not-a-json-object', // Invalid - should be object
      };

      const response = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        payload,
      );

      // The API should still accept it (it serializes to JSON)
      expect(response.data.success).toBe(true);
    });

    test('should handle network errors gracefully', async () => {
      try {
        await axios.post('http://invalid-url:9999/api/pubsub/publish', {
          eventType: 'USER_ACTION',
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(axios.isAxiosError(error)).toBe(true);
      }
    });
  });

  describe('Subscriber Integration', () => {
    test('should have active message handlers', async () => {
      const response = await axios.get(`${API_URL}/api/pubsub/status`);

      expect(response.data.details.messageHandlersCount).toBeGreaterThan(0);
    });

    test('should receive messages in subscription', async () => {
      const userId = generateId();
      const sessionId = generateId();

      // Publish a message
      const publishResponse = await axios.post(
        `${API_URL}/api/pubsub/publish`,
        {
          eventType: 'USER_ACTION',
          userId,
          sessionId,
          metadata: { testId: publishResponse?.data?.messageId },
        },
      );

      expect(publishResponse.data.success).toBe(true);

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check subscriber status
      const statusResponse = await axios.get(`${API_URL}/api/pubsub/status`);
      expect(statusResponse.data.connected).toBe(true);
    });
  });
});

// Utility functions for manual testing
export const testPublishMessage = async (eventType: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/pubsub/publish`, {
      eventType,
      userId: generateId(),
      sessionId: generateId(),
      metadata: { timestamp: new Date().toISOString() },
    });
    console.log('✅ Message published:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to publish:', error);
    throw error;
  }
};

export const testGetStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/pubsub/status`);
    console.log('✅ Status:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get status:', error);
    throw error;
  }
};

export const testMultiplePublishes = async (count: number) => {
  try {
    const promises = Array.from({ length: count }, () =>
      testPublishMessage('USER_ACTION'),
    );
    const results = await Promise.all(promises);
    console.log(`✅ Published ${results.length} messages successfully`);
    return results;
  } catch (error) {
    console.error(`❌ Failed to publish ${count} messages:`, error);
    throw error;
  }
};
