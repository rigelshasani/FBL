/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern with HMAC verification
 */

/**
 * Generate CSRF token
 */
export async function generateCSRFToken(secret) {
  const timestamp = Date.now().toString();
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}:${randomHex}`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
  
  return `${timestamp}.${randomHex}.${signatureHex}`;
}

/**
 * Verify CSRF token
 */
export async function verifyCSRFToken(token, secret) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    
    const [timestamp, randomHex, signature] = parts;
    
    // Check if token is not too old (30 minutes max)
    const now = Date.now();
    const tokenTime = parseInt(timestamp);
    if (now - tokenTime > 30 * 60 * 1000) {
      return false;
    }
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${timestamp}:${randomHex}`);
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, data);
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
    
    // Use timing-safe comparison
    const signatureBytes = new TextEncoder().encode(signature);
    const expectedBytes = new TextEncoder().encode(expectedHex);
    
    if (signatureBytes.length !== expectedBytes.length) {
      return false;
    }
    
    return await crypto.subtle.timingSafeEqual(signatureBytes, expectedBytes);
    
  } catch (error) {
    console.error('CSRF token verification error:', error);
    return false;
  }
}

/**
 * Extract CSRF token from request
 */
function extractCSRFToken(request) {
  // Check header first
  let token = request.headers.get('X-CSRF-Token');
  if (token) return token;
  
  // Check cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    token = cookies['csrf-token'];
    if (token) return token;
  }
  
  return null;
}

/**
 * Extract CSRF token from form data
 */
async function extractCSRFTokenFromForm(request) {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('application/x-www-form-urlencoded') && 
        !contentType.includes('multipart/form-data')) {
      return null;
    }
    
    const formData = await request.formData();
    return formData.get('csrf-token');
  } catch (error) {
    return null;
  }
}

/**
 * CSRF protection middleware
 */
export async function csrfMiddleware(request, env, options = {}) {
  const {
    cookieName = 'csrf-token',
    headerName = 'X-CSRF-Token',
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    skipPaths = ['/health', '/lock', '/admin'],
  } = options;
  
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  
  // Skip CSRF protection for safe methods and certain paths
  if (skipMethods.includes(method) || skipPaths.includes(url.pathname)) {
    return { valid: true };
  }
  
  try {
    // For state-changing requests, verify CSRF token
    let token = extractCSRFToken(request);
    
    // If not in header/cookie, check form data
    if (!token && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const clonedRequest = request.clone();
      token = await extractCSRFTokenFromForm(clonedRequest);
    }
    
    if (!token) {
      return {
        valid: false,
        error: 'CSRF token missing',
        response: new Response(JSON.stringify({
          error: 'CSRF token missing',
          message: 'Request must include CSRF token'
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        })
      };
    }
    
    const isValid = await verifyCSRFToken(token, env.SECRET_SEED);
    if (!isValid) {
      return {
        valid: false,
        error: 'Invalid CSRF token',
        response: new Response(JSON.stringify({
          error: 'Invalid CSRF token',
          message: 'CSRF token is invalid or expired'
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        })
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('CSRF middleware error:', error);
    return {
      valid: false,
      error: 'CSRF validation failed',
      response: new Response(JSON.stringify({
        error: 'CSRF validation failed',
        message: 'Unable to validate request'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    };
  }
}

/**
 * Generate CSRF token and set cookie
 */
export async function setCSRFToken(response, secret) {
  try {
    const token = await generateCSRFToken(secret);
    
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', 
      `csrf-token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800`
    );
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    console.error('Error setting CSRF token:', error);
    return response;
  }
}

/**
 * Inject CSRF token into HTML forms
 */
export function injectCSRFToken(html, token) {
  if (!html || !token) return html;
  
  // Find all forms and add hidden CSRF input
  return html.replace(
    /<form([^>]*method\s*=\s*["']?(POST|PUT|PATCH|DELETE)["']?[^>]*)>/gi,
    (match, formAttributes) => {
      return `${match}\n  <input type="hidden" name="csrf-token" value="${token}">`;
    }
  );
}