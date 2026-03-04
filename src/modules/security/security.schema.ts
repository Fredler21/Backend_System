import { z } from 'zod';
import { SecurityEventType, SecuritySeverity } from '@prisma/client';

export const querySecurityEventsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.nativeEnum(SecurityEventType).optional(),
  severity: z.nativeEnum(SecuritySeverity).optional(),
  ipAddress: z.string().optional(),
  userId: z.string().optional(),
  resolved: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  startDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

export const queryLoginAttemptsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  email: z.string().optional(),
  ipAddress: z.string().optional(),
  success: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  startDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

export const queryBlockedIpsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  activeOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const blockIpSchema = z.object({
  ipAddress: z.string().min(1, 'IP address is required'),
  reason: z.string().min(1, 'Reason is required'),
  durationMinutes: z.coerce.number().min(1).optional(),
  permanent: z.boolean().optional(),
});

export const resolveEventSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
});

export type QuerySecurityEventsInput = z.infer<typeof querySecurityEventsSchema>;
export type QueryLoginAttemptsInput = z.infer<typeof queryLoginAttemptsSchema>;
export type QueryBlockedIpsInput = z.infer<typeof queryBlockedIpsSchema>;
export type BlockIpInput = z.infer<typeof blockIpSchema>;
