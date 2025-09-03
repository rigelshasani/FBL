/**
 * Session management utilities
 * Provides token invalidation and blacklisting functionality
 */

import { createRateLimitStorage } from '../middleware/rateLimitStorage.js';

// Session blacklist storage
let blacklistStorage = null;

/**
 * Initialize session blacklist storage
 */
function initializeBlacklistStorage(env) {
  if (!blacklistStorage) {
    blacklistStorage = createRateLimitStorage(env);
  }
  return blacklistStorage;
}

/**
 * Generate session blacklist key
 */
function getBlacklistKey(token) {
  return `session_blacklist:${token}`;
}

/**
 * Add session token to blacklist
 * @param {string} token - Session token to blacklist
 * @param {object} env - Environment variables
 * @param {number} ttl - Time to live in milliseconds (default: 24 hours)
 */
export async function blacklistSession(token, env, ttl = 24 * 60 * 60 * 1000) {
  try {
    const storage = initializeBlacklistStorage(env);
    const key = getBlacklistKey(token);
    
    await storage.set(key, { 
      blacklisted: true, 
      timestamp: Date.now() 
    }, ttl);
    
    return true;
  } catch (error) {
    console.error('Session blacklist error:', error);
    return false;
  }
}

/**
 * Check if session token is blacklisted
 * @param {string} token - Session token to check
 * @param {object} env - Environment variables
 * @returns {Promise<boolean>} True if blacklisted
 */
export async function isSessionBlacklisted(token, env) {
  try {
    const storage = initializeBlacklistStorage(env);
    const key = getBlacklistKey(token);
    
    const result = await storage.get(key);
    return !!result?.blacklisted;
  } catch (error) {
    console.error('Session blacklist check error:', error);
    // On error, assume not blacklisted to prevent service disruption
    return false;
  }
}

/**
 * Invalidate all sessions for a given secret seed
 * This effectively forces re-authentication for all users
 * @param {object} env - Environment variables
 */
export async function invalidateAllSessions(env) {
  try {
    // Update a global invalidation timestamp
    const storage = initializeBlacklistStorage(env);
    const globalKey = 'global_session_invalidation';
    
    await storage.set(globalKey, {
      timestamp: Date.now(),
      reason: 'admin_invalidation'
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    return true;
  } catch (error) {
    console.error('Global session invalidation error:', error);
    return false;
  }
}

/**
 * Check if session was created before global invalidation
 * @param {number} sessionTimestamp - Session creation timestamp
 * @param {object} env - Environment variables
 * @returns {Promise<boolean>} True if session is invalid
 */
export async function isSessionGloballyInvalid(sessionTimestamp, env) {
  try {
    const storage = initializeBlacklistStorage(env);
    const globalKey = 'global_session_invalidation';
    
    const invalidation = await storage.get(globalKey);
    if (!invalidation) return false;
    
    // Session is invalid if it was created before the invalidation
    return sessionTimestamp < invalidation.timestamp;
  } catch (error) {
    console.error('Global session validation error:', error);
    return false;
  }
}

/**
 * Extract session timestamp from token
 * @param {string} token - Session token in format "timestamp:signature"
 * @returns {number|null} Timestamp or null if invalid
 */
export function extractSessionTimestamp(token) {
  try {
    const parts = token.split(':');
    if (parts.length !== 2) return null;
    
    const timestamp = parseInt(parts[0], 10);
    return isNaN(timestamp) ? null : timestamp;
  } catch (error) {
    return null;
  }
}

/**
 * Cleanup expired blacklist entries
 * @param {object} env - Environment variables
 */
export async function cleanupExpiredSessions(env) {
  try {
    const storage = initializeBlacklistStorage(env);
    await storage.cleanup();
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}