/**
 * FBL Gothic Library Worker
 * Main Cloudflare Worker handling all requests
 */

import { requireAuth } from './middleware/auth.js';
import { rateLimitMiddleware, rateLimitConfigs, createRateLimitResponse, cleanupRateLimitStore } from './middleware/rateLimit.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { securityResponse } from './middleware/securityHeaders.js';
import { createRequestLogger, PerformanceTracker, logSecurityEvent, getMetricsSnapshot } from './monitoring/logger.js';
import { memoryManager, initializeMemoryManagement, CleanupScheduler } from './utils/memoryManager.js';
import { handleLockScreen, handleLockSubmit, handleOneTimeView } from './routes/lock.js';
import { handleBooksPage, handleBookDetailPage } from './routes/books.js';
import { handleAdminLogin, handleAdminSubmit, handleAdminPanel, handleAdminAPI } from './routes/admin.js';
import { handleHomePage } from './routes/home.js';
import { handleBookDownload } from './routes/download.js';
import { 
  handleBooksAPI,
  handleBookDetailAPI, 
  handleCategoriesAPI,
  handleSearchAPI,
  handleCategoryBooksAPI
} from './routes/api.js';

export default {
  async fetch(request, env) {
    // Initialize request tracking
    const requestLogger = createRequestLogger(request);
    const requestTracker = new PerformanceTracker('request_handling', requestLogger);
    
    const url = new URL(request.url);
    const method = request.method;
    
    // Set start time for uptime tracking and initialize memory management
    if (!globalThis.startTime) {
      globalThis.startTime = Date.now();
      initializeMemoryManagement();
      
      // Start cleanup scheduler
      if (!globalThis.cleanupScheduler) {
        globalThis.cleanupScheduler = new CleanupScheduler(memoryManager);
        globalThis.cleanupScheduler.start();
      }
    }
    
    requestLogger.info('Request received', {
      url: url.pathname + url.search,
      method: request.method
    });
    
    try {
      // Cleanup rate limit store and memory periodically (every ~1000 requests)
      if (Math.random() < 0.001) {
        await Promise.all([
          cleanupRateLimitStore(env),
          memoryManager.cleanup()
        ]);
      }
      
      // Health check (no rate limiting or auth required)
      if (url.pathname === '/health') {
        const metrics = getMetricsSnapshot();
        const response = new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development',
          metrics: {
            uptime: metrics.uptime,
            requests: metrics.counts,
            performance: metrics.performance,
            errorCount: metrics.recentErrors.length
          }
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        requestTracker.finish(true, { endpoint: 'health' });
        return securityResponse(response);
      }
      
      // Metrics endpoint (admin only)
      if (url.pathname === '/admin/metrics') {
        const metrics = getMetricsSnapshot();
        const memoryStats = memoryManager.getMemoryStats();
        
        const response = new Response(JSON.stringify({
          ...metrics,
          memory: memoryStats
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        requestTracker.finish(true, { endpoint: 'metrics' });
        return securityResponse(response);
      }
      
      // Lock screen routes (with auth rate limiting for POST)
      if (url.pathname === '/lock') {
        if (method === 'GET') {
          // Apply page rate limiting
          const rateLimitResult = await rateLimitMiddleware(request, env, rateLimitConfigs.pages);
          if (!rateLimitResult.allowed) {
            logSecurityEvent('rate_limit_exceeded', { 
              endpoint: 'lock_screen_get',
              ip: request.headers.get('CF-Connecting-IP')
            });
            requestTracker.finish(false, { endpoint: 'lock', reason: 'rate_limited' });
            return createRateLimitResponse(rateLimitResult);
          }
          
          const response = await handleLockScreen(request, env);
          requestTracker.finish(true, { endpoint: 'lock' });
          return createRateLimitResponse(rateLimitResult, response) || response;
        } else if (method === 'POST') {
          // Apply CSRF protection for POST requests
          const csrfResult = await csrfMiddleware(request, env, {
            skipPaths: [] // Don't skip lock POST for CSRF
          });
          if (!csrfResult.valid) {
            logSecurityEvent('csrf_validation_failed', { 
              endpoint: 'lock_submit',
              ip: request.headers.get('CF-Connecting-IP')
            });
            requestTracker.finish(false, { endpoint: 'lock', reason: 'csrf_failed' });
            return csrfResult.response;
          }
          
          // Apply stricter auth rate limiting for login attempts
          const rateLimitResult = await rateLimitMiddleware(request, env, rateLimitConfigs.auth);
          if (!rateLimitResult.allowed) {
            logSecurityEvent('auth_rate_limit_exceeded', { 
              endpoint: 'lock_submit',
              ip: request.headers.get('CF-Connecting-IP')
            });
            requestTracker.finish(false, { endpoint: 'lock', reason: 'auth_rate_limited' });
            return createRateLimitResponse(rateLimitResult);
          }
          
          const response = await handleLockSubmit(request, env);
          const success = response.status < 400;
          if (!success) {
            logSecurityEvent('authentication_failed', {
              endpoint: 'lock_submit',
              ip: request.headers.get('CF-Connecting-IP')
            });
          }
          requestTracker.finish(success, { endpoint: 'lock', type: 'auth' });
          return createRateLimitResponse(rateLimitResult, response) || response;
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
      
      // API routes (authenticated with rate limiting)
      if (url.pathname.startsWith('/api/')) {
        // Apply API rate limiting
        let rateLimitConfig = rateLimitConfigs.api;
        if (url.pathname === '/api/search') {
          rateLimitConfig = rateLimitConfigs.search; // Stricter for search
        }
        
        const rateLimitResult = await rateLimitMiddleware(request, env, rateLimitConfig);
        if (!rateLimitResult.allowed) {
          return createRateLimitResponse(rateLimitResult);
        }
        
        let response;
        if (url.pathname === '/api/books') {
          response = await handleBooksAPI(request, env);
        } else if (url.pathname === '/api/categories') {
          response = await handleCategoriesAPI(request, env);
        } else if (url.pathname === '/api/search') {
          response = await handleSearchAPI(request, env);
        } else {
          // Books detail API
          const bookMatch = url.pathname.match(/^\/api\/books\/([^\/]+)$/);
          if (bookMatch) {
            response = await handleBookDetailAPI(request, env, bookMatch[1]);
          } else {
            // Category books API
            const categoryMatch = url.pathname.match(/^\/api\/categories\/([^\/]+)\/books$/);
            if (categoryMatch) {
              response = await handleCategoryBooksAPI(request, env, categoryMatch[1]);
            } else {
              response = new Response(JSON.stringify({ error: 'API endpoint not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
        }
        
        // Add rate limiting headers to response
        return createRateLimitResponse(rateLimitResult, response) || response;
      }
      
      // Protected routes
      if (url.pathname === '/') {
        requestTracker.finish(true, { endpoint: 'home' });
        return await handleHomePage();
      }
      
      if (url.pathname === '/books') {
        return await handleBooksPage(request, env);
      }
      
      if (url.pathname === '/admin') {
        if (method === 'GET') {
          // Apply page rate limiting
          const rateLimitResult = await rateLimitMiddleware(request, env, rateLimitConfigs.pages);
          if (!rateLimitResult.allowed) {
            return createRateLimitResponse(rateLimitResult);
          }
          
          const response = await handleAdminLogin(request, env);
          return createRateLimitResponse(rateLimitResult, response) || response;
        } else if (method === 'POST') {
          // Apply CSRF protection for POST requests
          const csrfResult = await csrfMiddleware(request, env, {
            skipPaths: [] // Don't skip admin POST for CSRF
          });
          if (!csrfResult.valid) {
            return csrfResult.response;
          }
          
          // Apply stricter auth rate limiting for admin login attempts
          const rateLimitResult = await rateLimitMiddleware(request, env, rateLimitConfigs.auth);
          if (!rateLimitResult.allowed) {
            return createRateLimitResponse(rateLimitResult);
          }
          
          const response = await handleAdminSubmit(request, env);
          return createRateLimitResponse(rateLimitResult, response) || response;
        }
      }
      
      // Admin API routes
      const adminAPIMatch = url.pathname.match(/^\/admin\/api\/(.+)$/);
      if (adminAPIMatch) {
        const endpoint = adminAPIMatch[1];
        return await handleAdminAPI(request, env, endpoint);
      }
      
      // Admin panel route (authenticated)
      const adminPanelMatch = url.pathname.match(/^\/admin\/panel\/([^\/]+)\/([^\/]+)$/);
      if (adminPanelMatch) {
        const token = adminPanelMatch[1];
        const timestamp = adminPanelMatch[2];
        return await handleAdminPanel(request, env, token, timestamp);
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
      
      // Download routes
      const downloadMatch = url.pathname.match(/^\/download\/([^\/]+)\/([^\/]+)$/);
      if (downloadMatch) {
        const [, bookSlug, format] = downloadMatch;
        requestTracker.finish(true, { endpoint: 'download', format });
        return await handleBookDownload(request, env, bookSlug, format);
      }
      
      const notFoundResponse = new Response('Not Found', { status: 404 });
      requestTracker.finish(false, { endpoint: url.pathname, reason: 'not_found' });
      return securityResponse(notFoundResponse);
      
    } catch (error) {
      requestLogger.error('Unhandled request error', {
        error: error.message,
        stack: error.stack,
        url: url.pathname,
        method: request.method
      });
      
      requestTracker.error(error, { 
        endpoint: url.pathname,
        method: request.method
      });
      
      const errorResponse = new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      return securityResponse(errorResponse);
    }
  }
};

// Home page handler moved to routes/home.js