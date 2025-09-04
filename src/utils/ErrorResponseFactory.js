/**
 * Standardized Error Response Factory
 * Eliminates error handling duplication and provides consistent error responses
 */

/**
 * Standard HTTP error codes used throughout the application
 */
export const ErrorCode = {
  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  
  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Application-specific error types
 */
export const AppErrorType = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ADMIN_TOKEN_REQUIRED: 'ADMIN_TOKEN_REQUIRED',
  CSRF_VALIDATION_FAILED: 'CSRF_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  UNKNOWN_ENDPOINT: 'UNKNOWN_ENDPOINT',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE'
};

/**
 * Error Response Factory for consistent error handling
 */
export class ErrorResponseFactory {
  /**
   * Create a standard JSON error response
   * @private
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} type - Application error type
   * @param {Object} details - Additional error details
   * @param {Object} metadata - Extra metadata (offline, etc.)
   * @returns {Response} JSON error response
   */
  static #createJsonResponse(message, status, type, details = null, metadata = {}) {
    const errorBody = {
      error: message,
      code: type,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    if (details) {
      errorBody.details = details;
    }
    
    return new Response(JSON.stringify(errorBody), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  /**
   * Create an HTML error page
   * @private
   * @param {string} title - Error page title
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} actionText - Call-to-action text
   * @param {string} actionUrl - Call-to-action URL
   * @returns {Response} HTML error response
   */
  static #createHtmlResponse(title, message, status, actionText = 'Return to Cemetery Entrance', actionUrl = '/') {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Cemetery of Forgotten Books</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Georgia, serif; 
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      color: #e8e8e8; 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      padding: 2rem;
    }
    .error-container {
      max-width: 600px;
      text-align: center;
      background: rgba(139, 0, 0, 0.1);
      border: 1px solid rgba(139, 0, 0, 0.3);
      border-radius: 12px;
      padding: 3rem 2rem;
      backdrop-filter: blur(10px);
    }
    .error-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.7;
    }
    .error-title {
      font-size: 2rem;
      color: #d4af37;
      margin-bottom: 1rem;
      font-weight: 300;
      letter-spacing: 1px;
    }
    .error-message {
      font-size: 1.1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
      color: #cccccc;
    }
    .error-code {
      font-size: 0.9rem;
      color: #8B0000;
      margin-bottom: 2rem;
      font-family: 'Courier New', monospace;
    }
    .action-button {
      display: inline-block;
      padding: 1rem 2rem;
      background: rgba(139, 0, 0, 0.2);
      border: 1px solid rgba(139, 0, 0, 0.5);
      color: #e8e8e8;
      text-decoration: none;
      border-radius: 6px;
      transition: all 0.3s ease;
      font-size: 1rem;
    }
    .action-button:hover {
      background: rgba(139, 0, 0, 0.3);
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">🏚️</div>
    <h1 class="error-title">${title}</h1>
    <p class="error-message">${message}</p>
    <div class="error-code">Error ${status}</div>
    <a href="${actionUrl}" class="action-button">${actionText}</a>
  </div>
</body>
</html>`;
    
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // Authentication & Authorization Errors
  
  /**
   * Authentication required error
   * @param {Request} request - Original request for content-type detection
   * @returns {Response} 401 error response
   */
  static authenticationRequired(request) {
    const acceptsHtml = request?.headers?.get('Accept')?.includes('text/html');
    
    if (acceptsHtml) {
      return this.#createHtmlResponse(
        'Authentication Required',
        'You must authenticate to access this section of the cemetery.',
        ErrorCode.UNAUTHORIZED,
        'Enter Cemetery',
        '/lock'
      );
    }
    
    return this.#createJsonResponse(
      'Authentication required',
      ErrorCode.UNAUTHORIZED,
      AppErrorType.AUTHENTICATION_REQUIRED
    );
  }
  
  /**
   * Invalid credentials error
   * @param {string} message - Custom error message
   * @returns {Response} 401 error response
   */
  static invalidCredentials(message = 'Invalid credentials provided') {
    return this.#createJsonResponse(
      message,
      ErrorCode.UNAUTHORIZED,
      AppErrorType.INVALID_CREDENTIALS
    );
  }
  
  /**
   * Admin token required error
   * @returns {Response} 401 error response
   */
  static adminTokenRequired() {
    return this.#createJsonResponse(
      'Admin token required',
      ErrorCode.UNAUTHORIZED,
      AppErrorType.ADMIN_TOKEN_REQUIRED
    );
  }
  
  /**
   * CSRF validation failed error
   * @returns {Response} 403 error response
   */
  static csrfValidationFailed() {
    return this.#createJsonResponse(
      'CSRF token validation failed',
      ErrorCode.FORBIDDEN,
      AppErrorType.CSRF_VALIDATION_FAILED
    );
  }
  
  // Rate Limiting Errors
  
  /**
   * Rate limit exceeded error
   * @param {number} resetTime - When rate limit resets (timestamp)
   * @param {number} remaining - Remaining requests
   * @returns {Response} 429 error response
   */
  static rateLimitExceeded(resetTime = null, remaining = 0) {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-RateLimit-Remaining': remaining.toString()
    };
    
    if (resetTime) {
      headers['X-RateLimit-Reset'] = Math.ceil(resetTime / 1000).toString();
      headers['Retry-After'] = Math.ceil((resetTime - Date.now()) / 1000).toString();
    }
    
    const errorBody = {
      error: 'Rate limit exceeded',
      code: AppErrorType.RATE_LIMIT_EXCEEDED,
      timestamp: new Date().toISOString(),
      remaining,
      ...(resetTime && { resetTime })
    };\n    \n    return new Response(JSON.stringify(errorBody), {\n      status: ErrorCode.TOO_MANY_REQUESTS,\n      headers\n    });\n  }\n  \n  // Validation Errors\n  \n  /**\n   * Validation error for invalid input\n   * @param {string} message - Validation error message\n   * @param {Array|Object} details - Validation error details\n   * @returns {Response} 400 error response\n   */\n  static validationError(message, details = null) {\n    return this.#createJsonResponse(\n      message,\n      ErrorCode.BAD_REQUEST,\n      AppErrorType.VALIDATION_ERROR,\n      details\n    );\n  }\n  \n  /**\n   * Method not allowed error\n   * @param {string} method - HTTP method that was attempted\n   * @param {Array} allowed - Array of allowed methods\n   * @returns {Response} 405 error response\n   */\n  static methodNotAllowed(method, allowed = []) {\n    const headers = {\n      'Content-Type': 'application/json',\n      'Cache-Control': 'no-cache, no-store, must-revalidate'\n    };\n    \n    if (allowed.length > 0) {\n      headers['Allow'] = allowed.join(', ');\n    }\n    \n    const errorBody = {\n      error: `Method ${method} not allowed`,\n      code: AppErrorType.METHOD_NOT_ALLOWED,\n      timestamp: new Date().toISOString(),\n      ...(allowed.length > 0 && { allowedMethods: allowed })\n    };\n    \n    return new Response(JSON.stringify(errorBody), {\n      status: ErrorCode.METHOD_NOT_ALLOWED,\n      headers\n    });\n  }\n  \n  // Database & Service Errors\n  \n  /**\n   * Database/service unavailable error with offline mode\n   * @param {string} service - Service name that's unavailable\n   * @param {Object} fallbackData - Fallback data to return\n   * @param {boolean} retryable - Whether the error is retryable\n   * @returns {Response} 503 error response\n   */\n  static serviceUnavailable(service, fallbackData = {}, retryable = true) {\n    const message = `${service} temporarily unavailable. Please try again later.`;\n    \n    return this.#createJsonResponse(\n      message,\n      ErrorCode.SERVICE_UNAVAILABLE,\n      AppErrorType.CONNECTION_ERROR,\n      null,\n      {\n        offline: true,\n        retryable,\n        ...fallbackData\n      }\n    );\n  }\n  \n  /**\n   * Database error with graceful message\n   * @param {string} operation - Database operation that failed\n   * @param {Object} error - Original error object\n   * @returns {Response} 500 error response\n   */\n  static databaseError(operation, error = null) {\n    const message = `Cemetery archives encountered an issue during ${operation}. Please try again.`;\n    \n    return this.#createJsonResponse(\n      message,\n      ErrorCode.INTERNAL_SERVER_ERROR,\n      AppErrorType.DATABASE_ERROR,\n      error?.code ? { dbErrorCode: error.code } : null\n    );\n  }\n  \n  // Generic Errors\n  \n  /**\n   * Not found error\n   * @param {string} resource - Resource that was not found\n   * @param {Request} request - Original request for content-type detection\n   * @returns {Response} 404 error response\n   */\n  static notFound(resource = 'Resource', request = null) {\n    const acceptsHtml = request?.headers?.get('Accept')?.includes('text/html');\n    \n    if (acceptsHtml) {\n      return this.#createHtmlResponse(\n        'Lost in the Cemetery',\n        `The ${resource.toLowerCase()} you seek has been lost to the cemetery mists.`,\n        ErrorCode.NOT_FOUND\n      );\n    }\n    \n    const message = resource === 'Resource' \n      ? 'Resource not found'\n      : `${resource} not found`;\n    \n    return this.#createJsonResponse(\n      message,\n      ErrorCode.NOT_FOUND,\n      AppErrorType.NOT_FOUND\n    );\n  }\n  \n  /**\n   * Unknown API endpoint error\n   * @returns {Response} 404 error response\n   */\n  static unknownEndpoint() {\n    return this.#createJsonResponse(\n      'API endpoint not found',\n      ErrorCode.NOT_FOUND,\n      AppErrorType.UNKNOWN_ENDPOINT\n    );\n  }\n  \n  /**\n   * Internal server error\n   * @param {Request} request - Original request for content-type detection\n   * @param {Error} error - Original error (for logging)\n   * @returns {Response} 500 error response\n   */\n  static internalServerError(request = null, error = null) {\n    const acceptsHtml = request?.headers?.get('Accept')?.includes('text/html');\n    \n    if (acceptsHtml) {\n      return this.#createHtmlResponse(\n        'Cemetery Temporarily Closed',\n        'The ancient spirits are stirring and the cemetery gates are temporarily sealed.',\n        ErrorCode.INTERNAL_SERVER_ERROR\n      );\n    }\n    \n    return this.#createJsonResponse(\n      'Server temporarily unavailable',\n      ErrorCode.INTERNAL_SERVER_ERROR,\n      'INTERNAL_ERROR'\n    );\n  }\n  \n  // Offline/Fallback Responses\n  \n  /**\n   * Create offline response with fallback data\n   * @param {string} operation - Operation being performed\n   * @param {Object} fallbackData - Fallback data structure\n   * @param {string} message - Custom message\n   * @returns {Object} Offline response object (not HTTP Response)\n   */\n  static offlineResponse(operation, fallbackData, message = null) {\n    return {\n      ...fallbackData,\n      offline: true,\n      message: message || `${operation} running in offline mode with limited functionality`,\n      limitations: 'Some features may be reduced functionality while offline',\n      timestamp: new Date().toISOString()\n    };\n  }\n  \n  /**\n   * Create maintenance mode response\n   * @param {Request} request - Original request for content-type detection\n   * @param {string} estimatedTime - Estimated maintenance duration\n   * @returns {Response} 503 error response\n   */\n  static maintenanceMode(request = null, estimatedTime = 'a few minutes') {\n    const acceptsHtml = request?.headers?.get('Accept')?.includes('text/html');\n    \n    if (acceptsHtml) {\n      return this.#createHtmlResponse(\n        'Cemetery Under Maintenance',\n        `The cemetery keepers are tending to the grounds. Please return in ${estimatedTime}.`,\n        ErrorCode.SERVICE_UNAVAILABLE,\n        'Check Back Later',\n        '/'\n      );\n    }\n    \n    return this.#createJsonResponse(\n      `Service temporarily under maintenance. Expected duration: ${estimatedTime}`,\n      ErrorCode.SERVICE_UNAVAILABLE,\n      AppErrorType.MAINTENANCE_MODE,\n      { estimatedDuration: estimatedTime }\n    );\n  }\n}\n\n/**\n * Helper function to create consistent error responses\n * @deprecated Use ErrorResponseFactory methods directly\n * @param {string} message - Error message\n * @param {number} status - HTTP status code\n * @param {string} code - Error code\n * @returns {Response} JSON error response\n */\nexport function createErrorResponse(message, status = 500, code = 'INTERNAL_ERROR') {\n  return ErrorResponseFactory.#createJsonResponse(message, status, code);\n}