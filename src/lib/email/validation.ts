import { z } from 'zod';

const emailAddressSchema = z.string().trim().toLowerCase().email().max(254);

function uniqueAddresses(addresses: string[]) {
  return [...new Set(addresses)];
}

export const emailDraftInputSchema = z
  .object({
    toEmails: z.array(emailAddressSchema).min(1).max(20).transform(uniqueAddresses),
    ccEmails: z.array(emailAddressSchema).max(20).default([]).transform(uniqueAddresses),
    bccEmails: z.array(emailAddressSchema).max(20).default([]).transform(uniqueAddresses),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .refine((value) => !/[\r\n]/.test(value), {
        message: 'The email subject cannot contain line breaks.',
      }),
    bodyText: z.string().trim().min(1).max(20_000),
  })
  .superRefine((input, context) => {
    const all = [...input.toEmails, ...input.ccEmails, ...input.bccEmails];
    if (all.length > 50) {
      context.addIssue({
        code: 'custom',
        message: 'An email can have at most 50 recipients.',
      });
    }
    if (new Set(all).size !== all.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each recipient can appear only once.',
      });
    }
  });

export const sendEmailInputSchema = z.object({
  draftId: z.string().min(1).max(100),
  toEmails: z.array(emailAddressSchema).min(1).max(20),
  ccEmails: z.array(emailAddressSchema).max(20),
  bccEmails: z.array(emailAddressSchema).max(20),
  subject: z.string().trim().min(1).max(240),
  bodyPreview: z.string().max(320),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export const sendEmailProposalSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('send_email'),
  label: z.string().min(1).max(300),
  input: sendEmailInputSchema,
});
