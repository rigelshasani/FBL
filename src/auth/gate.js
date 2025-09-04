/**
 * Gate authentication system with daily password rotation
 * Password resets at midnight UTC timezone
 * 
 * @deprecated Individual functions deprecated in favor of AuthService
 * @see {AuthService} for unified authentication functionality
 */

import { AuthService, AuthType } from '../services/AuthService.js';

/**
 * Generate daily password using HMAC
 * @deprecated Use AuthService.generateDailyPassword() instead
 * @param {string} secretSeed - Secret seed for HMAC
 * @param {Date} date - Date for password generation (defaults to today)
 * @returns {Promise<string>} 8-character hex password
 */
export async function generateDailyPassword(secretSeed, date = new Date()) {
  return AuthService.generateDailyPassword(secretSeed, AuthType.USER, date);
}

/**
 * Get midnight timestamp for UTC timezone
 * @deprecated Use AuthService.getUTCMidnight() instead
 * @param {Date} date - Reference date (defaults to today)  
 * @returns {Date} Next midnight in UTC timezone
 */
export function getUTCMidnight(date = new Date()) {
  return AuthService.getUTCMidnight(date);
}

/**
 * Create authentication cookie with proper expiry
 * @deprecated Use AuthService.createAuthCookie() instead
 * @param {string} password - Daily password that was validated
 * @param {Date} issuedAt - When cookie was issued (defaults to now)
 * @returns {Promise<string>} Set-Cookie header value
 */
export async function createAuthCookie(password, issuedAt = new Date()) {
  return AuthService.createAuthCookie(password, issuedAt);
}

/**
 * Validate authentication cookie
 * @deprecated Use AuthService.validateAuthCookie() instead
 * @param {string} cookieHeader - Cookie header from request
 * @param {string} secretSeed - Secret seed for password generation
 * @returns {Promise<boolean>} Whether cookie is valid
 */
export async function validateAuthCookie(cookieHeader, secretSeed) {
  return AuthService.validateAuthCookie(cookieHeader, secretSeed);
}