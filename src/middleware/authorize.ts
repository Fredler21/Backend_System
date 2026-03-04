import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../shared/types';
import { ForbiddenError, UnauthorizedError } from '../shared/utils';

/**
 * Middleware factory to restrict access based on user roles.
 * Usage: authorize(Role.ADMIN) or authorize(Role.ADMIN, Role.DEVELOPER)
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions for this resource'));
    }

    next();
  };
}
