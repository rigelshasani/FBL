/**
 * Security Headers Middleware
 * Implements comprehensive security headers for bulletproof protection
 */

/**
 * Default security headers configuration
 */
export const securityHeadersConfig = {
  // Content Security Policy - strict policy
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"], // Allow inline scripts for our pages
    'style-src': ["'self'", "'unsafe-inline'"], // Allow inline styles for our pages
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"], // Prevent embedding
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'upgrade-insecure-requests': true
  },
  
  // X-Frame-Options - prevent clickjacking
  frameOptions: 'DENY',
  
  // X-Content-Type-Options - prevent MIME sniffing
  contentTypeOptions: 'nosniff',
  
  // X-XSS-Protection - enable XSS filtering
  xssProtection: '1; mode=block',
  
  // Referrer Policy - control referrer information
  referrerPolicy: 'strict-origin-when-cross-origin',
  
  // Permissions Policy - control browser features
  permissionsPolicy: {
    'camera': [],
    'microphone': [],
    'geolocation': [],
    'clipboard-write': ["'self'"],
    'clipboard-read': ["'self'"],
    'payment': [],
    'usb': [],
    'bluetooth': []
  },
  
  // Strict Transport Security - enforce HTTPS
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  
  // Cross-Origin policies
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin'
};

/**
 * Generate Content Security Policy header value
 */
function buildCSP(cspConfig) {
  const directives = [];
  
  for (const [directive, sources] of Object.entries(cspConfig)) {
    if (directive === 'upgrade-insecure-requests' && sources === true) {
      directives.push('upgrade-insecure-requests');
    } else if (Array.isArray(sources)) {
      directives.push(`${directive} ${sources.join(' ')}`);
    }
  }
  
  return directives.join('; ');
}

/**
 * Generate Permissions Policy header value
 */
function buildPermissionsPolicy(permissionsConfig) {
  const policies = [];
  
  for (const [feature, allowlist] of Object.entries(permissionsConfig)) {
    if (allowlist.length === 0) {
      policies.push(`${feature}=()`);
    } else {
      policies.push(`${feature}=(${allowlist.join(' ')})`);
    }
  }
  
  return policies.join(', ');
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response, options = {}) {
  const config = { ...securityHeadersConfig, ...options };
  const headers = new Headers(response.headers);
  
  // Content Security Policy
  if (config.contentSecurityPolicy) {
    const cspValue = buildCSP(config.contentSecurityPolicy);
    headers.set('Content-Security-Policy', cspValue);
  }
  
  // X-Frame-Options
  if (config.frameOptions) {
    headers.set('X-Frame-Options', config.frameOptions);
  }
  
  // X-Content-Type-Options
  if (config.contentTypeOptions) {
    headers.set('X-Content-Type-Options', config.contentTypeOptions);
  }
  
  // X-XSS-Protection
  if (config.xssProtection) {
    headers.set('X-XSS-Protection', config.xssProtection);
  }
  
  // Referrer Policy
  if (config.referrerPolicy) {
    headers.set('Referrer-Policy', config.referrerPolicy);
  }
  
  // Permissions Policy
  if (config.permissionsPolicy) {
    const permissionsValue = buildPermissionsPolicy(config.permissionsPolicy);
    headers.set('Permissions-Policy', permissionsValue);
  }
  
  // Strict Transport Security
  if (config.strictTransportSecurity) {
    headers.set('Strict-Transport-Security', config.strictTransportSecurity);
  }
  
  // Cross-Origin Embedder Policy
  if (config.crossOriginEmbedderPolicy) {
    headers.set('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
  }
  
  // Cross-Origin Opener Policy
  if (config.crossOriginOpenerPolicy) {
    headers.set('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
  }
  
  // Cross-Origin Resource Policy
  if (config.crossOriginResourcePolicy) {
    headers.set('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
  }
  
  // Additional security headers
  headers.set('X-DNS-Prefetch-Control', 'off');
  headers.set('X-Download-Options', 'noopen');
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Remove server information
  headers.delete('Server');
  headers.delete('X-Powered-By');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Specific security header configurations for different content types
 */
export const securityConfigs = {
  // HTML pages - full security headers
  html: {
    ...securityHeadersConfig,
    contentSecurityPolicy: {
      ...securityHeadersConfig.contentSecurityPolicy,
      'script-src': ["'self'", "'unsafe-inline'"], // Allow inline scripts for functionality
      'style-src': ["'self'", "'unsafe-inline'"], // Allow inline styles
    }
  },
  
  // API endpoints - stricter policy
  api: {
    ...securityHeadersConfig,
    contentSecurityPolicy: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"]
    },
    crossOriginEmbedderPolicy: undefined, // May interfere with API responses
    crossOriginOpenerPolicy: undefined
  },
  
  // Static assets - minimal headers
  static: {
    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    crossOriginResourcePolicy: 'same-origin',
    strictTransportSecurity: securityHeadersConfig.strictTransportSecurity
  }
};

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(response, contentType = 'html') {
  const config = securityConfigs[contentType] || securityConfigs.html;
  return applySecurityHeaders(response, config);
}

/**
 * Check if request is from a trusted origin (for CORS if needed)
 */
export function isTrustedOrigin(origin, trustedOrigins = []) {
  if (!origin) return false;
  
  // Allow same origin
  if (trustedOrigins.includes(origin)) return true;
  
  // For development, allow localhost
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  
  return false;
}

/**
 * Apply security headers for different response types
 */
export function securityResponse(originalResponse) {
  const contentType = originalResponse.headers.get('Content-Type') || '';
  
  let configType = 'html';
  if (contentType.includes('application/json')) {
    configType = 'api';
  } else if (contentType.includes('text/css') || contentType.includes('application/javascript')) {
    configType = 'static';
  }
  
  return securityHeadersMiddleware(originalResponse, configType);
}