/**
 * Authentication middleware for gate protection
 */

import { validateAuthCookie } from '../auth/gate.js';

/**
 * Middleware to protect routes behind authentication gate
 * STATELESS MODE: No cookies, password required on every request
 * @param {Request} request - HTTP request
 * @param {object} env - Environment variables
 * @returns {Response|null} Response if auth fails, null if auth succeeds
 */
export async function requireAuth(request, env) {
  // Skip auth for lock endpoint
  const url = new URL(request.url);
  if (url.pathname === '/lock' || url.pathname === '/health') {
    return null;
  }
  
  // ALWAYS redirect to lock screen - no persistent sessions
  // This ensures maximum security with no traces
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
  
  // Return 401 for API requests - require auth on every call
  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}