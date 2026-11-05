import { z } from 'zod';

const name = z.string().trim().min(2).max(120)
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), 'Control characters are not permitted');

export const signupRequestInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  displayName: name,
  workspaceName: name,
  lang: z.enum(['ar','en']).default('en'),
}).strict();

export const signupConfirmInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(12).max(200),
}).strict();

export type SignupRequestInput = z.infer<typeof signupRequestInput>;
export type SignupConfirmInput = z.infer<typeof signupConfirmInput>;
