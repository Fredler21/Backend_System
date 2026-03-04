import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/database/prisma';

const testUser = {
  email: 'sectest@edlight.io',
  password: 'SecTest123',
  firstName: 'Security',
  lastName: 'Tester',
};

const adminUser = {
  email: 'secadmin@edlight.io',
  password: 'SecAdmin123',
  firstName: 'Security',
  lastName: 'Admin',
};

let adminToken: string;
let testUserId: string;

beforeAll(async () => {
  // Clean up
  await prisma.securityEvent.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.blockedIp.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [testUser.email, adminUser.email] } },
  });

  // Register test user
  const userRes = await request(app).post('/api/auth/register').send(testUser);
  testUserId = userRes.body.data.user.id;

  // Register admin user and promote
  const adminRes = await request(app).post('/api/auth/register').send(adminUser);
  const adminId = adminRes.body.data.user.id;
  await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });

  // Re-login to get admin token
  const loginRes = await request(app).post('/api/auth/login').send({
    email: adminUser.email,
    password: adminUser.password,
  });
  adminToken = loginRes.body.data.tokens.accessToken;
});

afterAll(async () => {
  await prisma.securityEvent.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.blockedIp.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [testUser.email, adminUser.email] } },
  });
  await prisma.$disconnect();
});

describe('Security Module', () => {
  describe('Login Attempt Tracking', () => {
    it('should record failed login attempts', async () => {
      // Make a few failed login attempts
      await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword1',
      });

      await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword2',
      });

      // Admin should see the failed attempts
      const res = await request(app)
        .get('/api/security/login-attempts?email=sectest@edlight.io&success=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0].success).toBe(false);
    });

    it('should record successful login', async () => {
      await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const res = await request(app)
        .get('/api/security/login-attempts?email=sectest@edlight.io&success=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].success).toBe(true);
    });
  });

  describe('Account Locking', () => {
    it('should lock account after too many failed attempts', async () => {
      // Reset the user's state and clear previous login attempts
      await prisma.loginAttempt.deleteMany({ where: { email: testUser.email } });
      await prisma.user.update({
        where: { id: testUserId },
        data: { failedLoginAttempts: 0, isLocked: false, lockedAt: null, lockedUntil: null },
      });

      // Exceed the threshold (default 5)
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: `WrongPass${i}`,
        });
      }

      // Verify account is locked
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.isLocked).toBe(true);
      expect(user?.lockedUntil).not.toBeNull();

      // Verify login is rejected with lock message
      const res = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('locked');
    });

    it('should allow admin to unlock account', async () => {
      const res = await request(app)
        .post(`/api/security/unlock-account/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify user can login again
      const loginRes = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('Security Dashboard', () => {
    it('should return dashboard data for admin', async () => {
      const res = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalEvents');
      expect(res.body.data).toHaveProperty('unresolvedEvents');
      expect(res.body.data).toHaveProperty('criticalEvents');
      expect(res.body.data).toHaveProperty('activeBlockedIps');
      expect(res.body.data).toHaveProperty('lockedAccounts');
      expect(res.body.data).toHaveProperty('failedLoginsLast24h');
      expect(res.body.data).toHaveProperty('successfulLoginsLast24h');
      expect(res.body.data).toHaveProperty('recentEvents');
    });

    it('should reject non-admin access to dashboard', async () => {
      // Ensure user is unlocked and can login
      await prisma.user.update({
        where: { id: testUserId },
        data: { failedLoginAttempts: 0, isLocked: false, lockedAt: null, lockedUntil: null },
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(loginRes.status).toBe(200);
      const userToken = loginRes.body.data.tokens.accessToken;

      const res = await request(app)
        .get('/api/security/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Security Events', () => {
    it('should list security events for admin', async () => {
      const res = await request(app)
        .get('/api/security/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter events by severity', async () => {
      const res = await request(app)
        .get('/api/security/events?severity=HIGH')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // All returned events should be HIGH severity
      res.body.data.forEach((event: { severity: string }) => {
        expect(event.severity).toBe('HIGH');
      });
    });

    it('should allow resolving a security event', async () => {
      // Get an event to resolve
      const eventsRes = await request(app)
        .get('/api/security/events?resolved=false')
        .set('Authorization', `Bearer ${adminToken}`);

      if (eventsRes.body.data.length > 0) {
        const eventId = eventsRes.body.data[0].id;

        const res = await request(app)
          .patch(`/api/security/events/${eventId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      }
    });
  });

  describe('IP Blocking', () => {
    it('should allow admin to manually block an IP', async () => {
      const res = await request(app)
        .post('/api/security/block-ip')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ipAddress: '192.168.1.100',
          reason: 'Manual block for testing',
          durationMinutes: 60,
        });

      expect(res.status).toBe(201);
    });

    it('should list blocked IPs', async () => {
      const res = await request(app)
        .get('/api/security/blocked-ips?activeOnly=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].ipAddress).toBe('192.168.1.100');
    });

    it('should allow admin to unblock an IP', async () => {
      const res = await request(app)
        .post('/api/security/unblock-ip')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ipAddress: '192.168.1.100' });

      expect(res.status).toBe(200);

      // Verify IP is unblocked
      const listRes = await request(app)
        .get('/api/security/blocked-ips?activeOnly=true')
        .set('Authorization', `Bearer ${adminToken}`);

      const stillBlocked = listRes.body.data.find(
        (ip: { ipAddress: string }) => ip.ipAddress === '192.168.1.100',
      );
      expect(stillBlocked).toBeUndefined();
    });
  });
});
