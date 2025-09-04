/**
 * Intelligent caching layer with TTL and memory management
 */

import { logger } from '../monitoring/logger.js';
import { CACHE, MEMORY, TIME } from '../config/constants.js';

/**
 * Cache entry with TTL and access tracking
 */
class CacheEntry {
  constructor(value, ttl = 0) {
    this.value = value;
    this.created = Date.now();
    this.ttl = ttl;
    this.lastAccessed = this.created;
    this.accessCount = 1;
  }
  
  isExpired() {
    if (this.ttl === 0) return false; // No expiration
    return (Date.now() - this.created) > this.ttl;
  }
  
  access() {
    this.lastAccessed = Date.now();
    this.accessCount++;
    return this.value;
  }
}

/**
 * Memory-efficient cache with automatic cleanup
 */
export class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || MEMORY.DEFAULT_MAX_ENTRIES;
    this.defaultTTL = options.defaultTTL || CACHE.API_RESPONSE_TTL;
    this.cleanupInterval = options.cleanupInterval || CACHE.CLEANUP_INTERVAL;
    this.hitRatio = options.targetHitRatio || 0.8;
    
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      cleanups: 0
    };
    
    this.lastCleanup = Date.now();
    
    // Auto-cleanup timer (only if not in test environment)
    if (typeof globalThis !== 'undefined' && !globalThis.vitest) {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }
  
  /**
   * Get value from cache
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    if (entry.isExpired()) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    this.stats.hits++;
    return entry.access();
  }
  
  /**
   * Set value in cache with optional TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const entry = new CacheEntry(value, ttl);
    this.cache.set(key, entry);
    this.stats.sets++;
    
    // Periodic cleanup check
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.isExpired()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  
  /**
   * Delete specific key
   */
  delete(key) {
    return this.cache.delete(key);
  }
  
  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0, cleanups: 0 };
  }
  
  /**
   * Get or set pattern - fetch if not cached
   */
  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    let value = this.get(key);
    if (value !== undefined) {
      return value;
    }
    
    try {
      value = await fetchFn();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      // Don't cache errors, let them bubble up
      throw error;
    }
  }
  
  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldestTime = Date.now();
    let oldestKey = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
  
  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const sizeBefore = this.cache.size;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.isExpired()) {
        this.cache.delete(key);
      }
    }
    
    this.lastCleanup = now;
    this.stats.cleanups++;
    
    const removed = sizeBefore - this.cache.size;
    if (removed > 0) {
      logger.debug('Cache cleanup completed', {
        removed,
        remaining: this.cache.size,
        hitRatio: this.getHitRatio()
      });
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRatio: this.getHitRatio(),
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Calculate hit ratio
   */
  getHitRatio() {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }
  
  /**
   * Estimate memory usage (rough calculation)
   */
  estimateMemoryUsage() {
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // Rough string size
      size += JSON.stringify(entry.value).length * 2; // Rough object size
      size += 64; // Entry overhead
    }
    return size;
  }
  
  /**
   * Cleanup on destruction
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Global cache instances for different use cases
export const responseCache = new SmartCache({
  maxSize: CACHE.RESPONSE_CACHE_SIZE,
  defaultTTL: CACHE.API_RESPONSE_TTL,
  cleanupInterval: CACHE.RESPONSE_CACHE_CLEANUP
});

export const databaseCache = new SmartCache({
  maxSize: CACHE.DATABASE_CACHE_SIZE,
  defaultTTL: CACHE.DATABASE_QUERY_TTL,
  cleanupInterval: CACHE.DATABASE_CACHE_CLEANUP
});

export const authCache = new SmartCache({
  maxSize: CACHE.AUTH_CACHE_SIZE,
  defaultTTL: CACHE.AUTH_TOKEN_TTL,
  cleanupInterval: CACHE.AUTH_CACHE_CLEANUP
});

/**
 * Cache key generator utilities
 */
export const cacheKeys = {
  /**
   * Generate cache key for API requests
   */
  api: (method, path, params = {}) => {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `api:${method}:${path}${paramString ? '?' + paramString : ''}`;
  },
  
  /**
   * Generate cache key for database queries
   */
  db: (table, operation, params = {}) => {
    const paramString = JSON.stringify(params);
    return `db:${table}:${operation}:${paramString}`;
  },
  
  /**
   * Generate cache key for authentication
   */
  auth: (token) => {
    return `auth:${token.slice(0, 16)}`;
  }
};

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.warmupInterval = options.warmupInterval || TIME.THIRTY_MINUTES;
    this.maxConcurrency = options.maxConcurrency || 5;
    this.warmupFunctions = new Map();
  }
  
  /**
   * Register a warmup function
   */
  register(key, fetchFn, priority = 1) {
    this.warmupFunctions.set(key, {
      fetchFn,
      priority,
      lastWarmed: 0
    });
  }
  
  /**
   * Warm up cache with registered functions
   */
  async warmup() {
    const functions = Array.from(this.warmupFunctions.entries())
      .sort(([,a], [,b]) => b.priority - a.priority)
      .slice(0, this.maxConcurrency);
    
    const promises = functions.map(async ([key, config]) => {
      try {
        const value = await config.fetchFn();
        this.cache.set(key, value);
        config.lastWarmed = Date.now();
        return { key, success: true };
      } catch (error) {
        logger.warn('Cache warmup failed', { key, error: error.message });
        return { key, success: false, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    logger.info('Cache warmup completed', {
      successful,
      total: functions.length,
      cacheSize: this.cache.cache.size
    });
    
    return { successful, total: functions.length };
  }
}