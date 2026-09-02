import { z } from 'zod';

const smtpHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .refine(
    (value) =>
      value !== 'localhost' &&
      !value.endsWith('.local') &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) &&
      /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(value) &&
      value.includes('.'),
    'Enter a public SMTP hostname such as smtp.company.com.',
  );

const emailAddressSchema = z.string().trim().toLowerCase().email().max(254);

export const companyEmailSettingsInputSchema = z
  .object({
    provider: z.enum(['gmail', 'microsoft365', 'zoho', 'cpanel', 'custom']),
    host: smtpHostSchema,
    port: z.number().int().min(1).max(65_535),
    secure: z.boolean(),
    requireTls: z.boolean(),
    username: z.string().trim().min(1).max(320),
    password: z.string().max(1_024).optional().default(''),
    fromName: z.string().trim().min(1).max(120),
    fromEmail: emailAddressSchema,
    replyTo: z.union([emailAddressSchema, z.literal('')]).default(''),
  })
  .strict();
