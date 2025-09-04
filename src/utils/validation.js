/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize string input by removing/escaping dangerous characters
 */
export function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Trim whitespace and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize Unicode
  sanitized = sanitized.normalize('NFC');
  
  return sanitized;
}

/**
 * Validate password input
 */
export function validatePassword(password) {
  const sanitized = sanitizeString(password, 50);
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (sanitized.length < 3) {
    return { valid: false, error: 'Password too short' };
  }
  
  if (sanitized.length > 50) {
    return { valid: false, error: 'Password too long' };
  }
  
  // Only allow alphanumeric and basic special characters
  if (!/^[a-zA-Z0-9\-_\.@#$%&*+!?]+$/.test(sanitized)) {
    return { valid: false, error: 'Password contains invalid characters' };
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Validate search query
 */
export function validateSearchQuery(query) {
  const sanitized = sanitizeString(query, 200);
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Search query is required' };
  }
  
  if (sanitized.length < 2) {
    return { valid: false, error: 'Search query too short' };
  }
  
  // Allow letters, numbers, spaces, and basic punctuation
  if (!/^[a-zA-Z0-9\s\-_\.,'":;!?\(\)]+$/.test(sanitized)) {
    return { valid: false, error: 'Search query contains invalid characters' };
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Validate category name/slug
 */
export function validateCategory(category) {
  const sanitized = sanitizeString(category, 100);
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Category is required' };
  }
  
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9\-_]+$/.test(sanitized)) {
    return { valid: false, error: 'Category contains invalid characters' };
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Validate book slug
 */
export function validateBookSlug(slug) {
  const sanitized = sanitizeString(slug, 200);
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Book slug is required' };
  }
  
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9\-_]+$/.test(sanitized)) {
    return { valid: false, error: 'Book slug contains invalid characters' };
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(limit, offset) {
  const errors = [];
  let validLimit = 20; // default
  let validOffset = 0; // default
  
  if (limit !== undefined) {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      errors.push('Limit must be between 1 and 100');
    } else {
      validLimit = parsed;
    }
  }
  
  if (offset !== undefined) {
    const parsed = parseInt(offset, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 10000) {
      errors.push('Offset must be between 0 and 10000');
    } else {
      validOffset = parsed;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    limit: validLimit,
    offset: validOffset
  };
}

/**
 * Validate content type for uploads
 */
export function validateContentType(contentType, allowedTypes = ['text/plain', 'application/json']) {
  if (!contentType || typeof contentType !== 'string') {
    return { valid: false, error: 'Content type is required' };
  }
  
  const normalized = contentType.toLowerCase().split(';')[0].trim();
  
  if (!allowedTypes.includes(normalized)) {
    return { valid: false, error: `Content type ${normalized} not allowed` };
  }
  
  return { valid: true, value: normalized };
}

/**
 * Validate review content
 */
export function validateReview(stars, body) {
  const errors = [];
  
  // Validate stars
  const starsNum = parseInt(stars, 10);
  if (isNaN(starsNum) || starsNum < 1 || starsNum > 5) {
    errors.push('Stars must be between 1 and 5');
  }
  
  // Validate body
  if (!body || typeof body !== 'string') {
    errors.push('Review body is required');
  } else {
    const sanitizedBody = sanitizeString(body, 2000);
    if (sanitizedBody.length < 10) {
      errors.push('Review must be at least 10 characters');
    }
    if (sanitizedBody.length > 2000) {
      errors.push('Review must be less than 2000 characters');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    stars: starsNum,
    body: body ? sanitizeString(body, 2000) : ''
  };
}

/**
 * Validate IP hash format
 */
export function validateIPHash(ipHash) {
  if (!ipHash || typeof ipHash !== 'string') {
    return { valid: false, error: 'IP hash is required' };
  }
  
  // Should be hex string from SHA-256 (64 chars) or truncated (16 chars)
  if (!/^[a-f0-9]{16,64}$/i.test(ipHash)) {
    return { valid: false, error: 'Invalid IP hash format' };
  }
  
  return { valid: true, value: ipHash.toLowerCase() };
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(requests, windowMs = 60000, maxRequests = 100) {
  if (!Array.isArray(requests)) {
    return { valid: true, remaining: maxRequests };
  }
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Filter requests within the time window
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...recentRequests);
    const resetTime = oldestRequest + windowMs;
    
    return {
      valid: false,
      error: 'Rate limit exceeded',
      resetTime,
      remaining: 0
    };
  }
  
  return {
    valid: true,
    remaining: maxRequests - recentRequests.length
  };
}

/**
 * Sanitize URL parameters
 */
export function sanitizeURLParams(params) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(params)) {
    const cleanKey = sanitizeString(key, 50);
    const cleanValue = sanitizeString(value, 500);
    
    if (cleanKey && cleanValue) {
      sanitized[cleanKey] = cleanValue;
    }
  }
  
  return sanitized;
}