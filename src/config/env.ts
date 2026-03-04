import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().min(8).max(16).default(12),

  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3001'),

  // Security & Intrusion Detection
  MAX_LOGIN_ATTEMPTS: z.coerce.number().min(3).default(5),
  ACCOUNT_LOCK_DURATION_MINUTES: z.coerce.number().min(1).default(30),
  LOGIN_ATTEMPT_WINDOW_MINUTES: z.coerce.number().min(1).default(15),
  IP_BLOCK_DURATION_MINUTES: z.coerce.number().min(5).default(60),
  IP_BLOCK_THRESHOLD: z.coerce.number().min(5).default(20),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().min(1).default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(10).default(100),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(3).default(10),

  // Admin Invite
  ADMIN_INVITE_EXPIRY_HOURS: z.coerce.number().min(1).default(24),
  ADMIN_ALLOWED_EMAILS: z.string().default('admin@edlight.org,info@edlight.org'),
  ADMIN_PANEL_URL: z.string().default('http://localhost:3001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
