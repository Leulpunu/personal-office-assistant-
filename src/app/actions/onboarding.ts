'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUserSupabaseContext } from '@/lib/supabase/context';

export type OnboardingActionState = {
  status: 'idle' | 'error';
  message: string;
  errors?: Record<string, string[]>;
};

const createCompanySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Enter your company name.')
    .max(120, 'Company name is too long.'),
  language: z.enum(['en', 'am']),
});

const joinCompanySchema = z.object({
  invitationCode: z
    .string()
    .trim()
    .min(32, 'Enter the complete invitation code.')
    .max(200, 'The invitation code is invalid.'),
});

function validationState(error: z.ZodError): OnboardingActionState {
  return {
    status: 'error',
    message: 'Check the highlighted fields.',
    errors: error.flatten().fieldErrors,
  };
}

function slugifyCompanyName(value: string) {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  return (normalized || 'company') + '-' + randomUUID().slice(0, 6);
}

export async function createCompanyAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = createCompanySchema.safeParse({
    companyName: formData.get('companyName'),
    language: formData.get('language'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const { data: context, error: authError } =
    await createUserSupabaseContext();
  if (authError || !context) {
    return { status: 'error', message: 'Sign in again to continue.' };
  }

  const { error } = await context.supabase.rpc(
    'create_organization_with_owner',
    {
      organization_name: parsed.data.companyName,
      organization_slug: slugifyCompanyName(parsed.data.companyName),
      organization_language: parsed.data.language,
    },
  );

  if (error) {
    return {
      status: 'error',
      message: error.message.includes('already belongs')
        ? 'Your account already belongs to a company.'
        : 'The company workspace could not be created. Please try again.',
    };
  }

  redirect('/');
}

export async function joinCompanyAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = joinCompanySchema.safeParse({
    invitationCode: formData.get('invitationCode'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const { data: context, error: authError } =
    await createUserSupabaseContext();
  if (authError || !context) {
    return { status: 'error', message: 'Sign in again to continue.' };
  }

  const { error } = await context.supabase.rpc(
    'accept_organization_invitation',
    { invitation_token: parsed.data.invitationCode },
  );

  if (error) {
    return {
      status: 'error',
      message: error.message.includes('email address')
        ? 'This invitation belongs to a different email address.'
        : 'The invitation is invalid, expired, or already used.',
    };
  }

  redirect('/');
}
