/**
 * Application Configuration Constants
 * Centralizes all magic numbers and configuration values
 */

// Time constants (in milliseconds)
export const TIME = {
  // Seconds
  SECOND: 1000,
  
  // Minutes  
  MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  
  // Hours
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
};

// Authentication & Session Constants
export const AUTH = {
  // Token expiration times
  ONE_TIME_TOKEN_EXPIRY: 10 * TIME.SECOND,
  SESSION_TOKEN_EXPIRY: 30 * TIME.MINUTE,
  ADMIN_TOKEN_EXPIRY: 30 * TIME.MINUTE,
  
  // Session management
  SESSION_AUTO_EXPIRE: 5 * TIME.MINUTE,
  
  // Password lengths
  USER_PASSWORD_LENGTH: 8,
  ADMIN_PASSWORD_LENGTH: 12,
  ONE_TIME_TOKEN_LENGTH: 16,
  
  // Cookie names
  COOKIE_NAME_AUTH: 'fbl_auth',
  COOKIE_NAME_ADMIN: 'fbl_admin_auth'
};

// Cache Configuration
export const CACHE = {
  // Default TTLs
  API_RESPONSE_TTL: 2 * TIME.MINUTE,
  DATABASE_QUERY_TTL: 5 * TIME.MINUTE,
  CATEGORIES_TTL: 30 * TIME.MINUTE,
  AUTH_TOKEN_TTL: 15 * TIME.MINUTE,
  
  // Cache sizes
  RESPONSE_CACHE_SIZE: 500,
  DATABASE_CACHE_SIZE: 200,
  AUTH_CACHE_SIZE: 100,
  
  // Cleanup intervals
  CLEANUP_INTERVAL: 5 * TIME.MINUTE,
  RESPONSE_CACHE_CLEANUP: 2 * TIME.MINUTE,
  DATABASE_CACHE_CLEANUP: 5 * TIME.MINUTE,
  AUTH_CACHE_CLEANUP: 3 * TIME.MINUTE
};

// Rate Limiting Configuration
export const RATE_LIMIT = {
  // Time windows
  DEFAULT_WINDOW: 1 * TIME.MINUTE,
  SEARCH_WINDOW: 1 * TIME.MINUTE,
  AUTH_WINDOW: 5 * TIME.MINUTE,
  
  // Request limits
  DEFAULT_MAX_REQUESTS: 100,
  API_MAX_REQUESTS: 60,
  SEARCH_MAX_REQUESTS: 20,
  AUTH_MAX_REQUESTS: 5,
  PAGES_MAX_REQUESTS: 30,
  
  // Review limits
  REVIEWS_PER_DAY: 5,
  REVIEW_RATE_LIMIT_WINDOW: TIME.DAY
};

// Database Configuration
export const DATABASE = {
  // Pagination limits
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MAX_OFFSET: 10000,
  
  // Query timeouts
  AVAILABILITY_CHECK_TIMEOUT: 5 * TIME.SECOND,
  QUERY_TIMEOUT: 30 * TIME.SECOND,
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1 * TIME.SECOND
};

// Validation Constants
export const VALIDATION = {
  // String lengths
  PASSWORD_MIN_LENGTH: 3,
  PASSWORD_MAX_LENGTH: 50,
  SEARCH_QUERY_MIN_LENGTH: 2,
  SEARCH_QUERY_MAX_LENGTH: 200,
  REVIEW_MIN_LENGTH: 10,
  REVIEW_MAX_LENGTH: 2000,
  CATEGORY_MAX_LENGTH: 100,
  BOOK_SLUG_MAX_LENGTH: 200,
  TITLE_MAX_LENGTH: 200,
  AUTHOR_MAX_LENGTH: 100,
  SUMMARY_MAX_LENGTH: 2000,
  LANGUAGE_MAX_LENGTH: 10,
  
  // Numeric limits
  MIN_STAR_RATING: 1,
  MAX_STAR_RATING: 5,
  MIN_YEAR: -3000,
  
  // Hash lengths
  IP_HASH_MIN_LENGTH: 16,
  IP_HASH_MAX_LENGTH: 64
};

// Memory Management
export const MEMORY = {
  // Default memory limits
  DEFAULT_MAX_ENTRIES: 10000,
  DEFAULT_MAX_AGE: TIME.DAY,
  DEFAULT_CLEANUP_INTERVAL: 5 * TIME.MINUTE,
  
  // Cache-specific limits
  RATE_LIMIT_STORE_MAX_ENTRIES: 5000,
  SESSION_STORE_MAX_ENTRIES: 1000,
  
  // Memory thresholds
  CLEANUP_THRESHOLD: 0.8, // 80% capacity
  FORCE_CLEANUP_THRESHOLD: 0.95 // 95% capacity
};

// Content & File Handling
export const CONTENT = {
  // Supported formats
  SUPPORTED_BOOK_FORMATS: ['pdf', 'epub', 'txt'],
  SUPPORTED_LANGUAGES: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru'],
  
  // File size limits (in bytes)
  MAX_BOOK_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_COVER_FILE_SIZE: 2 * 1024 * 1024,  // 2MB
  
  // Content types
  ALLOWED_CONTENT_TYPES: ['text/plain', 'application/json', 'application/pdf', 'application/epub+zip']
};

// UI & Display Constants
export const UI = {
  // Pagination defaults
  DEFAULT_BOOKS_PER_PAGE: 20,
  DEFAULT_REVIEWS_PER_PAGE: 10,
  DEFAULT_CATEGORIES_PER_PAGE: 50,
  
  // Display limits
  MAX_SEARCH_RESULTS: 50,
  MAX_CATEGORY_BOOKS: 100,
  
  // Auto-refresh intervals
  METRICS_REFRESH_INTERVAL: 30 * TIME.SECOND,
  HEALTH_CHECK_INTERVAL: 60 * TIME.SECOND
};

// Security Constants
export const SECURITY = {
  // HMAC key lengths
  MIN_SECRET_LENGTH: 16,
  RECOMMENDED_SECRET_LENGTH: 32,
  
  // Token generation
  SECURE_TOKEN_LENGTH: 32,
  CSRF_TOKEN_LENGTH: 32,
  
  // Headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};

// Performance Constants
export const PERFORMANCE = {
  // Compression thresholds
  MIN_COMPRESSION_SIZE: 1000, // bytes
  COMPRESSION_RATIO_THRESHOLD: 0.8,
  
  // Request timeouts
  DEFAULT_REQUEST_TIMEOUT: 30 * TIME.SECOND,
  SLOW_REQUEST_THRESHOLD: 5 * TIME.SECOND,
  
  // Batch processing
  MAX_BATCH_SIZE: 100,
  BATCH_PROCESSING_DELAY: 100 // milliseconds
};

// Monitoring & Logging
export const MONITORING = {
  // Log retention
  ERROR_LOG_RETENTION: 7 * TIME.DAY,
  ACCESS_LOG_RETENTION: 30 * TIME.DAY,
  PERFORMANCE_LOG_RETENTION: 3 * TIME.DAY,
  
  // Metrics collection
  METRICS_COLLECTION_INTERVAL: 60 * TIME.SECOND,
  PERFORMANCE_SAMPLE_RATE: 0.1, // 10%
  ERROR_SAMPLE_RATE: 1.0, // 100%
  
  // Alert thresholds
  HIGH_ERROR_RATE_THRESHOLD: 0.05, // 5%
  SLOW_RESPONSE_THRESHOLD: 2 * TIME.SECOND,
  HIGH_MEMORY_USAGE_THRESHOLD: 0.8 // 80%
};

// Environment-specific overrides
export const ENVIRONMENT = {
  DEVELOPMENT: {
    CACHE_TTL_MULTIPLIER: 0.1, // Shorter cache times
    LOG_LEVEL: 'DEBUG',
    ENABLE_DEBUG_HEADERS: true
  },
  
  PRODUCTION: {
    CACHE_TTL_MULTIPLIER: 1.0,
    LOG_LEVEL: 'INFO',
    ENABLE_DEBUG_HEADERS: false,
    STRICT_VALIDATION: true
  },
  
  TEST: {
    CACHE_TTL_MULTIPLIER: 0.01, // Very short cache times
    LOG_LEVEL: 'ERROR',
    DISABLE_RATE_LIMITING: true,
    FAST_MODE: true
  }
};

/**
 * Get environment-specific configuration
 * @param {string} env - Environment name (development, production, test)
 * @returns {Object} Environment configuration
 */
export function getEnvironmentConfig(env = 'development') {
  return ENVIRONMENT[env.toUpperCase()] || ENVIRONMENT.DEVELOPMENT;
}

/**
 * Get cache TTL adjusted for environment
 * @param {number} baseTTL - Base TTL in milliseconds
 * @param {string} env - Environment name
 * @returns {number} Adjusted TTL
 */
export function getAdjustedTTL(baseTTL, env = 'development') {
  const config = getEnvironmentConfig(env);
  return Math.max(1000, baseTTL * config.CACHE_TTL_MULTIPLIER);
}

/**
 * Validate that required environment variables are set
 * @param {Object} env - Environment variables object
 * @throws {Error} If required variables are missing
 */
export function validateEnvironment(env) {
  const required = [
    'SECRET_SEED',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = required.filter(key => !env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Export commonly used constant combinations
export const COMMON = {
  // Short cache times
  SHORT_CACHE: CACHE.API_RESPONSE_TTL,
  MEDIUM_CACHE: CACHE.DATABASE_QUERY_TTL,
  LONG_CACHE: CACHE.CATEGORIES_TTL,
  
  // Common timeouts
  QUICK_TIMEOUT: 5 * TIME.SECOND,
  NORMAL_TIMEOUT: 30 * TIME.SECOND,
  LONG_TIMEOUT: 60 * TIME.SECOND,
  
  // Common limits
  SMALL_BATCH: 10,
  MEDIUM_BATCH: 50,
  LARGE_BATCH: 100
};