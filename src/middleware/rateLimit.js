/**
 * Rate limiting middleware using Cloudflare Durable Objects pattern
 * For now using in-memory storage per worker instance
 */

// In-memory storage for rate limit counters
// NOTE: In production, this should use Durable Objects or external storage
const rateLimitStore = new Map();

/**
 * Get client IP address from request headers
 */
function getClientIP(request) {
  // Check Cloudflare headers first
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;
  
  // Check other common headers
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;
  
  // Fallback (should not happen in Cloudflare Workers)
  return 'unknown';
}

/**
 * Hash IP address for privacy
 */
async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'rate-limit-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(request, options = {}) {
  const {
    windowMs = 60000,      // 1 minute default window
    maxRequests = 100,     // 100 requests per window default
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = null    // Custom key generator function
  } = options;
  
  try {
    const clientIP = getClientIP(request);
    const key = keyGenerator ? 
      await keyGenerator(request) : 
      await hashIP(clientIP);
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create rate limit data for this key
    let limitData = rateLimitStore.get(key);
    if (!limitData) {
      limitData = {
        requests: [],
        firstRequest: now
      };
      rateLimitStore.set(key, limitData);
    }
    
    // Clean up old requests outside the current window
    limitData.requests = limitData.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if rate limit exceeded
    if (limitData.requests.length >= maxRequests) {
      const oldestRequest = Math.min(...limitData.requests);
      const resetTime = oldestRequest + windowMs;
      
      return {
        allowed: false,
        error: 'Rate limit exceeded',
        resetTime,
        remaining: 0,
        total: maxRequests
      };
    }
    
    // Add current request timestamp
    limitData.requests.push(now);
    
    return {
      allowed: true,
      remaining: maxRequests - limitData.requests.length,
      resetTime: limitData.requests[0] + windowMs,
      total: maxRequests
    };
    
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // On error, allow the request to prevent service disruption
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: Date.now() + windowMs,
      total: maxRequests
    };
  }
}

/**
 * Clean up old entries from rate limit store
 * Should be called periodically
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.firstRequest > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate limiting configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Authentication endpoints - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,            // 5 attempts per 15 minutes
    keyGenerator: async (request) => {
      const ip = getClientIP(request);
      return await hashIP(ip + ':auth');
    }
  },
  
  // API endpoints - moderate limits
  api: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 60,           // 60 requests per minute
    keyGenerator: async (request) => {
      const ip = getClientIP(request);
      return await hashIP(ip + ':api');
    }
  },
  
  // Search endpoints - more restrictive
  search: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 20,           // 20 searches per minute
    keyGenerator: async (request) => {
      const ip = getClientIP(request);
      return await hashIP(ip + ':search');
    }
  },
  
  // General page views
  pages: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 120,          // 120 page views per minute
    keyGenerator: async (request) => {
      const ip = getClientIP(request);
      return await hashIP(ip + ':pages');
    }
  }
};

/**
 * Create rate limit response
 */
export function createRateLimitResponse(limitResult, originalResponse) {
  const headers = {
    'X-RateLimit-Limit': limitResult.total.toString(),
    'X-RateLimit-Remaining': limitResult.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(limitResult.resetTime / 1000).toString(),
    'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
  };
  
  if (!limitResult.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again after ${Math.ceil((limitResult.resetTime - Date.now()) / 1000)} seconds.`,
      resetTime: limitResult.resetTime
    }), {
      status: 429,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // Add rate limit headers to successful response
  if (originalResponse) {
    const newHeaders = new Headers(originalResponse.headers);
    Object.entries(headers).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    
    return new Response(originalResponse.body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: newHeaders
    });
  }
  
  return null;
}