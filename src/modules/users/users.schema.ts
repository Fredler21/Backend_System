import { z } from 'zod';
import { Role } from '@prisma/client';

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export const queryUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.nativeEnum(Role).optional(),
  search: z.string().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type QueryUsersInput = z.infer<typeof queryUsersSchema>;
