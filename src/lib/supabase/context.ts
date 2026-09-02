import 'server-only';

import { createServerClient } from '@supabase/ssr';
import {
  createAdminClient,
  createContextClient,
  verifyCredentials,
} from '@supabase/server/core';
import type { SupabaseEnv } from '@supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabasePublicConfig } from '@/lib/supabase/config';
import type { Database } from '@/types/database';

export type UserSupabaseContext = {
  supabase: SupabaseClient<Database>;
  supabaseAdmin: SupabaseClient<Database>;
  userId: string;
  userEmail: string;
};

type ContextResult =
  | { data: UserSupabaseContext; error: null }
  | { data: null; error: Error & { status?: number; code?: string } };

let cachedJwks: SupabaseEnv['jwks'] = null;

function resolveNextEnv(): Partial<SupabaseEnv> | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const secretKey = process.env.SUPABASE_SECRET_KEY;
  return {
    url: config.url,
    publishableKeys: { default: config.publishableKey },
    secretKeys: secretKey ? { default: secretKey } : {},
  };
}

async function getJwks(supabaseUrl: string): Promise<SupabaseEnv['jwks']> {
  if (cachedJwks) return cachedJwks;

  const inlineJwks = process.env.SUPABASE_JWKS;
  if (inlineJwks) {
    try {
      const parsed = JSON.parse(inlineJwks) as SupabaseEnv['jwks'];
      cachedJwks = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(
      supabaseUrl + '/auth/v1/.well-known/jwks.json',
      { cache: 'force-cache' },
    );
    if (!response.ok) return null;
    cachedJwks = (await response.json()) as SupabaseEnv['jwks'];
    return cachedJwks;
  } catch {
    return null;
  }
}

export async function createUserSupabaseContext(): Promise<ContextResult> {
  const nextEnv = resolveNextEnv();
  if (!nextEnv?.url || !nextEnv.publishableKeys?.default) {
    return {
      data: null,
      error: Object.assign(new Error('Supabase is not configured.'), {
        status: 503,
        code: 'SUPABASE_NOT_CONFIGURED',
      }),
    };
  }

  const cookieStore = await cookies();
  const ssrClient = createServerClient<Database>(
    nextEnv.url,
    nextEnv.publishableKeys.default,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Proxy owns refresh-cookie writes for Server Component requests.
          }
        },
      },
    },
  );

  const {
    data: { session },
  } = await ssrClient.auth.getSession();

  const env: Partial<SupabaseEnv> = {
    ...nextEnv,
    jwks: await getJwks(nextEnv.url),
  };
  const { data: auth, error } = await verifyCredentials(
    { token: session?.access_token ?? null, apikey: null },
    { auth: 'user', env },
  );

  if (error || !auth?.token || !auth.userClaims?.id) {
    return {
      data: null,
      error:
        error ??
        Object.assign(new Error('Authentication is required.'), {
          status: 401,
          code: 'AUTH_REQUIRED',
        }),
    };
  }

  try {
    return {
      data: {
        supabase: createContextClient<Database>({
          auth: { token: auth.token, keyName: auth.keyName },
          env,
        }),
        supabaseAdmin: createAdminClient<Database>({ env }),
        userId: auth.userClaims.id,
        userEmail:
          typeof auth.userClaims.email === 'string'
            ? auth.userClaims.email
            : '',
      },
      error: null,
    };
  } catch (caught) {
    return {
      data: null,
      error:
        caught instanceof Error
          ? caught
          : Object.assign(new Error('Unable to create the Supabase client.'), {
              status: 500,
            }),
    };
  }
}
