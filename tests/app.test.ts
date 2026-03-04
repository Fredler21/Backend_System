import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';

describe('Health Check', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Edlight Backend is running');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Route not found');
  });
});
