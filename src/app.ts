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

const app = express();

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

// ─── Health Check ───────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Edlight Backend is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── Root Route ─────────────────────────────────────────

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Edlight Initiative Backend API',
    version: '1.0.0',
    docs: '/api/docs',
    health: '/health',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      security: '/api/security',
    },
  });
});

// ─── API Routes ─────────────────────────────────────────

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/security`, securityRoutes);

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
