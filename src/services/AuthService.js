/**
 * Unified Authentication Service
 * Consolidates all authentication logic to eliminate duplication
 */

/**
 * Authentication types for different password generation schemes
 */
export const AuthType = {
  USER: 'user',
  ADMIN: 'admin',
  ONE_TIME: 'onetime'
};

/**
 * Authentication service with unified HMAC-based password generation
 */
export class AuthService {
  /**
   * Generate HMAC-SHA256 signature
   * @private
   * @param {string} secret - Secret key
   * @param {string} message - Message to sign
   * @returns {Promise<string>} Hex-encoded HMAC signature
   */
  static async #hmacSHA256(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Generate daily password using HMAC
   * @param {string} secretSeed - Secret seed for HMAC
   * @param {AuthType} type - Type of authentication (user/admin)
   * @param {Date} date - Date for password generation (defaults to today)
   * @returns {Promise<string>} Generated password
   */
  static async generateDailyPassword(secretSeed, type = AuthType.USER, date = new Date()) {
    if (!secretSeed) {
      throw new Error('SECRET_SEED is required');
    }
    
    // Get date in UTC timezone
    const utcDate = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
    const dateString = utcDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Create message with type prefix for different password schemes
    const message = type === AuthType.ADMIN ? `admin:${dateString}` : dateString;
    
    // Generate HMAC-SHA256
    const hmac = await this.#hmacSHA256(secretSeed, message);
    
    // Return different lengths based on type
    return type === AuthType.ADMIN ? hmac.slice(0, 12) : hmac.slice(0, 8);
  }
  
  /**
   * Generate one-time token with expiration
   * @param {string} secret - Secret for token generation
   * @param {number} timestamp - Timestamp for token generation
   * @param {number} length - Token length (default: 16)
   * @returns {Promise<string>} One-time token
   */
  static async generateOneTimeToken(secret, timestamp, length = 16) {
    const message = `${secret}:${timestamp}:onetime`;
    const hmac = await this.#hmacSHA256(secret, message);
    return hmac.slice(0, length);
  }
  
  /**
   * Validate one-time token with expiration check
   * @param {string} secret - Secret used for token generation
   * @param {string} token - Token to validate
   * @param {string|number} timestamp - Timestamp when token was generated
   * @param {number} maxAge - Maximum age in milliseconds (default: 10000)
   * @returns {Promise<boolean>} Whether token is valid
   */
  static async validateOneTimeToken(secret, token, timestamp, maxAge = 10000) {
    const now = Date.now();
    const age = now - parseInt(timestamp);
    
    // Check expiration
    if (age > maxAge) {
      return false;
    }
    
    // Validate token
    const expectedToken = await this.generateOneTimeToken(secret, timestamp);
    return this.timingSafeEquals(token, expectedToken);
  }
  
  /**
   * Get midnight timestamp for UTC timezone
   * @param {Date} date - Reference date (defaults to today)
   * @returns {Date} Next midnight in UTC timezone
   */
  static getUTCMidnight(date = new Date()) {
    const midnight = new Date(date);
    midnight.setUTCHours(24, 0, 0, 0);
    return midnight;
  }
  
  /**
   * Get UTC date string in YYYY-MM-DD format
   * @param {Date} date - Date to format (defaults to today)
   * @returns {string} UTC date string
   */
  static getUTCDateString(date = new Date()) {
    const utcDate = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
    return utcDate.toISOString().split('T')[0];
  }
  
  /**
   * Create authentication cookie with proper expiry
   * @param {string} password - Daily password that was validated
   * @param {Date} issuedAt - When cookie was issued (defaults to now)
   * @returns {Promise<string>} Set-Cookie header value
   */
  static async createAuthCookie(password, issuedAt = new Date()) {
    const midnight = this.getUTCMidnight(issuedAt);
    const issuedDate = this.getUTCDateString(issuedAt);
    
    const cookieData = {
      issued: issuedDate,
      hash: await this.#hmacSHA256(password, issuedDate)
    };
    
    const cookieValue = btoa(JSON.stringify(cookieData));
    
    return `fbl_auth=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${midnight.toUTCString()}`;
  }
  
  /**
   * Parse cookies from cookie header
   * @param {string} cookieHeader - Cookie header from request
   * @returns {Object} Parsed cookies as key-value pairs
   */
  static parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    
    return cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }
  
  /**
   * Validate authentication cookie
   * @param {string} cookieHeader - Cookie header from request
   * @param {string} secretSeed - Secret seed for password generation
   * @param {string} cookieName - Name of the auth cookie (default: 'fbl_auth')
   * @returns {Promise<boolean>} Whether cookie is valid
   */
  static async validateAuthCookie(cookieHeader, secretSeed, cookieName = 'fbl_auth') {
    try {
      const cookies = this.parseCookies(cookieHeader);
      const authCookie = cookies[cookieName];
      
      if (!authCookie) return false;
      
      // Parse cookie data
      const cookieData = JSON.parse(atob(authCookie));
      const { issued, hash } = cookieData;
      
      if (!issued || !hash) return false;
      
      // Generate expected password for issued date
      const issuedDate = new Date(issued + 'T00:00:00.000Z');
      const expectedPassword = await this.generateDailyPassword(secretSeed, AuthType.USER, issuedDate);
      const expectedHash = await this.#hmacSHA256(expectedPassword, issued);
      
      // Verify hash matches
      if (!this.timingSafeEquals(hash, expectedHash)) return false;
      
      // Check if cookie is still valid (not past midnight)
      const todayDate = this.getUTCDateString(new Date());
      return issued === todayDate;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Validate admin authentication cookie
   * @param {string} cookieHeader - Cookie header from request
   * @param {string} adminSecretSeed - Admin secret seed
   * @returns {Promise<boolean>} Whether admin cookie is valid
   */
  static async validateAdminAuthCookie(cookieHeader, adminSecretSeed) {
    try {
      const cookies = this.parseCookies(cookieHeader);
      const adminCookie = cookies['fbl_admin_auth'];
      
      if (!adminCookie) return false;
      
      const cookieData = JSON.parse(atob(adminCookie));
      const { issued, hash } = cookieData;
      
      if (!issued || !hash) return false;
      
      // Generate expected admin password for issued date
      const issuedDate = new Date(issued + 'T00:00:00.000Z');
      const expectedPassword = await this.generateDailyPassword(adminSecretSeed, AuthType.ADMIN, issuedDate);
      const expectedHash = await this.#hmacSHA256(expectedPassword, issued);
      
      // Verify hash matches
      if (!this.timingSafeEquals(hash, expectedHash)) return false;
      
      // Check if cookie is still valid
      const todayDate = this.getUTCDateString(new Date());
      return issued === todayDate;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Create admin authentication cookie
   * @param {string} password - Admin password that was validated
   * @param {Date} issuedAt - When cookie was issued
   * @returns {Promise<string>} Set-Cookie header value for admin
   */
  static async createAdminAuthCookie(password, issuedAt = new Date()) {
    const midnight = this.getUTCMidnight(issuedAt);
    const issuedDate = this.getUTCDateString(issuedAt);
    
    const cookieData = {
      issued: issuedDate,
      hash: await this.#hmacSHA256(password, issuedDate)
    };
    
    const cookieValue = btoa(JSON.stringify(cookieData));
    
    return `fbl_admin_auth=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Expires=${midnight.toUTCString()}`;
  }
  
  /**
   * Timing-safe string comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} Whether strings are equal
   */
  static timingSafeEquals(a, b) {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
  
  /**
   * Generate secure random token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} Hex-encoded random token
   */
  static generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Hash password with timing-safe validation
   * @param {string} password - Password to validate
   * @param {string} expectedHash - Expected hash
   * @returns {Promise<boolean>} Whether password is valid
   */
  static async validatePassword(password, expectedHash) {
    const actualHash = await this.#hmacSHA256(password, 'validation');
    return this.timingSafeEquals(actualHash, expectedHash);
  }
}