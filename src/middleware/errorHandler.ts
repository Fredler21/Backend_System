import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/utils';

/**
 * Centralized error handling middleware.
 * Catches all errors thrown in route handlers and middleware.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Known operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Prisma known errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A record with that value already exists',
      });
      return;
    }
    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found',
      });
      return;
    }
  }

  // Unexpected errors
  console.error('❌ Unhandled error:', err);

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message || 'Internal server error',
  });
}
