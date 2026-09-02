import { NextResponse } from 'next/server';
import { createAuthSupabaseClient } from '@/lib/supabase/auth-client';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/onboarding';
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextPath = safeNextPath(url.searchParams.get('next'));
  const supabase = await createAuthSupabaseClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  return NextResponse.redirect(
    new URL('/login?error=confirmation_failed', url.origin),
  );
}
