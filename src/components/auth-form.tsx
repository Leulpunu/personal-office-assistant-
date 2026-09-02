'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowRight, Building2, LockKeyhole, Sparkles } from 'lucide-react';
import {
  loginAction,
  signupAction,
  type AuthActionState,
} from '@/app/actions/auth';

const initialState: AuthActionState = {
  status: 'idle',
  message: '',
};

type AuthFormProps = {
  backendConfigured: boolean;
  demoAvailable: boolean;
  confirmationFailed: boolean;
};

export default function AuthForm({
  backendConfigured,
  demoAvailable,
  confirmationFailed,
}: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialState,
  );
  const [signupState, signupFormAction, signupPending] = useActionState(
    signupAction,
    initialState,
  );
  const state = mode === 'login' ? loginState : signupState;
  const pending = loginPending || signupPending;

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span><Sparkles size={22} /></span>
          <strong>Muna</strong>
          <small>office</small>
        </div>
        <div className="auth-story-copy">
          <p className="auth-kicker">Built for Ethiopian teams</p>
          <h1>Your company’s work, organized by an agent you control.</h1>
          <p>Plan work in English or Amharic, keep every company separate, and approve actions before Muna carries them out.</p>
          <div className="auth-trust-row">
            <span><Building2 size={17} /> Company workspaces</span>
            <span><LockKeyhole size={17} /> Human approval</span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-heading">
            <p>{mode === 'login' ? 'Welcome back' : 'Create your account'}</p>
            <h2>{mode === 'login' ? 'Sign in to Muna' : 'Start your company workspace'}</h2>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Register</button>
          </div>

          {!backendConfigured && (
            <div className="auth-notice warning">Supabase is not configured. Add the values from <code>.env.example</code> to enable company accounts.</div>
          )}
          {confirmationFailed && (
            <div className="auth-notice error">That confirmation link is invalid or expired. Register again to request a new link.</div>
          )}

          <form action={mode === 'login' ? loginFormAction : signupFormAction} className="auth-form">
            {mode === 'signup' && (
              <label>
                Full name
                <input name="fullName" autoComplete="name" placeholder="Selam Alemu" required />
                {state.errors?.fullName?.map((error) => <small className="field-error" key={error}>{error}</small>)}
              </label>
            )}
            <label>
              Work email
              <input name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
              {state.errors?.email?.map((error) => <small className="field-error" key={error}>{error}</small>)}
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Your password' : '10+ characters with a number'} required />
              {state.errors?.password?.map((error) => <small className="field-error" key={error}>{error}</small>)}
            </label>

            {state.message && <div className={`auth-notice ${state.status}`}>{state.message}</div>}

            <button className="auth-submit" type="submit" disabled={pending || !backendConfigured}>
              {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!pending && <ArrowRight size={17} />}
            </button>
          </form>

          {demoAvailable && (
            <Link className="demo-link" href="/">Continue with the local demo <ArrowRight size={15} /></Link>
          )}
        </div>
      </section>
    </main>
  );
}
