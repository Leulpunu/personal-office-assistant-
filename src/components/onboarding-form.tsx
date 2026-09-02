'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Building2, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import {
  createCompanyAction,
  joinCompanyAction,
  type OnboardingActionState,
} from '@/app/actions/onboarding';

const initialState: OnboardingActionState = {
  status: 'idle',
  message: '',
};

export default function OnboardingForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [createState, createFormAction, createPending] = useActionState(
    createCompanyAction,
    initialState,
  );
  const [joinState, joinFormAction, joinPending] = useActionState(
    joinCompanyAction,
    initialState,
  );
  const state = mode === 'create' ? createState : joinState;
  const pending = createPending || joinPending;

  return (
    <main className="onboarding-shell">
      <header className="onboarding-topbar">
        <div className="auth-brand dark">
          <span><Sparkles size={20} /></span>
          <strong>Muna</strong>
          <small>office</small>
        </div>
        <div><strong>{fullName || 'New member'}</strong><small>{email}</small></div>
      </header>

      <section className="onboarding-card">
        <div className="onboarding-progress"><span>1</span><i /><span className="active">2</span><i /><span>3</span></div>
        <p className="auth-kicker">Step 2 of 3</p>
        <h1>Set up your company workspace</h1>
        <p className="onboarding-intro">Company data stays inside its own workspace. Create one as an owner or join securely with an invitation.</p>

        <div className="onboarding-choice">
          <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
            <Building2 size={20} /><span><strong>Create company</strong><small>Start a new workspace as owner</small></span>
          </button>
          <button type="button" className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>
            <KeyRound size={20} /><span><strong>Join company</strong><small>Use a code sent to your email</small></span>
          </button>
        </div>

        {mode === 'create' ? (
          <form action={createFormAction} className="auth-form onboarding-form">
            <label>
              Company name
              <input name="companyName" placeholder="Meron Trading PLC" required />
              {state.errors?.companyName?.map((error) => <small className="field-error" key={error}>{error}</small>)}
            </label>
            <label>
              Default language
              <select name="language" defaultValue="en">
                <option value="en">English</option>
                <option value="am">አማርኛ</option>
              </select>
            </label>
            {state.message && <div className="auth-notice error">{state.message}</div>}
            <button className="auth-submit" type="submit" disabled={pending}>
              {pending ? 'Creating workspace…' : 'Create company'}
              {!pending && <ArrowRight size={17} />}
            </button>
          </form>
        ) : (
          <form action={joinFormAction} className="auth-form onboarding-form">
            <label>
              Invitation code
              <input name="invitationCode" autoComplete="off" placeholder="Paste the code from your company owner" required />
              {state.errors?.invitationCode?.map((error) => <small className="field-error" key={error}>{error}</small>)}
            </label>
            <div className="invite-security"><ShieldCheck size={18} /><span>The code is single-use, expires automatically, and only works for <strong>{email}</strong>.</span></div>
            {state.message && <div className="auth-notice error">{state.message}</div>}
            <button className="auth-submit" type="submit" disabled={pending}>
              {pending ? 'Joining company…' : 'Join workspace'}
              {!pending && <ArrowRight size={17} />}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
