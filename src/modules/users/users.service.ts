import { Prisma } from '@prisma/client';
import prisma from '../../database/prisma';
import { UserResponse } from '../../shared/types';
import { NotFoundError, ConflictError } from '../../shared/utils';
import { UpdateUserInput, QueryUsersInput } from './users.schema';

// Fields to select (exclude password)
const userSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Get user by ID.
 */
export async function getUserById(id: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user as UserResponse;
}

/**
 * List users with optional filtering and pagination.
 */
export async function listUsers(query: QueryUsersInput): Promise<{ users: UserResponse[]; total: number }> {
  const { page, limit, role, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (role) {
    where.role = role;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users: users as UserResponse[], total };
}

/**
 * Update user profile by ID.
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserResponse> {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  // If email is being changed, check for conflicts
  if (input.email && input.email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) {
      throw new ConflictError('Email is already in use');
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: input,
    select: userSelect,
  });

  return user as UserResponse;
}

/**
 * Delete user by ID.
 */
export async function deleteUser(id: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  await prisma.user.delete({ where: { id } });
}

/**
 * Update user role (admin only).
 */
export async function updateUserRole(id: string, role: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as Prisma.EnumRoleFieldUpdateOperationsInput['set'] },
    select: userSelect,
  });

  return updated as UserResponse;
}
