/**
 * Authentication middleware for gate protection
 */

import { validateAuthCookie } from '../auth/gate.js';

/**
 * Validate session token from Authorization header or cookie
 */
async function validateSessionToken(request, env) {
  // Check for Authorization header (for API requests)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return await validateBearerToken(token, env);
  }
  
  // Check for session cookie (for HTML page requests)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    return await validateSessionCookie(cookieHeader, env);
  }
  
  return { valid: false };
}

/**
 * Validate bearer token for API access
 */
async function validateBearerToken(token, env) {
  try {
    // Token format: {timestamp}:{signature}
    const parts = token.split(':');
    if (parts.length !== 2) {
      return { valid: false };
    }
    
    const [timestamp, signature] = parts;
    const now = Date.now();
    const tokenAge = now - parseInt(timestamp);
    
    // Token expires after 5 minutes
    if (tokenAge > 5 * 60 * 1000) {
      return { valid: false };
    }
    
    // Verify signature
    const expectedSignature = await generateTokenSignature(timestamp, env.SECRET_SEED);
    const encoder = new TextEncoder();
    const signatureBytes = encoder.encode(signature);
    const expectedBytes = encoder.encode(expectedSignature);
    
    const isValid = await crypto.subtle.timingSafeEqual(signatureBytes, expectedBytes);
    return { valid: isValid };
    
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Generate token signature
 */
async function generateTokenSignature(timestamp, secretSeed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}:api_token`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Validate session cookie for page access
 */
async function validateSessionCookie(cookieHeader, env) {
  try {
    // Extract session cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const sessionToken = cookies['cfb_session'];
    if (!sessionToken) {
      return { valid: false };
    }
    
    // Validate session token (similar to bearer token but with session prefix)
    const parts = sessionToken.split(':');
    if (parts.length !== 2) {
      return { valid: false };
    }
    
    const [timestamp, signature] = parts;
    const now = Date.now();
    const tokenAge = now - parseInt(timestamp);
    
    // Session expires after 10 minutes for page access
    if (tokenAge > 10 * 60 * 1000) {
      return { valid: false };
    }
    
    // Verify signature
    const expectedSignature = await generateSessionSignature(timestamp, env.SECRET_SEED);
    const encoder = new TextEncoder();
    const signatureBytes = encoder.encode(signature);
    const expectedBytes = encoder.encode(expectedSignature);
    
    const isValid = await crypto.subtle.timingSafeEqual(signatureBytes, expectedBytes);
    return { valid: isValid };
    
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Generate session signature
 */
async function generateSessionSignature(timestamp, secretSeed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}:session_token`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Middleware to protect routes behind authentication gate
 * STATELESS MODE: No cookies, password required on every request
 * @param {Request} request - HTTP request
 * @param {object} env - Environment variables
 * @returns {Response|null} Response if auth fails, null if auth succeeds
 */
export async function requireAuth(request, env) {
  // Skip auth for lock endpoint and one-time view pages
  const url = new URL(request.url);
  if (url.pathname === '/lock' || 
      url.pathname === '/health' || 
      url.pathname === '/admin' ||
      url.pathname.startsWith('/view/') ||
      url.pathname.startsWith('/admin/panel/')) {
    return null;
  }
  
  // For API requests, check for valid session token
  if (url.pathname.startsWith('/api/')) {
    const authResult = await validateSessionToken(request, env);
    if (authResult.valid) {
      return null; // Allow access
    }
    // For API requests, always return 401 without valid token
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // For HTML pages from one-time views, validate the view token
  const sessionResult = await validateSessionToken(request, env);
  if (sessionResult.valid) {
    return null; // Allow access
  }
  
  // ALWAYS redirect to lock screen - no persistent sessions
  const acceptHeader = request.headers.get('Accept') || '';
  if (acceptHeader.includes('text/html')) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/lock',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // Return 401 for remaining API requests without valid authentication
  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}