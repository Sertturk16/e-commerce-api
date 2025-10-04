import { LRUCache } from 'lru-cache';
import { logger } from '../config/logger';

// LRU Cache options
const options = {
  max: 500, // Maximum number of items
  ttl: 1000 * 60 * 15, // Default TTL: 15 minutes
  updateAgeOnGet: true, // Update age on access
  updateAgeOnHas: false,
};

// Create LRU cache instance
const cache = new LRUCache<string, any>(options);

export class CacheService {
  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    const value = cache.get(key);
    if (value !== undefined) {
      logger.debug(`Cache HIT: ${key}`);
    } else {
      logger.debug(`Cache MISS: ${key}`);
    }
    return value as T | undefined;
  }

  /**
   * Set value in cache with optional TTL
   */
  set(key: string, value: any, ttl?: number): void {
    cache.set(key, value, { ttl });
    logger.debug(`Cache SET: ${key}${ttl ? ` (TTL: ${ttl}ms)` : ''}`);
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    const deleted = cache.delete(key);
    if (deleted) {
      logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug(`Cache DELETE PATTERN: ${pattern} (${count} keys deleted)`);
    }

    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    cache.clear();
    logger.debug('Cache CLEARED');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: cache.size,
      max: cache.max,
    };
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return cache.has(key);
  }
}

export const cacheService = new CacheService();

// Cache key generators
export const CacheKeys = {
  categories: () => 'categories:all',

  product: (productId: string) => `product:${productId}`,

  products: (filters: {
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    search?: string;
    sellerId?: string;
  }) => {
    const parts = ['products'];
    if (filters.category) parts.push(`cat:${filters.category}`);
    if (filters.minPrice) parts.push(`min:${filters.minPrice}`);
    if (filters.maxPrice) parts.push(`max:${filters.maxPrice}`);
    if (filters.search) parts.push(`search:${filters.search}`);
    if (filters.sellerId) parts.push(`seller:${filters.sellerId}`);
    return parts.join(':');
  },

  // Patterns for bulk deletion
  allProducts: () => 'product:*',
  allProductLists: () => 'products:*',
  productsByCategory: (category: string) => `products:cat:${category}*`,
  productsBySeller: (sellerId: string) => `products:*seller:${sellerId}*`,
};

// Cache TTL constants (in milliseconds)
export const CacheTTL = {
  CATEGORIES: 1000 * 60 * 60 * 24, // 24 hours
  PRODUCT_DETAIL: 1000 * 60 * 10, // 10 minutes
  PRODUCT_LIST: 1000 * 60 * 5, // 5 minutes
};
