/**
 * Authentication middleware for gate protection
 */

import { validateAuthCookie } from '../auth/gate.js';

/**
 * Middleware to protect routes behind authentication gate
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
  
  // Check for auth cookie
  const cookieHeader = request.headers.get('Cookie');
  const isValid = await validateAuthCookie(cookieHeader, env.SECRET_SEED);
  
  if (!isValid) {
    // Redirect to lock screen for HTML requests
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
    
    // Return 401 for API requests
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  return null; // Auth successful, continue to route handler
}