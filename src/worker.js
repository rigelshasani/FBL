/**
 * FBL Gothic Library Worker
 * Main Cloudflare Worker handling all requests
 */

import { requireAuth } from './middleware/auth.js';
import { handleLockScreen, handleLockSubmit, handleOneTimeView } from './routes/lock.js';
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
 * Handle authenticated home page
 */
async function handleHomePage(request, env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cemetery of Forgotten Books</title>
  <meta name="description" content="Cemetery of forgotten books - authenticated">
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      color: #e8e8e8;
      min-height: 100vh;
      padding: 2rem;
    }
    
    .header {
      text-align: center;
      margin-bottom: 3rem;
    }
    
    .header h1 {
      font-size: 3rem;
      font-weight: 300;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    
    .header .subtitle {
      font-size: 1.2rem;
      opacity: 0.7;
      font-style: italic;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .welcome {
      text-align: center;
      padding: 3rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    
    .welcome h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #d4af37;
    }
    
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    
    .status-card {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 1.5rem;
    }
    
    .status-card h3 {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #b8860b;
    }
    
    .status-card p {
      opacity: 0.8;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }
    
    .footer {
      text-align: center;
      margin-top: 3rem;
      opacity: 0.5;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>CFB</h1>
      <p class="subtitle">Cemetery of Forgotten Books</p>
    </header>
    
    <div class="welcome">
      <h2>Welcome to the Cemetery</h2>
      <p>You have successfully entered the cemetery of forgotten books.</p>
      
      <div class="status-grid">
        <div class="status-card">
          <h3>Gate Status</h3>
          <p>Authenticated ✓</p>
        </div>
        <div class="status-card">
          <h3>Catalog</h3>
          <p>0 books available</p>
        </div>
        <div class="status-card">
          <h3>Search</h3>
          <p>Ready for queries</p>
        </div>
        <div class="status-card">
          <h3>System</h3>
          <p>Under construction</p>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Access expires at midnight (Europe/Tirane)</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=300'
    }
  });
}