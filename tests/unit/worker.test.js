import { describe, it, expect } from 'vitest';

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
  });
  
  it('should return 404 for unknown routes', async () => {
    const worker = await import('../../src/worker.js');
    
    const request = new Request('http://localhost/unknown');
    const env = {};
    
    const response = await worker.default.fetch(request, env, {});
    
    expect(response.status).toBe(404);
  });
});