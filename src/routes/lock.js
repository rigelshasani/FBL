/**
 * Lock screen and authentication routes
 */

import { generateDailyPassword, createAuthCookie } from '../auth/gate.js';

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
  <title>FBL Gothic Library - Enter</title>
  <meta name="description" content="Enter the gothic digital library">
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
      opacity: 0.7;
      margin-bottom: 3rem;
      font-style: italic;
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
      width: 100%;
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
      width: 100%;
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
      opacity: 0.5;
      margin-top: 2rem;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FBL</h1>
    <p class="subtitle">Gothic Digital Library</p>
    
    <form class="form" method="POST" action="/lock">
      <label for="password">Daily Password</label>
      <input type="password" id="password" name="password" required 
             placeholder="Enter today's password" maxlength="20" autocomplete="off">
      <button type="submit">Enter Library</button>
      <div class="error" id="error"></div>
    </form>
    
    <div class="footer">
      Password resets at midnight (Europe/Tirane)
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
 * Handle POST /lock - Validate password and set cookie
 * @param {Request} request - HTTP request  
 * @param {object} env - Environment variables
 * @returns {Response} Redirect on success, lock screen on failure
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
    
    // Create auth cookie
    const cookieHeader = await createAuthCookie(password);
    
    // Redirect to home page with auth cookie
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': cookieHeader,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Lock submit error:', error);
    return Response.redirect(new URL('/lock?error=1', request.url), 302);
  }
}