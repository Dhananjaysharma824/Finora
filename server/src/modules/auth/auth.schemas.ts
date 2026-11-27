import { z } from 'zod';

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
  password: z.string().min(1, 'Password is required').max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16, 'Invalid verification token').max(256),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16, 'Invalid reset token').max(256),
  newPassword: strongPasswordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: strongPasswordSchema,
});
