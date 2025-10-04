import { redis } from '../config/redis';

export class DistributedLock {
  /**
   * Acquire a distributed lock using Redis
   * @param key - Lock key
   * @param ttl - Time to live in milliseconds
   * @param timeout - Maximum time to wait for lock in milliseconds
   * @returns Lock token if acquired, null otherwise
   */
  static async acquire(key: string, ttl: number = 5000, timeout: number = 10000): Promise<string | null> {
    const lockKey = `lock:${key}`;
    const token = `${Date.now()}-${Math.random()}`;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      // Try to acquire lock with NX (only if not exists) and PX (expiry in ms)
      const result = await redis.set(lockKey, token, 'PX', ttl, 'NX');

      if (result === 'OK') {
        return token;
      }

      // Wait a bit before retrying (exponential backoff)
      const waitTime = Math.min(100 * Math.pow(1.5, Math.floor((Date.now() - start) / 100)), 500);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    return null;
  }

  /**
   * Release a distributed lock
   * @param key - Lock key
   * @param token - Lock token received from acquire
   * @returns true if released, false if lock was already released or owned by another process
   */
  static async release(key: string, token: string): Promise<boolean> {
    const lockKey = `lock:${key}`;

    // Lua script to atomically check token and delete lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await redis.eval(script, 1, lockKey, token);
    return result === 1;
  }

  /**
   * Execute a function with distributed lock
   * @param key - Lock key
   * @param fn - Function to execute
   * @param ttl - Lock TTL in milliseconds
   * @param timeout - Maximum time to wait for lock
   */
  static async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 5000,
    timeout: number = 10000
  ): Promise<T> {
    const token = await this.acquire(key, ttl, timeout);

    if (!token) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}
