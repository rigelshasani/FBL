import { describe, it, expect, beforeEach } from 'vitest';
import { 
  generateDailyPassword, 
  getTiranaMidnight, 
  createAuthCookie, 
  validateAuthCookie 
} from '../../src/auth/gate.js';

import { vi } from 'vitest';

// Mock crypto.subtle for testing
const mockCrypto = {
  subtle: {
    importKey: vi.fn(async (format, keyData, algorithm, extractable, usages) => {
      return { keyData, algorithm };
    }),
    sign: vi.fn(async (algorithm, key, data) => {
      // Simple mock implementation for testing
      const keyArray = new Uint8Array(key.keyData);
      const dataArray = new Uint8Array(data);
      const combined = new Uint8Array(keyArray.length + dataArray.length);
      combined.set(keyArray);
      combined.set(dataArray, keyArray.length);
      
      // Create a deterministic hash-like result
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash + combined[i]) & 0xffffffff;
      }
      
      const result = new ArrayBuffer(32);
      const view = new Uint32Array(result);
      for (let i = 0; i < 8; i++) {
        view[i] = hash + i;
      }
      return result;
    })
  }
};

// Mock globals
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

Object.defineProperty(global, 'btoa', {
  value: (str) => Buffer.from(str).toString('base64'),
  writable: true
});

Object.defineProperty(global, 'atob', {
  value: (str) => Buffer.from(str, 'base64').toString(),
  writable: true
});

describe('generateDailyPassword', () => {
  it('should generate consistent password for same date', async () => {
    const secret = 'test-secret';
    const date = new Date('2024-01-15T10:30:00Z');
    
    const password1 = await generateDailyPassword(secret, date);
    const password2 = await generateDailyPassword(secret, date);
    
    expect(password1).toBe(password2);
    expect(password1).toHaveLength(8);
  });
  
  it('should generate different passwords for different dates', async () => {
    const secret = 'test-secret';
    const date1 = new Date('2024-01-15T10:30:00Z');
    const date2 = new Date('2024-01-16T10:30:00Z');
    
    const password1 = await generateDailyPassword(secret, date1);
    const password2 = await generateDailyPassword(secret, date2);
    
    expect(password1).not.toBe(password2);
  });
  
  it('should generate different passwords for different secrets', async () => {
    const date = new Date('2024-01-15T10:30:00Z');
    
    const password1 = await generateDailyPassword('secret1', date);
    const password2 = await generateDailyPassword('secret2', date);
    
    expect(password1).not.toBe(password2);
  });
  
  it('should throw error for missing secret', async () => {
    await expect(generateDailyPassword('')).rejects.toThrow('SECRET_SEED is required');
  });
});

describe('getTiranaMidnight', () => {
  it('should return next midnight in Tirane timezone', () => {
    const date = new Date('2024-01-15T14:30:00Z'); // 2:30 PM UTC
    const midnight = getTiranaMidnight(date);
    
    expect(midnight).toBeInstanceOf(Date);
    expect(midnight.getTime()).toBeGreaterThan(date.getTime());
  });
  
  it('should handle DST transitions', () => {
    // Test around DST transition dates for Europe/Tirane
    const beforeDST = new Date('2024-03-30T22:00:00Z');
    const afterDST = new Date('2024-03-31T22:00:00Z');
    
    const midnightBefore = getTiranaMidnight(beforeDST);
    const midnightAfter = getTiranaMidnight(afterDST);
    
    expect(midnightBefore).toBeInstanceOf(Date);
    expect(midnightAfter).toBeInstanceOf(Date);
  });
});

describe('createAuthCookie', () => {
  it('should create valid cookie string', async () => {
    const password = 'testpass';
    const issuedAt = new Date('2024-01-15T14:30:00Z');
    
    const cookie = await createAuthCookie(password, issuedAt);
    
    expect(cookie).toContain('fbl_auth=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Expires=');
  });
  
  it('should include correct expiry date', async () => {
    const password = 'testpass';
    const issuedAt = new Date('2024-01-15T14:30:00Z');
    
    const cookie = await createAuthCookie(password, issuedAt);
    
    // Extract expires date
    const expiresMatch = cookie.match(/Expires=([^;]+)/);
    expect(expiresMatch).toBeTruthy();
    
    const expiresDate = new Date(expiresMatch[1]);
    expect(expiresDate.getTime()).toBeGreaterThan(issuedAt.getTime());
  });
});

describe('validateAuthCookie', () => {
  it('should validate correct cookie', async () => {
    const secret = 'test-secret';
    const password = await generateDailyPassword(secret);
    const cookie = await createAuthCookie(password);
    
    const cookieHeader = cookie;
    const isValid = await validateAuthCookie(cookieHeader, secret);
    
    expect(isValid).toBe(true);
  });
  
  it('should reject empty cookie', async () => {
    const isValid = await validateAuthCookie('', 'test-secret');
    expect(isValid).toBe(false);
  });
  
  it('should reject malformed cookie', async () => {
    const isValid = await validateAuthCookie('fbl_auth=invalid', 'test-secret');
    expect(isValid).toBe(false);
  });
  
  it('should reject cookie with wrong secret', async () => {
    const password = await generateDailyPassword('secret1');
    const cookie = await createAuthCookie(password);
    
    const isValid = await validateAuthCookie(cookie, 'secret2');
    expect(isValid).toBe(false);
  });
  
  it('should reject expired cookie from previous day', async () => {
    const secret = 'test-secret';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const password = await generateDailyPassword(secret, yesterday);
    const cookie = await createAuthCookie(password, yesterday);
    
    const isValid = await validateAuthCookie(cookie, secret);
    expect(isValid).toBe(false);
  });
});