import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/database/prisma';

const ALLOWED_EMAIL = 'admin@edlight.org';
const DISALLOWED_EMAIL = 'hacker@evil.com';

let adminToken: string;
let inviteToken: string;

beforeAll(async () => {
  // Clean up test data
  await prisma.adminInvite.deleteMany({});
  await prisma.securityEvent.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [ALLOWED_EMAIL, DISALLOWED_EMAIL, 'info@edlight.org'] } },
  });

  // Create an existing admin to generate invites
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('ExistingAdmin1!', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'testadmin-invite@edlight.io',
      password: hash,
      firstName: 'Test',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Login to get admin token
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'testadmin-invite@edlight.io', password: 'ExistingAdmin1!' });
  adminToken = res.body.data.tokens.accessToken;
});

afterAll(async () => {
  await prisma.adminInvite.deleteMany({});
  await prisma.securityEvent.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [ALLOWED_EMAIL, DISALLOWED_EMAIL, 'info@edlight.org', 'testadmin-invite@edlight.io'],
      },
    },
  });
  await prisma.$disconnect();
});

describe('Admin Invite Module', () => {
  // ─── Invite Generation ───────────────────────────────

  describe('POST /api/admin/invite', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/admin/invite')
        .send({ email: ALLOWED_EMAIL });

      expect(res.status).toBe(401);
    });

    it('should reject non-allowed email addresses', async () => {
      const res = await request(app)
        .post('/api/admin/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: DISALLOWED_EMAIL });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not authorized');
    });

    it('should generate invite for allowed email', async () => {
      const res = await request(app)
        .post('/api/admin/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: ALLOWED_EMAIL });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inviteUrl).toContain('setup-password?token=');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.expiresAt).toBeDefined();

      inviteToken = res.body.data.token;
    });

    it('should pre-create the user as inactive', async () => {
      const user = await prisma.user.findUnique({ where: { email: ALLOWED_EMAIL } });
      expect(user).not.toBeNull();
      expect(user!.role).toBe('ADMIN');
      expect(user!.isActive).toBe(false);
      expect(user!.password).toBeNull();
    });

    it('should revoke previous invites on re-invite', async () => {
      const res = await request(app)
        .post('/api/admin/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: ALLOWED_EMAIL });

      expect(res.status).toBe(201);

      // Old invites should be marked used
      const oldInvites = await prisma.adminInvite.findMany({
        where: { email: ALLOWED_EMAIL, token: inviteToken },
      });
      expect(oldInvites[0].used).toBe(true);

      // Update to the new token
      inviteToken = res.body.data.token;
    });
  });

  // ─── Token Verification ──────────────────────────────

  describe('GET /api/admin/verify-token', () => {
    it('should verify a valid token', async () => {
      const res = await request(app)
        .get(`/api/admin/verify-token?token=${inviteToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(ALLOWED_EMAIL);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/admin/verify-token?token=invalid-token-123');

      expect(res.status).toBe(404);
    });
  });

  // ─── Password Setup ──────────────────────────────────

  describe('POST /api/admin/setup-password', () => {
    it('should reject mismatched passwords', async () => {
      const res = await request(app)
        .post('/api/admin/setup-password')
        .send({
          token: inviteToken,
          password: 'StrongPass1!',
          confirmPassword: 'DifferentPass1!',
        });

      expect(res.status).toBe(422);
    });

    it('should reject weak passwords', async () => {
      const res = await request(app)
        .post('/api/admin/setup-password')
        .send({
          token: inviteToken,
          password: 'weak',
          confirmPassword: 'weak',
        });

      expect(res.status).toBe(422);
    });

    it('should set password and activate account', async () => {
      const res = await request(app)
        .post('/api/admin/setup-password')
        .send({
          token: inviteToken,
          password: 'SecureAdmin1!',
          confirmPassword: 'SecureAdmin1!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(ALLOWED_EMAIL);

      // Verify user is now active with password
      const user = await prisma.user.findUnique({ where: { email: ALLOWED_EMAIL } });
      expect(user!.isActive).toBe(true);
      expect(user!.password).not.toBeNull();
    });

    it('should reject reuse of consumed token', async () => {
      const res = await request(app)
        .post('/api/admin/setup-password')
        .send({
          token: inviteToken,
          password: 'AnotherPass1!',
          confirmPassword: 'AnotherPass1!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already been used');
    });
  });

  // ─── Login After Setup ────────────────────────────────

  describe('POST /api/auth/login (after invite setup)', () => {
    it('should authenticate with the new password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ALLOWED_EMAIL, password: 'SecureAdmin1!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user.email).toBe(ALLOWED_EMAIL);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invite re-generation for onboarded admin', async () => {
      const res = await request(app)
        .post('/api/admin/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: ALLOWED_EMAIL });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already completed');
    });
  });

  // ─── Admin Endpoints ─────────────────────────────────

  describe('GET /api/admin/invites', () => {
    it('should list invitations for admin', async () => {
      const res = await request(app)
        .get('/api/admin/invites')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/allowed-emails', () => {
    it('should return allowed admin emails', async () => {
      const res = await request(app)
        .get('/api/admin/allowed-emails')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.emails).toContain('admin@edlight.org');
      expect(res.body.data.emails).toContain('info@edlight.org');
    });
  });

  // ─── Audit Trail ─────────────────────────────────────

  describe('Audit Logging', () => {
    it('should have logged invite and setup security events', async () => {
      const events = await prisma.securityEvent.findMany({
        where: {
          type: {
            in: ['ADMIN_INVITE_SENT', 'ADMIN_PASSWORD_SETUP', 'ADMIN_INVITE_ACCEPTED'],
          },
        },
      });

      const types = events.map((e) => e.type);
      expect(types).toContain('ADMIN_INVITE_SENT');
      expect(types).toContain('ADMIN_PASSWORD_SETUP');
      expect(types).toContain('ADMIN_INVITE_ACCEPTED');
    });
  });
});
