/**
 * Memory management and cleanup utilities
 */

import { logger } from '../monitoring/logger.js';

/**
 * Memory manager for tracking and cleaning up resources
 */
export class MemoryManager {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 10000;
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes
    this.stores = new Map();
    this.lastCleanup = Date.now();
  }
  
  /**
   * Register a storage instance for cleanup management
   */
  registerStore(name, store, options = {}) {
    this.stores.set(name, {
      store,
      maxEntries: options.maxEntries || this.maxEntries,
      maxAge: options.maxAge || this.maxAge,
      ageExtractor: options.ageExtractor || ((key, value) => value.created || value.timestamp || Date.now())
    });
    
    logger.debug('Registered store for memory management', { store: name });
  }
  
  /**
   * Perform cleanup on all registered stores
   */
  async cleanup(force = false) {
    const now = Date.now();
    
    // Skip cleanup if not enough time has passed (unless forced)
    if (!force && (now - this.lastCleanup) < this.cleanupInterval) {
      return;
    }
    
    this.lastCleanup = now;
    const cleanupStats = {};
    
    for (const [storeName, storeConfig] of this.stores.entries()) {
      try {
        const stats = await this.cleanupStore(storeName, storeConfig, now);
        cleanupStats[storeName] = stats;
      } catch (error) {
        logger.error(`Memory cleanup failed for store: ${storeName}`, {
          store: storeName,
          error: error.message
        });
      }
    }
    
    logger.info('Memory cleanup completed', { 
      stores: cleanupStats,
      totalStores: this.stores.size
    });
    
    return cleanupStats;
  }
  
  /**
   * Clean up a specific store
   */
  async cleanupStore(storeName, config, now) {
    const { store, maxEntries, maxAge, ageExtractor } = config;
    const initialSize = store.size;
    let removedByAge = 0;
    let removedBySize = 0;
    
    // Remove entries older than maxAge
    const expiredKeys = [];
    for (const [key, value] of store.entries()) {
      try {
        const age = ageExtractor(key, value);
        if (now - age > maxAge) {
          expiredKeys.push(key);
        }
      } catch {
        // If we can't extract age, consider it expired
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      store.delete(key);
      removedByAge++;
    }
    
    // Remove oldest entries if size exceeds maxEntries
    if (store.size > maxEntries) {
      const entries = Array.from(store.entries());
      
      // Sort by age (oldest first)
      entries.sort((a, b) => {
        try {
          const ageA = ageExtractor(a[0], a[1]);
          const ageB = ageExtractor(b[0], b[1]);
          return ageA - ageB;
        } catch {
          return 0; // Keep original order if age extraction fails
        }
      });
      
      // Remove oldest entries
      const toRemove = store.size - maxEntries;
      for (let i = 0; i < toRemove; i++) {
        if (entries[i]) {
          store.delete(entries[i][0]);
          removedBySize++;
        }
      }
    }
    
    return {
      initialSize,
      finalSize: store.size,
      removedByAge,
      removedBySize,
      totalRemoved: removedByAge + removedBySize
    };
  }
  
  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const stats = {
      stores: {},
      totalEntries: 0,
      lastCleanup: this.lastCleanup
    };
    
    for (const [storeName, config] of this.stores.entries()) {
      const size = config.store.size;
      stats.stores[storeName] = {
        size,
        maxEntries: config.maxEntries,
        maxAge: config.maxAge,
        utilizationPercent: Math.round((size / config.maxEntries) * 100)
      };
      stats.totalEntries += size;
    }
    
    // Add process memory info if available
    if (typeof performance !== 'undefined' && performance.memory) {
      stats.process = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    
    return stats;
  }
  
  /**
   * Force cleanup of a specific store
   */
  async cleanupSpecificStore(storeName) {
    const config = this.stores.get(storeName);
    if (!config) {
      throw new Error(`Store '${storeName}' not found`);
    }
    
    return await this.cleanupStore(storeName, config, Date.now());
  }
  
  /**
   * Clear all data from a specific store
   */
  clearStore(storeName) {
    const config = this.stores.get(storeName);
    if (!config) {
      throw new Error(`Store '${storeName}' not found`);
    }
    
    const initialSize = config.store.size;
    config.store.clear();
    
    logger.info(`Cleared store: ${storeName}`, {
      store: storeName,
      entriesRemoved: initialSize
    });
    
    return initialSize;
  }
}

/**
 * Global memory manager instance
 */
export const memoryManager = new MemoryManager({
  maxEntries: 1000,
  maxAge: 60 * 60 * 1000, // 1 hour default
  cleanupInterval: 2 * 60 * 1000 // 2 minutes
});

/**
 * WeakMap for storing cleanup callbacks
 */
const cleanupCallbacks = new WeakMap();

/**
 * Register cleanup callback for an object
 */
export function registerCleanup(object, cleanupFn) {
  cleanupCallbacks.set(object, cleanupFn);
}

/**
 * Execute cleanup callback for an object if it exists
 */
export function executeCleanup(object) {
  const cleanupFn = cleanupCallbacks.get(object);
  if (cleanupFn) {
    try {
      cleanupFn();
      cleanupCallbacks.delete(object);
      return true;
    } catch (error) {
      logger.error('Cleanup callback failed', {
        error: error.message
      });
      return false;
    }
  }
  return false;
}

/**
 * Automatic periodic cleanup scheduler
 */
export class CleanupScheduler {
  constructor(memoryManager, interval = 5 * 60 * 1000) {
    this.memoryManager = memoryManager;
    this.interval = interval;
    this.timerId = null;
    this.isRunning = false;
  }
  
  start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.scheduleNext();
    logger.info('Memory cleanup scheduler started', {
      interval: this.interval
    });
  }
  
  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    logger.info('Memory cleanup scheduler stopped');
  }
  
  scheduleNext() {
    if (!this.isRunning) {
      return;
    }
    
    this.timerId = setTimeout(async () => {
      try {
        await this.memoryManager.cleanup();
      } catch {
        logger.error('Scheduled cleanup failed', {
          error: error.message
        });
      } finally {
        this.scheduleNext();
      }
    }, this.interval);
  }
}

/**
 * Initialize memory management for common stores
 */
export function initializeMemoryManagement() {
  // Register rate limit store if it exists
  if (globalThis.rateLimitStore) {
    memoryManager.registerStore('rateLimits', globalThis.rateLimitStore, {
      maxEntries: 5000,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      ageExtractor: (key, value) => value.firstRequest || Date.now()
    });
  }
  
  // Register log metrics store if it exists
  if (globalThis.logMetrics) {
    // Create a Map wrapper for the metrics object
    const metricsMap = new Map();
    metricsMap.set('counts', globalThis.logMetrics.counts);
    metricsMap.set('errors', globalThis.logMetrics.errors);
    metricsMap.set('performance', globalThis.logMetrics.performance);
    
    memoryManager.registerStore('logMetrics', metricsMap, {
      maxEntries: 3, // Only 3 main metric categories
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      ageExtractor: () => Date.now() - 60 * 60 * 1000 // Don't age out main metrics
    });
  }
  
  logger.info('Memory management initialized');
}

/**
 * Create a bounded cache with automatic cleanup
 */
export function createBoundedCache(name, options = {}) {
  const cache = new Map();
  const maxSize = options.maxSize || 1000;
  const maxAge = options.maxAge || 60 * 60 * 1000; // 1 hour
  
  // Register with memory manager
  memoryManager.registerStore(name, cache, {
    maxEntries: maxSize,
    maxAge,
    ageExtractor: (key, value) => value.timestamp || Date.now()
  });
  
  const boundedCache = {
    get(key) {
      const entry = cache.get(key);
      if (!entry) return undefined;
      
      // Check if expired
      if (Date.now() - entry.timestamp > maxAge) {
        cache.delete(key);
        return undefined;
      }
      
      return entry.value;
    },
    
    set(key, value) {
      cache.set(key, {
        value,
        timestamp: Date.now()
      });
      
      // Trigger cleanup if size exceeds threshold
      if (cache.size > maxSize * 1.1) {
        memoryManager.cleanupSpecificStore(name).catch(error => {
          logger.error(`Cache cleanup failed for ${name}`, {
            error: error.message
          });
        });
      }
    },
    
    has(key) {
      return this.get(key) !== undefined;
    },
    
    delete(key) {
      return cache.delete(key);
    },
    
    clear() {
      cache.clear();
    },
    
    get size() {
      return cache.size;
    }
  };
  
  return boundedCache;
}