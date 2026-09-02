import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabasePublicConfig,
  isDemoModeEnabled,
} from '@/lib/supabase/config';
import { createUserSupabaseContext } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

export type WorkspaceRole = 'owner' | 'manager' | 'employee';

export type WorkspaceContext = {
  mode: 'demo' | 'supabase';
  userId: string;
  organizationId: string;
  organizationName: string;
  timezone: string;
  role: WorkspaceRole;
  userName: string;
  supabase: SupabaseClient<Database> | null;
  supabaseAdmin: SupabaseClient<Database> | null;
};

export type WorkspaceContextResult =
  | { data: WorkspaceContext; error: null }
  | {
      data: null;
      error: Error & { status?: number; code?: string };
    };

function workspaceError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

export async function getWorkspaceContext(): Promise<WorkspaceContextResult> {
  const publicConfig = getSupabasePublicConfig();

  if (!publicConfig) {
    if (!isDemoModeEnabled()) {
      return {
        data: null,
        error: workspaceError(
          'The company backend is not configured.',
          503,
          'BACKEND_NOT_CONFIGURED',
        ),
      };
    }

    return {
      data: {
        mode: 'demo',
        userId: 'demo-user',
        organizationId: 'demo-meron-trading',
        organizationName: 'Meron Trading PLC',
        timezone: 'Africa/Addis_Ababa',
        role: 'owner',
        userName: 'Selam Alemu',
        supabase: null,
        supabaseAdmin: null,
      },
      error: null,
    };
  }

  const { data: userContext, error: authError } =
    await createUserSupabaseContext();
  if (authError || !userContext) {
    return { data: null, error: authError };
  }

  const { data: membership, error: membershipError } =
    await userContext.supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userContext.userId)
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    return {
      data: null,
      error: workspaceError(
        'Unable to load the company membership.',
        500,
        'MEMBERSHIP_LOOKUP_FAILED',
      ),
    };
  }

  if (!membership) {
    return {
      data: null,
      error: workspaceError(
        'Your account does not belong to a company yet.',
        403,
        'WORKSPACE_REQUIRED',
      ),
    };
  }

  const [organizationResult, profileResult] = await Promise.all([
    userContext.supabase
      .from('organizations')
      .select('id, name, timezone')
      .eq('id', membership.organization_id)
      .single(),
    userContext.supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userContext.userId)
      .maybeSingle(),
  ]);
  const { data: organization, error: organizationError } =
    organizationResult;

  if (organizationError || !organization) {
    return {
      data: null,
      error: workspaceError(
        'Unable to load the company workspace.',
        500,
        'WORKSPACE_LOOKUP_FAILED',
      ),
    };
  }

  return {
    data: {
      mode: 'supabase',
      userId: userContext.userId,
      organizationId: organization.id,
      organizationName: organization.name,
      timezone: organization.timezone,
      role: membership.role,
      userName:
        profileResult.data?.full_name ||
        userContext.userEmail.split('@')[0] ||
        'Team member',
      supabase: userContext.supabase,
      supabaseAdmin: userContext.supabaseAdmin,
    },
    error: null,
  };
}
