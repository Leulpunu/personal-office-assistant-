'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  PlugZap,
  Save,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  EMAIL_PROVIDER_PRESETS,
  getEmailProviderPreset,
} from '@/lib/email/providers';
import type {
  CompanyEmailSettingsDTO,
  CompanyEmailSettingsInput,
  EmailProvider,
} from '@/types/email-settings';

type EmailProviderSettingsProps = {
  companyName: string;
  canManage: boolean;
};

type SettingsResponse = {
  settings?: CompanyEmailSettingsDTO | null;
  connected?: boolean;
  testedAt?: string;
  message?: string;
  error?: { message?: string; code?: string };
};

function emptySettings(provider: EmailProvider = 'gmail') {
  const preset = getEmailProviderPreset(provider);
  return {
    provider,
    host: preset.host,
    port: preset.port,
    secure: preset.secure,
    requireTls: preset.requireTls,
    username: '',
    password: '',
    fromName: 'Muna Office',
    fromEmail: '',
    replyTo: '',
  } satisfies Required<CompanyEmailSettingsInput>;
}

function draftFromSettings(settings: CompanyEmailSettingsDTO) {
  return {
    provider: settings.provider,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTls: settings.requireTls,
    username: settings.username,
    password: '',
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo,
  } satisfies Required<CompanyEmailSettingsInput>;
}

async function responsePayload(response: Response) {
  return (await response.json().catch(() => ({}))) as SettingsResponse;
}

export default function EmailProviderSettings({
  companyName,
  canManage,
}: EmailProviderSettingsProps) {
  const [settings, setSettings] = useState<CompanyEmailSettingsDTO | null>(null);
  const [draft, setDraft] = useState(() => emptySettings());
  const [loading, setLoading] = useState(canManage);
  const [busy, setBusy] = useState<'save' | 'test' | 'remove' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const preset = useMemo(
    () => getEmailProviderPreset(draft.provider),
    [draft.provider],
  );

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    void fetch('/api/email-settings', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await responsePayload(response);
        if (!response.ok) {
          throw new Error(payload.error?.message || 'Unable to load email settings.');
        }
        if (!active) return;
        const nextSettings = payload.settings || null;
        setSettings(nextSettings);
        if (nextSettings) setDraft(draftFromSettings(nextSettings));
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load email settings.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canManage]);

  function chooseProvider(provider: EmailProvider) {
    const nextPreset = getEmailProviderPreset(provider);
    setDraft((current) => ({
      ...current,
      provider,
      host: nextPreset.host,
      port: nextPreset.port,
      secure: nextPreset.secure,
      requireTls: nextPreset.requireTls,
    }));
    setError('');
    setNotice('');
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = await responsePayload(response);
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error?.message || 'Unable to save email settings.');
      }
      setSettings(payload.settings);
      setDraft(draftFromSettings(payload.settings));
      setNotice(
        'Email settings saved securely. Test the connection before sending.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to save email settings.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    setBusy('test');
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/email-settings', { method: 'POST' });
      const payload = await responsePayload(response);
      if (!response.ok || !payload.connected) {
        throw new Error(payload.error?.message || 'Connection test failed.');
      }
      setSettings((current) =>
        current
          ? {
              ...current,
              lastTestedAt: payload.testedAt || new Date().toISOString(),
              lastTestStatus: 'passed',
              lastTestError: null,
            }
          : current,
      );
      setNotice(payload.message || 'Email provider connection succeeded.');
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Connection test failed.';
      setError(message);
      setSettings((current) =>
        current
          ? {
              ...current,
              lastTestedAt: new Date().toISOString(),
              lastTestStatus: 'failed',
              lastTestError: message,
            }
          : current,
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeSettings() {
    if (!window.confirm('Remove this company email connection?')) return;
    setBusy('remove');
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/email-settings', { method: 'DELETE' });
      const payload = await responsePayload(response);
      if (!response.ok) {
        throw new Error(payload.error?.message || 'Unable to remove email settings.');
      }
      setSettings(null);
      setDraft(emptySettings());
      setNotice('The company email connection was removed.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to remove email settings.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!canManage) {
    return (
      <main className="email-settings-shell">
        <section className="email-settings-denied">
          <LockKeyhole size={32} />
          <h1>Owner access required</h1>
          <p>Only the company owner can view or change email credentials.</p>
          <Link href="/"><ArrowLeft size={16} /> Return to Muna</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="email-settings-shell">
      <header className="email-settings-topbar">
        <Link href="/" className="email-settings-brand">
          <span>M</span><strong>Muna</strong><small>Office</small>
        </Link>
        <div><small>Company workspace</small><strong>{companyName}</strong></div>
      </header>

      <div className="email-settings-layout">
        <aside className="email-settings-intro">
          <Link href="/"><ArrowLeft size={15} /> Back to dashboard</Link>
          <span className="settings-kicker">Email delivery</span>
          <h1>Connect your company mailbox</h1>
          <p>
            Muna works with standard SMTP providers. Credentials are encrypted
            before storage and are never returned to the browser.
          </p>
          <ul>
            <li><ShieldCheck size={17} /><span><strong>Human approval</strong> remains required before every send.</span></li>
            <li><LockKeyhole size={17} /><span><strong>Encrypted password</strong> protected with a server-only key.</span></li>
            <li><Server size={17} /><span><strong>Company isolated</strong> connection shared only for approved delivery.</span></li>
          </ul>
        </aside>

        <section className="email-settings-card">
          <div className="email-settings-heading">
            <div>
              <span className="settings-icon"><MailCheck size={22} /></span>
              <div><h2>Email provider</h2><p>Choose a preset or enter a custom SMTP server.</p></div>
            </div>
            {settings?.lastTestStatus === 'passed' ? (
              <span className="connection-badge connected"><CheckCircle2 size={14} /> Connected</span>
            ) : settings ? (
              <span className="connection-badge">Saved, not tested</span>
            ) : null}
          </div>

          {loading ? (
            <div className="settings-loading"><LoaderCircle size={24} /> Loading secure settings…</div>
          ) : (
            <form className="email-settings-form" onSubmit={saveSettings}>
              <label className="settings-full-field">
                Provider
                <select value={draft.provider} onChange={(event) => chooseProvider(event.target.value as EmailProvider)} disabled={Boolean(busy)}>
                  {EMAIL_PROVIDER_PRESETS.map((provider) => <option value={provider.id} key={provider.id}>{provider.label}</option>)}
                </select>
                <small>{preset.description}</small>
              </label>

              <div className="settings-fields-row">
                <label>
                  SMTP hostname
                  <input required value={draft.host} readOnly={preset.endpointLocked} onChange={(event) => setDraft((current) => ({ ...current, host: event.target.value }))} placeholder="smtp.company.com" />
                </label>
                <label>
                  Port
                  <input required type="number" min={1} max={65535} value={draft.port} readOnly={preset.endpointLocked} onChange={(event) => setDraft((current) => ({ ...current, port: Number(event.target.value) }))} />
                </label>
              </div>

              <div className="settings-checks">
                <label><input type="checkbox" checked={draft.secure} disabled={preset.endpointLocked || Boolean(busy)} onChange={(event) => setDraft((current) => ({ ...current, secure: event.target.checked, requireTls: event.target.checked ? false : current.requireTls }))} /><span><strong>Implicit TLS</strong><small>Normally used with port 465.</small></span></label>
                <label><input type="checkbox" checked={draft.requireTls} disabled={preset.endpointLocked || draft.secure || Boolean(busy)} onChange={(event) => setDraft((current) => ({ ...current, requireTls: event.target.checked }))} /><span><strong>Require STARTTLS</strong><small>Recommended for port 587.</small></span></label>
              </div>

              <div className="settings-section-title"><KeyRound size={16} /><span>Mailbox credentials</span></div>
              <div className="settings-fields-row">
                <label>
                  Username
                  <input required autoComplete="username" value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} placeholder="office@company.com" />
                </label>
                <label>
                  {preset.passwordLabel}
                  <input required={!settings} type="password" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} placeholder={settings ? 'Leave blank to keep saved password' : 'Enter password'} />
                </label>
              </div>
              <p className="settings-secret-note"><LockKeyhole size={13} /> A saved password is never displayed again. Enter a new one only to replace it.</p>
              {draft.provider === 'gmail' && (
                <p className="settings-secret-note">
                  <KeyRound size={13} /> Gmail requires a 16-digit app password,
                  not your normal Google password. Turn on 2-Step Verification,
                  then{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                  >
                    create an app password
                  </a>
                  .
                </p>
              )}

              <div className="settings-section-title"><MailCheck size={16} /><span>Sender identity</span></div>
              <div className="settings-fields-row">
                <label>
                  Sender name
                  <input required value={draft.fromName} onChange={(event) => setDraft((current) => ({ ...current, fromName: event.target.value }))} placeholder="Muna Office" />
                </label>
                <label>
                  Sender email
                  <input required type="email" value={draft.fromEmail} onChange={(event) => setDraft((current) => ({ ...current, fromEmail: event.target.value }))} placeholder="office@company.com" />
                </label>
              </div>
              <label className="settings-full-field">
                Reply-to email (optional)
                <input type="email" value={draft.replyTo} onChange={(event) => setDraft((current) => ({ ...current, replyTo: event.target.value }))} placeholder="support@company.com" />
              </label>

              {error && <div className="settings-message error" role="alert">{error}</div>}
              {notice && <div className="settings-message success" role="status">{notice}</div>}
              {settings?.lastTestedAt && (
                <p className="settings-tested-at">
                  Last tested {new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settings.lastTestedAt))}
                  {settings.lastTestStatus === 'failed' && settings.lastTestError ? ' — ' + settings.lastTestError : ''}
                </p>
              )}

              <div className="email-settings-actions">
                {settings && <button type="button" className="settings-remove" disabled={Boolean(busy)} onClick={() => void removeSettings()}><Trash2 size={15} />{busy === 'remove' ? 'Removing…' : 'Remove'}</button>}
                <button type="button" className="settings-test" disabled={Boolean(busy) || !settings} onClick={() => void testConnection()}><PlugZap size={16} />{busy === 'test' ? 'Testing…' : 'Test connection'}</button>
                <button type="submit" className="primary-button" disabled={Boolean(busy)}><Save size={16} />{busy === 'save' ? 'Saving…' : 'Save securely'}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
