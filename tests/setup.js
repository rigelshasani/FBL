/**
 * Test setup file - runs before all tests
 */

import { vi } from 'vitest';

// Mock global crypto API
const mockCrypto = {
  subtle: {
    importKey: vi.fn(async () => ({ keyData: new Uint8Array(32) })),
    sign: vi.fn(async () => new ArrayBuffer(32)),
    digest: vi.fn(async () => new ArrayBuffer(32))
  },
  getRandomValues: vi.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  randomUUID: vi.fn(() => {
    // Generate a simple UUID for testing
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  })
};

// Ensure crypto is available both on global and globalThis
Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true
});

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Mock btoa/atob for base64 operations
Object.defineProperty(globalThis, 'btoa', {
  value: (str) => Buffer.from(str).toString('base64'),
  writable: true
});

Object.defineProperty(globalThis, 'atob', {
  value: (str) => Buffer.from(str, 'base64').toString(),
  writable: true
});

// Mock Request/Response globals (already provided by Node.js 18+)
// But ensure they exist for older environments
if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = class Request {
    constructor(url, init = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      this.headers = new Map(Object.entries(init.headers || {}));
      this.body = init.body || null;
    }
  };
}

if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class Response {
    constructor(body = null, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Map(Object.entries(init.headers || {}));
    }
    
    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
    
    text() {
      return Promise.resolve(String(this.body));
    }
  };
}

// Mock fetch for HTTP requests
globalThis.fetch = vi.fn(() =>
  Promise.resolve(new globalThis.Response('{"status":"ok"}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }))
);

// Mock logger for structured logging
globalThis.logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => globalThis.logger)
};

// Set test environment
process.env.NODE_ENV = 'test';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});