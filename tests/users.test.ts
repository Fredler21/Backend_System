import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/database/prisma';

const testUser = {
  email: 'userstest@edlight.io',
  password: 'TestPass123',
  firstName: 'Users',
  lastName: 'Test',
};

const adminUser = {
  email: 'admintest@edlight.io',
  password: 'AdminPass123',
  firstName: 'Admin',
  lastName: 'Test',
};

let userToken: string;
let adminToken: string;
let testUserId: string;

beforeAll(async () => {
  // Clean up
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [testUser.email, adminUser.email] } },
  });

  // Register test user
  const userRes = await request(app).post('/api/auth/register').send(testUser);
  userToken = userRes.body.data.tokens.accessToken;
  testUserId = userRes.body.data.user.id;

  // Register admin user, then promote
  const adminRes = await request(app).post('/api/auth/register').send(adminUser);
  const adminId = adminRes.body.data.user.id;

  // Directly promote to admin in DB for testing
  await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });

  // Re-login to get token with admin role
  const loginRes = await request(app).post('/api/auth/login').send({
    email: adminUser.email,
    password: adminUser.password,
  });
  adminToken = loginRes.body.data.tokens.accessToken;
});

afterAll(async () => {
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [testUser.email, adminUser.email] } },
  });
  await prisma.$disconnect();
});

describe('Users Module', () => {
  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update user profile', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Updated');
    });
  });

  describe('GET /api/users (admin)', () => {
    it('should list all users for admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/users/:id (admin)', () => {
    it('should get user by ID for admin', async () => {
      const res = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testUserId);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id (admin)', () => {
    it('should delete user for admin', async () => {
      const res = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
