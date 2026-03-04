import app from './app';
import { env } from './config';
import prisma from './database/prisma';

async function bootstrap(): Promise<void> {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      console.log(`
  ┌───────────────────────────────────────────────┐
  │                                               │
  │   ⚙️  Edlight Backend System                   │
  │                                               │
  │   Environment : ${env.NODE_ENV.padEnd(28)}│
  │   Port        : ${String(env.PORT).padEnd(28)}│
  │   API Docs    : http://localhost:${env.PORT}/api/docs   │
  │   Health      : http://localhost:${env.PORT}/health     │
  │                                               │
  └───────────────────────────────────────────────┘
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
