/**
 * Home page route handler
 */

import { AUTH } from '../config/constants.js';

/**
 * Handle authenticated home page - Cemetery entrance
 */
export async function handleHomePage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cemetery of Forgotten Books</title>
  <meta name="description" content="Welcome to the Cemetery of Forgotten Books - A digital sanctuary for lost literature">
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
      overflow: hidden;
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
    
    .container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      position: relative;
    }
    
    .cemetery-entrance {
      max-width: 800px;
      margin: 0 auto;
      animation: fadeIn 2s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .title {
      font-size: 4rem;
      font-weight: 300;
      margin-bottom: 1rem;
      letter-spacing: 3px;
      background: linear-gradient(135deg, #d4af37, #b8860b);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
    }
    
    .subtitle {
      font-size: 1.5rem;
      color: #8B0000;
      margin-bottom: 3rem;
      font-style: italic;
      letter-spacing: 1px;
    }
    
    .description {
      font-size: 1.2rem;
      line-height: 1.8;
      margin-bottom: 3rem;
      color: #cccccc;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .entrance-gates {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin-top: 3rem;
      flex-wrap: wrap;
    }
    
    .gate {
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(139, 0, 0, 0.3);
      border-radius: 12px;
      padding: 2rem;
      width: 250px;
      text-decoration: none;
      color: inherit;
      transition: all 0.3s ease;
      cursor: pointer;
      backdrop-filter: blur(10px);
    }
    
    .gate:hover {
      border-color: rgba(139, 0, 0, 0.8);
      background: rgba(139, 0, 0, 0.1);
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(139, 0, 0, 0.2);
    }
    
    .gate-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      display: block;
    }
    
    .gate-title {
      font-size: 1.3rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
      color: #d4af37;
    }
    
    .gate-description {
      font-size: 0.9rem;
      color: #aaaaaa;
      line-height: 1.4;
    }
    
    .footer {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.8rem;
      color: #666666;
      text-align: center;
    }
    
    .warning {
      background: rgba(139, 0, 0, 0.1);
      border: 1px solid rgba(139, 0, 0, 0.3);
      border-radius: 8px;
      padding: 1rem;
      margin: 2rem 0;
      font-size: 0.9rem;
      color: #ff9999;
    }
    
    @media (max-width: 768px) {
      .title {
        font-size: 2.5rem;
      }
      
      .entrance-gates {
        gap: 1.5rem;
      }
      
      .gate {
        width: 200px;
        padding: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <a href="/lock" class="lock-button" title="Re-authenticate">🔒</a>
  
  <div class="container">
    <div class="cemetery-entrance">
      <h1 class="title">Cemetery of Forgotten Books</h1>
      <p class="subtitle">Where Lost Literature Lives On</p>
      
      <div class="description">
        Welcome, keeper of forgotten words. You stand at the threshold of a digital sanctuary 
        where books that time has forgotten find their eternal rest. Here, literature 
        transcends mortality, preserved for those brave enough to seek knowledge in the shadows.
      </div>
      
      <div class="warning">
        ⚠️ This session will expire automatically. The cemetery keeps its own time.
      </div>
      
      <div class="entrance-gates">
        <a href="/books" class="gate">
          <span class="gate-icon">📚</span>
          <div class="gate-title">The Stacks</div>
          <div class="gate-description">Browse the collection of forgotten volumes, organized by the spirits who tend them</div>
        </a>
        
        <a href="/books?category=gothic" class="gate">
          <span class="gate-icon">🏰</span>
          <div class="gate-title">Gothic Crypt</div>
          <div class="gate-description">Dark romantic tales and mysterious literature from literature's shadow realm</div>
        </a>
        
        <a href="/admin" class="gate">
          <span class="gate-icon">🔮</span>
          <div class="gate-title">Keeper's Sanctum</div>
          <div class="gate-description">For those who tend the cemetery and guard its ancient secrets</div>
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>Remember: What is read cannot be unread. What is forgotten can be found.</p>
      <p style="margin-top: 0.5rem; font-size: 0.7rem;">Session expires automatically for your protection</p>
    </div>
  </div>
  
  <script>
    // Prevent caching and enforce re-authentication
    if (performance.navigation.type === 1) {
      window.location.href = '/lock';
    }
    
    // Auto-expire session after configured time on home page
    setTimeout(() => {
      window.location.href = '/lock';
    }, ${AUTH.SESSION_AUTO_EXPIRE});
    
    // Prevent back button caching
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        window.location.href = '/lock';
      }
    });
    
    // Add some atmospheric effects
    function createParticle() {
      const particle = document.createElement('div');
      particle.style.position = 'fixed';
      particle.style.width = '2px';
      particle.style.height = '2px';
      particle.style.background = 'rgba(212, 175, 55, 0.3)';
      particle.style.borderRadius = '50%';
      particle.style.pointerEvents = 'none';
      particle.style.left = Math.random() * 100 + 'vw';
      particle.style.top = '-5px';
      particle.style.zIndex = '1';
      
      document.body.appendChild(particle);
      
      const duration = Math.random() * 3000 + 2000;
      const drift = (Math.random() - 0.5) * 100;
      
      particle.animate([
        { transform: 'translateY(0) translateX(0)', opacity: 0 },
        { transform: 'translateY(50vh) translateX(' + drift + 'px)', opacity: 1 },
        { transform: 'translateY(100vh) translateX(' + (drift * 2) + 'px)', opacity: 0 }
      ], {
        duration: duration,
        easing: 'linear'
      }).onfinish = () => particle.remove();
    }
    
    // Occasional particle effects
    setInterval(createParticle, 3000);
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