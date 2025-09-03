/**
 * Rate limiting storage abstraction layer
 * Provides fallback from Durable Objects to in-memory storage
 */

// In-memory fallback store
const memoryStore = new Map();

/**
 * Abstract rate limit storage interface
 */
export class RateLimitStorage {
  /**
   * Get rate limit data for a key
   * @param {string} key - Rate limit key
   * @returns {Promise<object|null>} Rate limit data
   */
  async get() {
    throw new Error('get() must be implemented');
  }
  
  /**
   * Set rate limit data for a key
   * @param {string} key - Rate limit key
   * @param {object} data - Rate limit data
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<void>}
   */
  async set() {
    throw new Error('set() must be implemented');
  }
  
  /**
   * Delete rate limit data for a key
   * @param {string} key - Rate limit key
   * @returns {Promise<void>}
   */
  async delete() {
    throw new Error('delete() must be implemented');
  }
  
  /**
   * Clean up expired entries
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('cleanup() must be implemented');
  }
}

/**
 * Durable Objects storage implementation
 */
export class DurableObjectsStorage extends RateLimitStorage {
  constructor(durableObjectNamespace) {
    super();
    this.namespace = durableObjectNamespace;
  }
  
  async get(key) {
    try {
      const id = this.namespace.idFromName(key);
      const stub = this.namespace.get(id);
      const response = await stub.fetch('http://rate-limit/get');
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Durable Objects get error:', error);
      return null;
    }
  }
  
  async set(key, data, ttl) {
    try {
      const id = this.namespace.idFromName(key);
      const stub = this.namespace.get(id);
      await stub.fetch('http://rate-limit/set', {
        method: 'POST',
        body: JSON.stringify({ data, ttl })
      });
    } catch (error) {
      console.error('Durable Objects set error:', error);
      throw error;
    }
  }
  
  async delete(key) {
    try {
      const id = this.namespace.idFromName(key);
      const stub = this.namespace.get(id);
      await stub.fetch('http://rate-limit/delete', { method: 'DELETE' });
    } catch (error) {
      console.error('Durable Objects delete error:', error);
    }
  }
  
  async cleanup() {
    // Cleanup is handled by individual Durable Objects
    return;
  }
}

/**
 * In-memory storage implementation (fallback)
 */
export class InMemoryStorage extends RateLimitStorage {
  constructor() {
    super();
    this.store = memoryStore;
    
    // Register with global rate limit store for memory management
    if (!globalThis.rateLimitStore) {
      globalThis.rateLimitStore = this.store;
    }
  }
  
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  async set(key, data, ttl) {
    const expires = Date.now() + ttl;
    this.store.set(key, { data, expires });
  }
  
  async delete(key) {
    this.store.delete(key);
  }
  
  async cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours max retention
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expires || (now - entry.created > maxAge)) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Storage factory with automatic fallback
 */
export function createRateLimitStorage(env) {
  // Try to use Durable Objects if available
  if (env.RATE_LIMIT_DURABLE_OBJECTS) {
    try {
      return new DurableObjectsStorage(env.RATE_LIMIT_DURABLE_OBJECTS);
    } catch (error) {
      console.warn('Durable Objects not available, falling back to memory:', error);
    }
  }
  
  // Fallback to in-memory storage
  return new InMemoryStorage();
}