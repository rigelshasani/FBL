/**
 * FBL Gothic Library Worker
 * Main Cloudflare Worker handling all requests
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Basic routing structure
    if (url.pathname === '/') {
      return new Response('FBL Gothic Library - Coming Soon', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'development'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};