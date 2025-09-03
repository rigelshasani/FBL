/**
 * Admin routes for password management
 */

import { generateDailyPassword } from '../auth/gate.js';
import { validatePassword } from '../utils/validation.js';
import { generateCSRFToken, injectCSRFToken } from '../middleware/csrf.js';
import { createSupabaseClient } from '../db/client.js';
import { getBooks, getCategories } from '../db/queries.js';

/**
 * Timing-safe string comparison to prevent timing attacks
 */
async function timingSafeEquals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  
  return await crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

/**
 * Generate admin password using HMAC-SHA256
 */
async function generateAdminPassword(adminSecretSeed, date = new Date()) {
  if (!adminSecretSeed) {
    throw new Error('ADMIN_SECRET_SEED is required');
  }
  
  // Get date in UTC timezone  
  const utcDate = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
  const dateString = utcDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Create HMAC-SHA256 with 'admin' prefix to make it different from user password
  const encoder = new TextEncoder();
  const keyData = encoder.encode(adminSecretSeed);
  const messageData = encoder.encode(`admin:${dateString}`);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hmac = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hmac.slice(0, 12); // 12 chars for admin (vs 8 for regular users)
}

/**
 * Handle GET /admin - Admin login screen
 */
export async function handleAdminLogin(request, env) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  
  // Generate CSRF token for the form
  const csrfToken = await generateCSRFToken(env.SECRET_SEED);
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - Cemetery of Forgotten Books</title>
  <meta name="description" content="Admin login for cemetery">
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
      text-align: center;
    }
    
    .container {
      max-width: 400px;
      padding: 3rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      font-weight: 300;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #d4af37;
    }
    
    .subtitle {
      font-size: 1rem;
      margin-bottom: 2rem;
      font-style: italic;
      color: #8B0000;
    }
    
    .form {
      margin-bottom: 2rem;
    }
    
    .form label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }
    
    .form input {
      width: 120%;
      margin-left: -10%;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #e8e8e8;
      font-size: 1rem;
      font-family: 'Courier New', monospace;
      text-align: center;
      letter-spacing: 1px;
    }
    
    .form input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
    }
    
    .form button {
      width: 120%;
      margin-left: -10%;
      padding: 1rem;
      background: rgba(139, 0, 0, 0.3);
      border: 1px solid #8B0000;
      border-radius: 4px;
      color: #e8e8e8;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 1rem;
    }
    
    .form button:hover {
      background: rgba(139, 0, 0, 0.5);
    }
    
    .error {
      color: #ff6b6b;
      font-size: 0.9rem;
      margin-top: 1rem;
      opacity: ${error ? '1' : '0'};
      transition: opacity 0.2s ease;
    }
    
    .back-link {
      color: #b8860b;
      text-decoration: none;
      font-size: 0.9rem;
      margin-top: 2rem;
      display: block;
    }
    
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Admin Access</h1>
    <p class="subtitle">Cemetery Management</p>
    
    <form class="form" method="POST" action="/admin">
      <label for="admin_password">Admin Password</label>
      <input type="password" id="admin_password" name="admin_password" required 
             placeholder="Enter admin password" maxlength="20" autocomplete="off">
      <button type="submit">Access Admin Panel</button>
      ${error ? '<div class="error">Invalid admin password. Please try again.</div>' : '<div class="error"></div>'}
    </form>
    
    <a href="/lock" class="back-link">← Back to Library</a>
  </div>
</body>
</html>`;

  // Inject CSRF token into forms
  html = injectCSRFToken(html, csrfToken);
  
  const response = new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
  
  // Set CSRF token cookie
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', 
    `csrf-token=${csrfToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800`
  );
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Handle POST /admin - Admin login submission
 */
export async function handleAdminSubmit(request, env) {
  try {
    const formData = await request.formData();
    const rawAdminPassword = formData.get('admin_password');
    
    // Validate and sanitize admin password input
    const passwordValidation = validatePassword(rawAdminPassword);
    if (!passwordValidation.valid) {
      console.warn('Invalid admin password input:', passwordValidation.error);
      return Response.redirect(new URL('/admin?error=1', request.url), 302);
    }
    
    const adminPassword = passwordValidation.value;
    
    // Generate expected admin password for today
    const expectedAdminPassword = await generateAdminPassword(env.ADMIN_SECRET_SEED);
    
    // Use timing-safe comparison to prevent timing attacks
    const isValid = await timingSafeEquals(adminPassword, expectedAdminPassword);
    if (!isValid) {
      return Response.redirect(new URL('/admin?error=1', request.url), 302);
    }
    
    // Admin password is correct - redirect to admin panel
    const timestamp = Date.now();
    const adminToken = await generateAdminToken(env.SECRET_SEED, timestamp);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/admin/panel/${adminToken}/${timestamp}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    return Response.redirect(new URL('/admin?error=1', request.url), 302);
  }
}

/**
 * Generate admin token for authenticated sessions
 */
async function generateAdminToken(secret, timestamp) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${secret}:${timestamp}:admin`);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Validate admin token
 */
async function validateAdminToken(secret, token, timestamp) {
  const now = Date.now();
  const age = now - parseInt(timestamp);
  
  // Admin token expires after 30 minutes
  if (age > 30 * 60 * 1000) {
    return false;
  }
  
  const expectedToken = await generateAdminToken(secret, timestamp);
  return token === expectedToken;
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
    
    // Fetch books and categories for management with error handling
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
    
    const html = `<!DOCTYPE html>
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
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #b8860b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 0.5rem;
    }
    
    .password-display {
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.4);
      border-radius: 4px;
      padding: 1rem;
      font-family: 'Courier New', monospace;
      font-size: 1.5rem;
      text-align: center;
      letter-spacing: 3px;
      color: #ff6b6b;
      margin: 1rem 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .info-item {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 1rem;
    }
    
    .info-item label {
      display: block;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 0.5rem;
    }
    
    .info-item value {
      font-family: 'Courier New', monospace;
      font-size: 1rem;
    }
    
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }
    
    .btn {
      padding: 0.8rem 1.5rem;
      border-radius: 4px;
      border: 1px solid;
      color: #e8e8e8;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: transparent;
      font-family: inherit;
    }
    
    .btn-primary {
      border-color: rgba(139, 0, 0, 0.4);
      background: rgba(139, 0, 0, 0.3);
    }
    
    .btn-primary:hover {
      background: rgba(139, 0, 0, 0.5);
      transform: translateY(-2px);
    }
    
    .btn-secondary {
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.1);
    }
    
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    
    .warning {
      background: rgba(255, 165, 0, 0.1);
      border: 1px solid rgba(255, 165, 0, 0.3);
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
      color: #ffab00;
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
      
      .actions {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Admin Panel</h1>
      <p class="subtitle">Cemetery Management</p>
    </header>
    
    <div class="admin-card">
      <h2>Daily Password</h2>
      
      <div class="password-display" id="user-password-display">
        ${currentPassword}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <label>User Password (8 chars)</label>
          <value>${currentPassword}</value>
        </div>
        <div class="info-item">
          <label>Admin Password (12 chars)</label>
          <value>${currentAdminPassword}</value>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <label>Date</label>
          <value>${today}</value>
        </div>
        <div class="info-item">
          <label>Timezone</label>
          <value>UTC</value>
        </div>
        <div class="info-item">
          <label>Reset Time</label>
          <value>00:00 UTC</value>
        </div>
        <div class="info-item">
          <label>Status</label>
          <value>Active</value>
        </div>
      </div>
      
      <div class="warning">
        ⚠️ Passwords automatically reset daily at midnight UTC (00:00). Share these passwords securely.
      </div>
    </div>
    
    <!-- Book Management Section -->
    <div class="admin-card">
      <h2>Book Management</h2>
      
      <div class="info-grid">
        <div class="info-item">
          <label>Total Books</label>
          <value>${books.length}</value>
        </div>
        <div class="info-item">
          <label>Categories</label>
          <value>${categories.length}</value>
        </div>
        <div class="info-item">
          <label>Database Status</label>
          <value style="color: ${books.length >= 0 && categories.length >= 0 ? '#90EE90' : '#ff6b6b'};">
            ${books.length >= 0 && categories.length >= 0 ? '✅ Connected' : '❌ Error'}
          </value>
        </div>
        <div class="info-item">
          <label>Last Updated</label>
          <value>${new Date().toLocaleTimeString()}</value>
        </div>
      </div>
      
      <!-- Add Book Form -->
      <div class="book-form" style="margin-top: 2rem;">
        <h3 style="margin-bottom: 1rem; color: #b8860b;">Add New Book</h3>
        <form id="addBookForm" style="display: grid; gap: 1rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <input type="text" id="bookTitle" placeholder="Book Title" required 
                   style="padding: 0.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #e8e8e8;">
            <input type="text" id="bookAuthor" placeholder="Author" required
                   style="padding: 0.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #e8e8e8;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <input type="number" id="bookYear" placeholder="Year" min="1000" max="9999"
                   style="padding: 0.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #e8e8e8;">
            <select id="bookLanguage" 
                    style="padding: 0.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #e8e8e8;">
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="it">Italian</option>
            </select>
          </div>
          <textarea id="bookSummary" placeholder="Book Summary" rows="3"
                    style="padding: 0.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #e8e8e8; resize: vertical;"></textarea>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; opacity: 0.8;">Categories:</label>
            ${categories.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem;">
              ${categories.map(cat => `
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" name="categories" value="${cat.slug}" style="margin: 0;">
                  <span style="font-size: 0.9rem;">${cat.name}</span>
                </label>
              `).join('')}
            </div>
            ` : `
            <p style="opacity: 0.7; font-style: italic; font-size: 0.9rem;">Categories could not be loaded. Books can be added without categories.</p>
            `}
          </div>
          <button type="submit" class="btn btn-primary" style="justify-self: start; margin-top: 1rem;">
            Add Book
          </button>
        </form>
      </div>
      
      <!-- Books List -->
      <div class="books-list" style="margin-top: 3rem;">
        <h3 style="margin-bottom: 1rem; color: #b8860b;">Current Books</h3>
        ${books.length === 0 ? 
          '<p style="opacity: 0.7; font-style: italic;">No books in the library yet. Add the first one above!</p>' :
          `<div style="display: grid; gap: 1rem;">
            ${books.map(book => `
              <div class="book-item" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: start;">
                  <div>
                    <h4 style="margin-bottom: 0.5rem; color: #e8e8e8;">${book.title}</h4>
                    <p style="color: #b8860b; margin-bottom: 0.5rem;">by ${book.author} ${book.year ? `(${book.year})` : ''}</p>
                    ${book.categories && book.categories.length > 0 ? 
                      `<p style="font-size: 0.8rem; opacity: 0.7;">Categories: ${book.category_names ? book.category_names.join(', ') : book.categories.join(', ')}</p>` : ''
                    }
                    ${book.summary ? `<p style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.8;">${book.summary.substring(0, 150)}${book.summary.length > 150 ? '...' : ''}</p>` : ''}
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <button onclick="editBook('${book.id}')" class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Edit</button>
                    <button onclick="deleteBook('${book.id}', '${book.title.replace(/'/g, "\\'")}' )" class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: #8B0000; color: #ff6b6b;">Delete</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    </div>
      
      <div class="admin-card">
        <h2>Password Management</h2>
        
        <div class="info-item">
          <label>How to Change Admin Password</label>
          <value>Set ADMIN_SECRET_SEED environment variable via wrangler secrets</value>
        </div>
        
        <div class="info-item">
          <label>How to Change User Password</label>
          <value>Set SECRET_SEED environment variable via wrangler secrets</value>
        </div>
        
        <div class="info-item">
          <label>Password Reset Schedule</label>
          <value>Daily at 00:00 UTC (automatic)</value>
        </div>
        
        <div class="info-item">
          <label>Admin Session Duration</label>
          <value>30 minutes (auto-logout)</value>
        </div>
      </div>
      
      <div class="actions">
        <button class="btn btn-primary" onclick="copyPassword()">Copy Password</button>
        <button class="btn btn-secondary" onclick="refreshPassword()">Refresh</button>
        <a href="/lock" class="btn btn-secondary">Back to Library</a>
      </div>
    </div>
  </div>
  
  <script>
    function copyPassword() {
      const password = document.getElementById('user-password-display').textContent.trim();
      navigator.clipboard.writeText(password).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = 'rgba(0, 128, 0, 0.3)';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      });
    }
    
    function refreshPassword() {
      location.reload();
    }
    
    // Book management functions
    function generateSlug(title) {
      return title.toLowerCase()
        .replace(/[^a-z0-9\\s-]/g, '')
        .replace(/\\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
    
    // Add book form submission
    document.getElementById('addBookForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = {
        title: document.getElementById('bookTitle').value.trim(),
        author: document.getElementById('bookAuthor').value.trim(),
        year: document.getElementById('bookYear').value ? parseInt(document.getElementById('bookYear').value) : null,
        language: document.getElementById('bookLanguage').value,
        summary: document.getElementById('bookSummary').value.trim(),
        categories: Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(cb => cb.value)
      };
      
      if (!formData.title || !formData.author) {
        alert('Title and Author are required');
        return;
      }
      
      formData.slug = generateSlug(formData.title);
      
      try {
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        // TODO: This would be an API call in a real implementation
        // For now, we'll show an alert and refresh
        alert('Book management API not yet implemented. Please add books directly in Supabase for now.');
        
        // Reset form
        document.getElementById('addBookForm').reset();
        
      } catch (error) {
        alert('Error adding book: ' + error.message);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
    
    function editBook(bookId) {
      // TODO: Implement book editing
      alert('Edit functionality coming soon! For now, edit books directly in Supabase.');
    }
    
    function deleteBook(bookId, title) {
      if (confirm(\`Are you sure you want to delete "\${title}"? This action cannot be undone.\`)) {
        // TODO: Implement book deletion
        alert('Delete functionality coming soon! For now, delete books directly in Supabase.');
      }
    }
    
    // Auto-refresh every 60 seconds (but less frequently due to book data)
    setInterval(() => {
      location.reload();
    }, 120000); // 2 minutes instead of 1
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Admin page error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}