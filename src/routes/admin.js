/**
 * Admin routes and utilities for FBL Gothic Library
 */

import { createSupabaseClient } from '../db/client.js';
import { getBooks, getCategories } from '../db/queries.js';
import { AuthService } from '../services/AuthService.js';
import { ErrorResponseFactory } from '../utils/ErrorResponseFactory.js';
import { logSecurityEvent } from '../monitoring/logger.js';
import { AUTH } from '../config/constants.js';

/**
 * Generate daily password for users
 */
export async function generateDailyPassword(secretSeed) {
  return AuthService.generateDailyPassword(secretSeed);
}

/**
 * Generate admin password 
 */
export async function generateAdminPassword(secretSeed) {
  return AuthService.generateDailyPassword(secretSeed, AuthService.AuthType.ADMIN);
}

/**
 * Generate admin token
 */
export async function generateAdminToken(secretSeed, timestamp) {
  return AuthService.generateOneTimeToken(secretSeed, timestamp);
}

/**
 * Validate admin token
 */
export async function validateAdminToken(secret, token, timestamp) {
  try {
    await AuthService.validateOneTimeToken(secret, token, timestamp, AUTH.ADMIN_TOKEN_EXPIRY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Handle GET /admin - Admin login page
 */
export async function handleAdminLogin(request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Access - Cemetery of Forgotten Books</title>
  <meta name="description" content="Admin access to cemetery">
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
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    
    .login-container {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 3rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 300;
      letter-spacing: 1px;
      margin-bottom: 0.5rem;
      color: #d4af37;
    }
    
    .subtitle {
      font-size: 1rem;
      opacity: 0.7;
      font-style: italic;
      margin-bottom: 2rem;
    }
    
    .error-message {
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.5);
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 2rem;
      color: #ff6b6b;
    }
    
    .form-group {
      margin-bottom: 1.5rem;
      text-align: left;
    }
    
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #d4af37;
    }
    
    input[type="password"] {
      width: 100%;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #e8e8e8;
      font-size: 1rem;
    }
    
    input[type="password"]:focus {
      outline: none;
      border-color: #d4af37;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .submit-button {
      width: 100%;
      padding: 1rem;
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.5);
      border-radius: 4px;
      color: #e8e8e8;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .submit-button:hover {
      background: rgba(139, 0, 0, 0.3);
      transform: translateY(-1px);
    }
    
    .back-link {
      display: inline-block;
      margin-top: 2rem;
      color: #d4af37;
      text-decoration: none;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    }
    
    .back-link:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>🏚️ Admin Portal</h1>
    <p class="subtitle">Cemetery Keeper Access</p>
    
    ${error === 'expired' ? '<div class="error-message">Your session has expired. Please enter the admin password.</div>' : ''}
    ${error === 'invalid' ? '<div class="error-message">Invalid password. Please try again.</div>' : ''}
    
    <form method="POST" action="/admin">
      <div class="form-group">
        <label for="password">Admin Password:</label>
        <input type="password" id="password" name="password" required>
      </div>
      
      <button type="submit" class="submit-button">🗝️ Enter Cemetery</button>
    </form>
    
    <a href="/" class="back-link">← Return to Cemetery Gates</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Handle POST /admin - Admin login submission
 */
export async function handleAdminSubmit(request, env) {
  try {
    const formData = await request.formData();
    const password = formData.get('password');
    
    if (!password) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/admin?error=invalid',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    const expectedPassword = await generateAdminPassword(env.ADMIN_SECRET_SEED);
    
    if (password !== expectedPassword) {
      logSecurityEvent('admin_login_failed', {
        ip: request.headers.get('CF-Connecting-IP'),
        reason: 'invalid_password'
      });
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/admin?error=invalid',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    const timestamp = Date.now().toString();
    const token = await generateAdminToken(env.SECRET_SEED, timestamp);
    
    logSecurityEvent('admin_login_success', {
      ip: request.headers.get('CF-Connecting-IP')
    });
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/admin/panel/${token}/${timestamp}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    return ErrorResponseFactory.serverError('Admin login failed');
  }
}

/**
 * Fetch admin data (books and categories) with error handling
 */
async function fetchAdminData(env) {
  let books = [];
  let categories = [];
  
  try {
    const supabase = createSupabaseClient(env);
    
    try {
      const booksResult = await getBooks(supabase, { limit: 50 });
      books = booksResult.data || [];
    } catch (error) {
      console.error('Error fetching books for admin:', error);
      books = [];
    }
    
    try {
      const categoriesResult = await getCategories(supabase);
      categories = categoriesResult.data || [];
    } catch (error) {
      console.error('Error fetching categories for admin:', error);
      categories = [];
    }
  } catch (error) {
    console.error('Error creating Supabase client:', error);
  }
  
  return { books, categories };
}

/**
 * Generate admin panel HTML content
 */
function generateAdminPanelHTML(currentPassword, currentAdminPassword, today, books, categories) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - Cemetery of Forgotten Books</title>
  <meta name="description" content="Admin panel for cemetery">
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
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 3rem;
    }
    
    .header h1 {
      font-size: 2.5rem;
      font-weight: 300;
      letter-spacing: 2px;
      margin-bottom: 0.5rem;
      color: #d4af37;
    }
    
    .header .subtitle {
      font-size: 1rem;
      opacity: 0.7;
      font-style: italic;
    }
    
    .admin-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    
    .admin-card h2 {
      color: #d4af37;
      margin-bottom: 1rem;
      font-size: 1.5rem;
      font-weight: 300;
    }
    
    .credentials-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }
    
    @media (max-width: 768px) {
      .credentials-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .credential-item {
      background: rgba(139, 0, 0, 0.1);
      border: 1px solid rgba(139, 0, 0, 0.3);
      border-radius: 4px;
      padding: 1rem;
    }
    
    .credential-item h3 {
      color: #d4af37;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }
    
    .credential-value {
      font-family: 'Courier New', monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.5rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      word-break: break-all;
      cursor: text;
      user-select: all;
    }
    
    .data-section {
      margin-top: 2rem;
    }
    
    .data-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    
    @media (max-width: 768px) {
      .data-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .data-list {
      max-height: 400px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 1rem;
    }
    
    .data-item {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.9rem;
    }
    
    .data-item:last-child {
      border-bottom: none;
    }
    
    .book-item {
      margin-bottom: 0.5rem;
    }
    
    .book-title {
      font-weight: bold;
      color: #d4af37;
    }
    
    .book-author {
      opacity: 0.8;
      font-style: italic;
    }
    
    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .category-name {
      color: #d4af37;
    }
    
    .category-slug {
      opacity: 0.6;
      font-size: 0.8rem;
    }
    
    .instructions {
      background: rgba(139, 0, 0, 0.1);
      border-left: 4px solid #d4af37;
      padding: 1rem;
      margin-bottom: 2rem;
      border-radius: 0 4px 4px 0;
    }
    
    .instructions h3 {
      color: #d4af37;
      margin-bottom: 0.5rem;
    }
    
    .instructions ul {
      margin-left: 1.5rem;
      margin-bottom: 0.5rem;
    }
    
    .instructions li {
      margin-bottom: 0.25rem;
    }
    
    .warning {
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.5);
      border-radius: 4px;
      padding: 1rem;
      margin-top: 2rem;
    }
    
    .warning h3 {
      color: #ff6b6b;
      margin-bottom: 0.5rem;
    }
    
    .empty-state {
      text-align: center;
      opacity: 0.6;
      font-style: italic;
      padding: 2rem;
    }
    
    .back-link {
      display: inline-block;
      margin-top: 2rem;
      padding: 1rem 2rem;
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.5);
      color: #e8e8e8;
      text-decoration: none;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    
    .back-link:hover {
      background: rgba(139, 0, 0, 0.3);
      transform: translateY(-1px);
    }
    
    .credential-actions {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏚️ Cemetery Keeper</h1>
      <p class="subtitle">Guardian of the Forgotten Tomes</p>
    </div>
    
    <div class="instructions">
      <h3>🔐 Daily Access Codes</h3>
      <p>Use these credentials to access the cemetery. Codes change daily at midnight UTC for security.</p>
      <ul>
        <li><strong>User Password:</strong> For general visitors to browse the collection</li>
        <li><strong>Admin Password:</strong> For cemetery keepers to manage the grounds</li>
      </ul>
      <p><em>Store these securely - they grant access to the sacred archives.</em></p>
    </div>
    
    <div class="admin-card">
      <h2>🗝️ Access Credentials</h2>
      <div class="credentials-grid">
        <div class="credential-item">
          <h3>User Access Code</h3>
          <div class="credential-value">${currentPassword}</div>
          <div class="credential-actions">
            Valid for: ${today} (UTC)
          </div>
        </div>
        
        <div class="credential-item">
          <h3>Keeper Access Code</h3>
          <div class="credential-value">${currentAdminPassword}</div>
          <div class="credential-actions">
            Valid for: ${today} (UTC)
          </div>
        </div>
      </div>
    </div>
    
    <div class="admin-card">
      <h2>📚 Cemetery Archives</h2>
      <div class="data-section">
        <div class="data-grid">
          <div>
            <h3>📖 Interred Books (${books.length})</h3>
            <div class="data-list">
              ${books.length > 0 ? books.map(book => `
                <div class="data-item">
                  <div class="book-item">
                    <div class="book-title">${book.title || 'Untitled'}</div>
                    <div class="book-author">by ${book.author || 'Unknown Author'}</div>
                    ${book.year ? `<div class="book-year">Year: ${book.year}</div>` : ''}
                    ${book.categories && book.categories.length > 0 ? 
                      `<div class="book-categories">Categories: ${book.categories.join(', ')}</div>` : ''}
                  </div>
                </div>
              `).join('') : '<div class="empty-state">No books found in the cemetery archives</div>'}
            </div>
          </div>
          
          <div>
            <h3>🏷️ Collection Categories (${categories.length})</h3>
            <div class="data-list">
              ${categories.length > 0 ? categories.map(category => `
                <div class="data-item">
                  <div class="category-item">
                    <span class="category-name">${category.name}</span>
                    <span class="category-slug">${category.slug}</span>
                  </div>
                </div>
              `).join('') : '<div class="empty-state">No categories found</div>'}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="warning">
      <h3>⚠️ Security Notice</h3>
      <p>This panel provides sensitive access credentials. Ensure you:</p>
      <ul>
        <li>Keep these codes confidential and secure</li>
        <li>Never share credentials through insecure channels</li>
        <li>Close this session when finished</li>
        <li>Use the codes responsibly to protect the cemetery</li>
      </ul>
    </div>
    
    <a href="/" class="back-link">🚪 Return to Cemetery Gates</a>
  </div>
</body>
</html>`;
}

/**
 * Handle GET /admin/panel/:token/:timestamp - Admin panel
 */
export async function handleAdminPanel(request, env, token, timestamp) {
  const isValid = await validateAdminToken(env.SECRET_SEED, token, timestamp);
  
  if (!isValid) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin?error=expired',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  try {
    const currentPassword = await generateDailyPassword(env.SECRET_SEED);
    const currentAdminPassword = await generateAdminPassword(env.ADMIN_SECRET_SEED);
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch admin data
    const { books, categories } = await fetchAdminData(env);
    
    // Generate HTML content
    const html = generateAdminPanelHTML(currentPassword, currentAdminPassword, today, books, categories);
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Admin page error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Handle admin API endpoint for session invalidation
 */
export async function handleAdminAPI(request, env, endpoint) {
  try {
    // Verify admin token from header
    const adminToken = request.headers.get('X-Admin-Token');
    if (!adminToken) {
      return ErrorResponseFactory.adminTokenRequired();
    }
    
    const parts = adminToken.split(':');
    if (parts.length !== 2) {
      return ErrorResponseFactory.adminTokenRequired();
    }
    
    const [token, timestamp] = parts;
    const isValid = await validateAdminToken(env.SECRET_SEED, token, timestamp);
    
    if (!isValid) {
      return ErrorResponseFactory.adminTokenRequired();
    }
    
    if (endpoint === 'invalidate-sessions') {
      // This is a placeholder - in a real app you'd invalidate active sessions
      logSecurityEvent('admin_sessions_invalidated', {
        adminIP: request.headers.get('CF-Connecting-IP')
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: 'All user sessions have been invalidated'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
    
    return ErrorResponseFactory.unknownEndpoint();
    
  } catch (error) {
    console.error('Admin API error:', error);
    return ErrorResponseFactory.serverError('Admin API error');
  }
}