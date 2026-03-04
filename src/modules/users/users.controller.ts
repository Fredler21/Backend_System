import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/utils';
import { queryUsersSchema } from './users.schema';

/**
 * GET /api/users/me
 */
export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.getUserById(req.user!.userId);
    sendSuccess(res, 'User profile retrieved', user);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/me
 */
export async function updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await usersService.updateUser(req.user!.userId, req.body);
    sendSuccess(res, 'Profile updated successfully', user);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users
 */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = queryUsersSchema.parse(req.query);
    const { users, total } = await usersService.listUsers(query);
    sendPaginated(res, 'Users retrieved', users, total, query.page, query.limit);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 */
export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const user = await usersService.getUserById(id);
    sendSuccess(res, 'User retrieved', user);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/role
 */
export async function updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const user = await usersService.updateUserRole(id, req.body.role);
    sendSuccess(res, 'User role updated', user);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/users/:id
 */
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    await usersService.deleteUser(id);
    sendSuccess(res, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
}
