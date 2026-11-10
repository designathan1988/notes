import { LanguagePicker } from '../i18n/LanguagePicker.js';
import { t } from '../i18n/index.js';
import { useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark.js';
import { AuthIllustration } from './AuthIllustration.js';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
export function SignIn() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Someone following an invitation link is told why they are asked to sign in first.
  const invited =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('invite');
  async function authenticate(email: string, password: string, name?: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/auth/${signup && name ? 'sign-up' : 'sign-in'}/email`, {
        method: 'POST',
        body: json({ email, password, name }),
      });
      await useWorkspace.getState().initialize();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void authenticate(
      String(data.get('email')),
      String(data.get('password')),
      String(data.get('name') ?? ''),
    );
  }
  return (
    <main className="auth-screen">
      <section className="auth-hero" aria-label={t('About Sinapta')}>
        <div className="auth-watermark" aria-hidden="true">
          <BrandMark size={620} />
        </div>
        <div className="auth-brand">
          <BrandMark size={28} />
          <span>Sinapta</span>
        </div>
        <div className="auth-pitch">
          <h2>{t('Documents, data and ideas in one connected workspace.')}</h2>
          <p>
            {t(
              'Write freely, organize records in real views, and see how every piece fits — with your team, in real time.',
            )}
          </p>
          <AuthIllustration />
        </div>
        <footer>{t('Capture what matters. Connect what comes next.')}</footer>
      </section>
      <div className="auth-form">
        <LanguagePicker />
        <h1>{signup ? t('Create your account') : t('Welcome back')}</h1>
        <p>
          {invited
            ? t('Sign in or create an account to accept your invitation.')
            : signup
              ? t('Start a workspace in under a minute.')
              : t('Sign in to your workspace.')}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              {t('Your name')}
              <input autoComplete="name" name="name" required maxLength={120} />
            </label>
          )}
          <label>
            {t('Email')}
            <input
              autoComplete="email"
              type="email"
              name="email"
              placeholder={t('you@company.com')}
              required
            />
          </label>
          <label>
            {t('Password')}
            <input
              autoComplete={signup ? 'new-password' : 'current-password'}
              type="password"
              name="password"
              minLength={10}
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : signup ? t('Create account') : t('Sign in')}
          </button>
        </form>
        {import.meta.env.DEV && (
          <>
            <div className="auth-divider">{t('or')}</div>
            <button
              className="button demo-button"
              disabled={busy}
              onClick={() => void authenticate('jonathan@note.test', 'Note-local-demo-2026')}
            >
              {t('Open demo workspace')}
            </button>
          </>
        )}
        <p className="auth-switch">
          {signup ? t('Already have an account?') : t('New to Sinapta?')}{' '}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSignup(!signup);
              setError('');
            }}
          >
            {signup ? t('Sign in') : t('Create an account')}
          </button>
        </p>
      </div>
    </main>
  );
}
