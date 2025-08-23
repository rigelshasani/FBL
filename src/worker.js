/**
 * FBL Gothic Library Worker
 * Main Cloudflare Worker handling all requests
 */

import { requireAuth } from './middleware/auth.js';
import { handleLockScreen, handleLockSubmit, handleOneTimeView } from './routes/lock.js';
import { handleBooksPage, handleBookDetailPage } from './routes/books.js';
import { 
  handleBooksAPI,
  handleBookDetailAPI, 
  handleCategoriesAPI,
  handleSearchAPI,
  handleCategoryBooksAPI
} from './routes/api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    
    try {
      // Health check (no auth required)
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
      
      // Lock screen routes
      if (url.pathname === '/lock') {
        if (method === 'GET') {
          return await handleLockScreen(request, env);
        } else if (method === 'POST') {
          return await handleLockSubmit(request, env);
        }
      }
      
      // One-time view route (no auth middleware - handles its own validation)
      if (url.pathname.startsWith('/view/')) {
        const pathParts = url.pathname.split('/');
        if (pathParts.length === 4) {
          const token = pathParts[2];
          const timestamp = pathParts[3];
          return await handleOneTimeView(request, env, token, timestamp);
        }
      }
      
      // Apply auth middleware to all other routes
      const authResponse = await requireAuth(request, env);
      if (authResponse) {
        return authResponse;
      }
      
      // API routes (authenticated)
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/books') {
          return await handleBooksAPI(request, env);
        }
        
        if (url.pathname === '/api/categories') {
          return await handleCategoriesAPI(request, env);
        }
        
        if (url.pathname === '/api/search') {
          return await handleSearchAPI(request, env);
        }
        
        // Books detail API
        const bookMatch = url.pathname.match(/^\/api\/books\/([^\/]+)$/);
        if (bookMatch) {
          return await handleBookDetailAPI(request, env, bookMatch[1]);
        }
        
        // Category books API
        const categoryMatch = url.pathname.match(/^\/api\/categories\/([^\/]+)\/books$/);
        if (categoryMatch) {
          return await handleCategoryBooksAPI(request, env, categoryMatch[1]);
        }
        
        return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Protected routes
      if (url.pathname === '/') {
        return await handleHomePage(request, env);
      }
      
      if (url.pathname === '/books') {
        return await handleBooksPage(request, env);
      }
      
      // Book detail page
      const bookPageMatch = url.pathname.match(/^\/books\/([^\/]+)$/);
      if (bookPageMatch) {
        return await handleBookDetailPage(request, env, bookPageMatch[1]);
      }
      
      // Static assets (served by Cloudflare Pages)
      if (url.pathname.startsWith('/static/') || 
          url.pathname.endsWith('.css') || 
          url.pathname.endsWith('.js') || 
          url.pathname.endsWith('.ico')) {
        return new Response('Static asset not found', { status: 404 });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
    }
  }
};

/**
 * Handle authenticated home page - redirect to one-time view
 */
async function handleHomePage(request, env) {
  // Redirect authenticated home page requests to lock screen for one-time view
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/lock',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}