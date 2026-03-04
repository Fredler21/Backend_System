import { z } from 'zod';

/**
 * POST /api/admin/invite — send invitation to an allowed admin email.
 */
export const inviteAdminSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .transform((e) => e.toLowerCase().trim()),
});

/**
 * POST /api/admin/setup-password — set password using invite token.
 */
export const setupPasswordSchema = z
  .object({
    token: z.string().min(1, 'Invitation token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        'Password must contain uppercase, lowercase, number, and special character',
      ),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * GET /api/admin/verify-token — validate invite token before showing form.
 */
export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;
export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
