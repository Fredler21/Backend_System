import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env, swaggerSpec } from './config';
import { errorHandler } from './middleware';
import { API_PREFIX } from './shared/constants';

// Security imports
import { globalRateLimiter, ipBlockGuard, requestMonitor } from './modules/security';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import securityRoutes from './modules/security/security.routes';
import adminRoutes from './modules/admin/admin.routes';
import adminManagementRoutes from './modules/admin/admin-management.routes';

const app = express();

// ─── Trust Proxy (required for Vercel / reverse proxies) ────
app.set('trust proxy', true);

// ─── Global Middleware ──────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Security Middleware ────────────────────────────────

app.use(ipBlockGuard);          // Block banned IPs before anything else
app.use(globalRateLimiter);     // Global rate limiting
app.use(requestMonitor);        // Monitor requests for suspicious patterns

// ─── API Documentation ─────────────────────────────────

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Edlight API Docs',
}));

// ─── Health / Readiness / Metrics ───────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Edlight Backend is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
  });
});

app.get('/readiness', async (_req, res) => {
  try {
    const { default: prisma } = await import('./database/prisma');
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'Backend is ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      success: false,
      message: 'Backend is not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/metrics', async (_req, res) => {
  try {
    const { default: prisma } = await import('./database/prisma');
    const [userCount, activeUsers, lockedAccounts, blockedIps] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isLocked: true } }),
      prisma.blockedIp.count({ where: { active: true } }),
    ]);
    res.status(200).json({
      success: true,
      message: 'Metrics snapshot',
      data: {
        users: { total: userCount, active: activeUsers, locked: lockedAccounts },
        security: { blockedIps },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to collect metrics' });
  }
});

// ─── Root Route ─────────────────────────────────────────

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Edlight Initiative Backend API',
    version: '1.0.0',
    docs: '/api/docs',
    health: '/health',
    readiness: '/readiness',
    metrics: '/metrics',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      security: '/api/security',
      admin: '/api/admin',
    },
  });
});

// ─── API Routes ─────────────────────────────────────────

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/security`, securityRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/admin`, adminManagementRoutes);

// ─── 404 Handler ────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ─── Error Handler (must be last) ───────────────────────

app.use(errorHandler);

export default app;
