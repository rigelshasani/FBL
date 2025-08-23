import { describe, it, expect, beforeEach } from 'vitest';

import { vi } from 'vitest';

// Mock global crypto and btoa/atob for gate functionality
const mockCrypto = {
  subtle: {
    importKey: vi.fn(async () => ({ keyData: new Uint8Array(32) })),
    sign: vi.fn(async () => new ArrayBuffer(32))
  }
};

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

describe('Worker', () => {
  it('should respond to health check', async () => {
    const worker = await import('../../src/worker.js');
    
    const request = new Request('http://localhost/health');
    const env = { ENVIRONMENT: 'test' };
    
    const response = await worker.default.fetch(request, env, {});
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.environment).toBe('test');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
  });
  
  it('should return lock screen for GET /lock', async () => {
    const worker = await import('../../src/worker.js');
    
    const request = new Request('http://localhost/lock');
    const env = { SECRET_SEED: 'test-secret' };
    
    const response = await worker.default.fetch(request, env, {});
    const body = await response.text();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(body).toContain('Cemetery of Forgotten Books - Enter');
    expect(body).toContain('Daily Password');
  });
  
  it('should redirect unauthenticated requests to lock screen', async () => {
    const worker = await import('../../src/worker.js');
    
    const request = new Request('http://localhost/', {
      headers: { 'Accept': 'text/html' }
    });
    const env = { SECRET_SEED: 'test-secret' };
    
    const response = await worker.default.fetch(request, env, {});
    
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/lock');
  });
  
  it('should return 401 for unauthenticated API requests', async () => {
    const worker = await import('../../src/worker.js');
    
    const request = new Request('http://localhost/api/books', {
      headers: { 'Accept': 'application/json' }
    });
    const env = { SECRET_SEED: 'test-secret' };
    
    const response = await worker.default.fetch(request, env, {});
    const body = await response.json();
    
    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });
  
  it('should return 401 for unauthenticated unknown routes', async () => {
    const worker = await import('../../src/worker.js');
    
    const request = new Request('http://localhost/unknown', {
      headers: { 'Accept': 'application/json' }
    });
    const env = { SECRET_SEED: 'test-secret' };
    
    const response = await worker.default.fetch(request, env, {});
    
    expect(response.status).toBe(401);
  });
  
  it('should handle auth errors gracefully', async () => {
    const worker = await import('../../src/worker.js');
    
    // Request without required SECRET_SEED to trigger auth error
    const request = new Request('http://localhost/', {
      headers: { 'Accept': 'application/json' }
    });
    const env = {}; // Missing SECRET_SEED
    
    const response = await worker.default.fetch(request, env, {});
    
    // Should return 401 when auth middleware fails due to missing SECRET_SEED
    expect(response.status).toBe(401);
  });
});