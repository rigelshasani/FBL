/**
 * Gate authentication system with daily password rotation
 * Password resets at midnight UTC timezone
 */

/**
 * Generate daily password using HMAC
 * @param {string} secretSeed - Secret seed for HMAC
 * @param {Date} date - Date for password generation (defaults to today)
 * @returns {Promise<string>} 8-character hex password
 */
export async function generateDailyPassword(secretSeed, date = new Date()) {
  if (!secretSeed) {
    throw new Error('SECRET_SEED is required');
  }
  
  // Get date in UTC timezone
  const utcDate = new Date(date.toISOString().split('T')[0] + 'T00:00:00.000Z');
  const dateString = utcDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Create HMAC-SHA256
  const hmac = await hmacSHA256(secretSeed, dateString);
  return hmac.slice(0, 8);
}

/**
 * Get midnight timestamp for UTC timezone
 * @param {Date} date - Reference date (defaults to today)  
 * @returns {Date} Next midnight in UTC timezone
 */
export function getUTCMidnight(date = new Date()) {
  // Get next midnight in UTC
  const midnight = new Date(date);
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight;
}

/**
 * Create authentication cookie with proper expiry
 * @param {string} password - Daily password that was validated
 * @param {Date} issuedAt - When cookie was issued (defaults to now)
 * @returns {Promise<string>} Set-Cookie header value
 */
export async function createAuthCookie(password, issuedAt = new Date()) {
  const midnight = getUTCMidnight(issuedAt);
  const issuedDate = issuedAt.toISOString().split('T')[0];
  
  const cookieData = {
    issued: issuedDate,
    hash: await hmacSHA256(password, issuedDate)
  };
  
  const cookieValue = btoa(JSON.stringify(cookieData));
  
  return `fbl_auth=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${midnight.toUTCString()}`;
}

/**
 * Validate authentication cookie
 * @param {string} cookieHeader - Cookie header from request
 * @param {string} secretSeed - Secret seed for password generation
 * @returns {Promise<boolean>} Whether cookie is valid
 */
export async function validateAuthCookie(cookieHeader, secretSeed) {
  if (!cookieHeader) return false;
  
  try {
    // Extract fbl_auth cookie
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const authCookie = cookies.fbl_auth;
    if (!authCookie) return false;
    
    // Parse cookie data
    const cookieData = JSON.parse(atob(authCookie));
    const { issued, hash } = cookieData;
    
    if (!issued || !hash) return false;
    
    // Generate expected password for issued date
    const issuedDate = new Date(issued + 'T00:00:00.000Z');
    const expectedPassword = await generateDailyPassword(secretSeed, issuedDate);
    const expectedHash = await hmacSHA256(expectedPassword, issued);
    
    // Verify hash matches
    if (hash !== expectedHash) return false;
    
    // Check if cookie is still valid (not past midnight)
    const now = new Date();
    const todayUTC = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z');
    const todayDate = todayUTC.toISOString().split('T')[0];
    
    return issued === todayDate;
    
  } catch (error) {
    return false;
  }
}

/**
 * Simple HMAC-SHA256 implementation using Web Crypto API
 * @param {string} key - Secret key
 * @param {string} data - Data to sign
 * @returns {string} Hex encoded HMAC
 */
async function hmacSHA256(key, data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);
  
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

