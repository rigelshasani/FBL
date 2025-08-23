/**
 * Lock screen and authentication routes
 */

import { generateDailyPassword, createAuthCookie } from '../auth/gate.js';

/**
 * Generate a one-time token that expires immediately after use
 */
async function generateOneTimeToken(secret, timestamp) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${secret}:${timestamp}:onetime`);
  
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
 * Validate one-time token (expires after 10 seconds)
 */
async function validateOneTimeToken(secret, token, timestamp) {
  const now = Date.now();
  const age = now - parseInt(timestamp);
  
  // Token expires after 10 seconds
  if (age > 10000) {
    return false;
  }
  
  const expectedToken = await generateOneTimeToken(secret, timestamp);
  return token === expectedToken;
}

/**
 * Handle GET /lock - Show lock screen
 * @param {Request} request - HTTP request
 * @param {object} env - Environment variables
 * @returns {Response} Lock screen HTML
 */
export async function handleLockScreen(request, env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cemetery of Forgotten Books - Enter</title>
  <meta name="description" content="Enter the cemetery of forgotten books">
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
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      font-weight: 300;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    
    .subtitle {
      font-size: 1rem;
      margin-bottom: 3rem;
      font-style: italic;
      color: #8B0000; /* Blood red */
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
      width: 120%; /* 20% longer */
      margin-left: -10%; /* Center the longer input */
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #e8e8e8;
      font-size: 1.1rem;
      font-family: 'Courier New', monospace;
      text-align: center;
      letter-spacing: 2px;
    }
    
    .form input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
    }
    
    .form button {
      width: 120%; /* 20% longer */
      margin-left: -10%; /* Center the longer button */
      padding: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
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
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    
    .error {
      color: #ff6b6b;
      font-size: 0.9rem;
      margin-top: 1rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .error.show {
      opacity: 1;
    }
    
    .footer {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-top: 2rem;
      font-family: Georgia, serif;
      font-style: italic;
      text-align: center;
      line-height: 1.4;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>CFB</h1>
    <p class="subtitle">Cemetery of Forgotten Books</p>
    
    <form class="form" method="POST" action="/lock">
      <label for="password">Daily Password</label>
      <input type="password" id="password" name="password" required 
             placeholder="Enter today's password" maxlength="20" autocomplete="off">
      <button type="submit">Enter Library</button>
      <div class="error" id="error"></div>
    </form>
    
    <div class="footer">
      "Ego eimi"
    </div>
  </div>
  
  <script>
    const form = document.querySelector('.form');
    const error = document.getElementById('error');
    
    // Show error from URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      error.textContent = 'Invalid password. Please try again.';
      error.classList.add('show');
    }
    
    // Clear error on input
    document.getElementById('password').addEventListener('input', () => {
      error.classList.remove('show');
    });
  </script>
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
 * Handle POST /lock - Validate password and show content directly
 * STATELESS MODE: No cookies, show content immediately after validation
 * @param {Request} request - HTTP request  
 * @param {object} env - Environment variables
 * @returns {Response} Content on success, lock screen on failure
 */
export async function handleLockSubmit(request, env) {
  try {
    const formData = await request.formData();
    const password = formData.get('password')?.trim();
    
    if (!password) {
      return Response.redirect(new URL('/lock?error=1', request.url), 302);
    }
    
    // Generate expected password for today
    const expectedPassword = await generateDailyPassword(env.SECRET_SEED);
    
    if (password !== expectedPassword) {
      return Response.redirect(new URL('/lock?error=1', request.url), 302);
    }
    
    // Password is correct - redirect to a one-time view that expires immediately
    const timestamp = Date.now();
    const oneTimeToken = await generateOneTimeToken(env.SECRET_SEED, timestamp);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/view/${oneTimeToken}/${timestamp}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Lock submit error:', error);
    return Response.redirect(new URL('/lock?error=1', request.url), 302);
  }
}

/**
 * Handle one-time view with expiring token
 */
export async function handleOneTimeView(request, env, token, timestamp) {
  const isValid = await validateOneTimeToken(env.SECRET_SEED, token, timestamp);
  
  if (!isValid) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/lock?error=expired',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  return await showMainContent(request, env);
}

/**
 * Show the main cemetery content (stateless)
 */
async function showMainContent(request, env) {
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
    
    .nav-links {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }
    
    .nav-links a {
      background: rgba(139, 0, 0, 0.3);
      border: 1px solid #8B0000;
      padding: 0.8rem 1.5rem;
      border-radius: 4px;
      color: #e8e8e8;
      text-decoration: none;
      transition: all 0.2s ease;
      text-transform: uppercase;
      font-size: 0.9rem;
      letter-spacing: 1px;
    }
    
    .nav-links a:hover {
      background: rgba(139, 0, 0, 0.5);
      transform: translateY(-2px);
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
      opacity: 0.7;
      font-size: 0.85rem;
      font-family: Georgia, serif;
      font-style: italic;
      line-height: 1.4;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .quote {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(139, 0, 0, 0.1);
      border-left: 3px solid #8B0000;
      border-radius: 0 4px 4px 0;
      font-style: italic;
      opacity: 0.8;
    }
    
    .security-notice {
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.4);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 2rem;
      text-align: center;
      font-size: 0.9rem;
      color: #ff6b6b;
    }
    
    .lock-button {
      position: fixed;
      top: 2rem;
      left: 2rem;
      width: 3rem;
      height: 3rem;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: #e8e8e8;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      z-index: 1000;
    }
    
    .lock-button:hover {
      background: rgba(0, 0, 0, 0.9);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <a href="/lock" class="lock-button" title="Re-authenticate">🔒</a>
  
  <div class="container">
    <header class="header">
      <h1>CFB</h1>
      <p class="subtitle">Cemetery of Forgotten Books</p>
    </header>
    
    <div class="security-notice">
      ⚠️ STATELESS SESSION: No data persists. Refresh requires re-authentication for maximum security.
    </div>
    
    <div class="welcome">
      <h2>Welcome to the Cemetery</h2>
      <p>You have successfully entered the cemetery of forgotten books.</p>
      
      <div class="nav-links">
        <a href="/books">Browse Books</a>
        <a href="/admin">Admin Panel</a>
      </div>
      
      <div class="status-grid">
        <div class="status-card">
          <h3>Gate Status</h3>
          <p>Authenticated ✓ (Stateless)</p>
        </div>
        <div class="status-card">
          <h3>Catalog</h3>
          <p id="book-count">Loading...</p>
        </div>
        <div class="status-card">
          <h3>Search</h3>
          <p>Ready for queries</p>
        </div>
        <div class="status-card">
          <h3>Security</h3>
          <p>Maximum (No persistence)</p>
        </div>
      </div>
      
      <div class="quote">
        "Blessed is the lion which becomes man when consumed by man; and cursed is the man whom the lion consumes, and the lion becomes man."
      </div>
    </div>
    
  </div>
  
  <script>
    // Prevent caching and auto-expire
    if (performance.navigation.type === 1) {
      // Page was refreshed - immediately redirect to lock
      window.location.href = '/lock';
    }
    
    // Auto-expire after 30 seconds
    setTimeout(() => {
      window.location.href = '/lock';
    }, 30000);
    
    // Load book count from API
    fetch('/api/books?limit=1')
      .then(response => response.json())
      .then(data => {
        const count = data.pagination?.total || 0;
        const bookCountEl = document.getElementById('book-count');
        bookCountEl.textContent = count === 0 ? 'Empty cemetery' : count + ' books interred';
      })
      .catch(error => {
        console.error('Failed to load book count:', error);
        document.getElementById('book-count').textContent = 'Unknown';
      });
      
    // Prevent back button caching
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        window.location.href = '/lock';
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Frame-Options': 'DENY',
      'Vary': '*'
    }
  });
}