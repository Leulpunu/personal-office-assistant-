'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthSupabaseClient } from '@/lib/supabase/auth-client';

export type AuthActionState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  errors?: Record<string, string[]>;
};

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const signupSchema = loginSchema.extend({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(120, 'Your name is too long.'),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
});

function validationState(error: z.ZodError): AuthActionState {
  return {
    status: 'error',
    message: 'Check the highlighted fields.',
    errors: error.flatten().fieldErrors,
  };
}

async function getCallbackUrl() {
  const requestHeaders = await headers();
  const requestOrigin = requestHeaders.get('origin');
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = requestOrigin || configuredOrigin || 'http://localhost:3000';

  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return new URL('/auth/callback?next=/onboarding', url).toString();
  } catch {
    return 'http://localhost:3000/auth/callback?next=/onboarding';
  }
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const supabase = await createAuthSupabaseClient();
  if (!supabase) {
    return {
      status: 'error',
      message: 'Company authentication is not configured yet.',
    };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      status: 'error',
      message: 'The email or password is incorrect.',
    };
  }

  redirect('/onboarding');
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const supabase = await createAuthSupabaseClient();
  if (!supabase) {
    return {
      status: 'error',
      message: 'Company authentication is not configured yet.',
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: await getCallbackUrl(),
    },
  });

  if (error) {
    return {
      status: 'error',
      message: 'The account could not be created. Try another email or password.',
    };
  }

  if (data.session) redirect('/onboarding');

  return {
    status: 'success',
    message: 'Check your email to confirm your account, then sign in.',
  };
}

export async function signOutAction() {
  const supabase = await createAuthSupabaseClient();
  if (supabase) await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
