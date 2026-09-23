import 'dotenv/config';
import { RedisWrapper } from 'nest-common-utilities';

/**
 * Standalone script to broadcast a Casbin policy update signal via Redis.
 * Useful after making direct database or schema modifications.
 *
 * Usage:
 *   npm run casbin:reload
 */
async function broadcast() {
  const redis = new RedisWrapper();
  const payload = JSON.stringify({
    origin: 'cli_broadcast',
    action: 'database_schema_changed',
    timestamp: Date.now(),
  });

  console.log('[Casbin Reload CLI] Broadcasting policy reload signal to Redis channel "casbin_policy_update"...');
  await redis.publish('casbin_policy_update', payload);
  console.log('[Casbin Reload CLI] Signal broadcasted successfully to all active backend instances.');

  // Allow pending I/O to flush before disconnecting
  setTimeout(async () => {
    try {
      await redis.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(0);
  }, 500);
}

broadcast().catch((err) => {
  console.error('[Casbin Reload CLI] Error broadcasting policy reload:', err);
  process.exit(1);
});

