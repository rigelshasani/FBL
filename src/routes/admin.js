/**
 * Admin routes for password management
 */

import { generateDailyPassword } from '../auth/gate.js';

/**
 * Handle GET /admin - Admin panel to view daily password
 */
export async function handleAdminPage(request, env) {
  try {
    const currentPassword = await generateDailyPassword(env.SECRET_SEED);
    const today = new Date().toISOString().split('T')[0];
    
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
      
      <div class="password-display" id="password-display">
        ${currentPassword}
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
        ⚠️ Password automatically resets at midnight UTC. Share this password securely.
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
      const password = document.getElementById('password-display').textContent.trim();
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
    
    // Auto-refresh every 60 seconds
    setInterval(() => {
      location.reload();
    }, 60000);
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