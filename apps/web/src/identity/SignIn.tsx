import { LanguagePicker } from '../i18n/LanguagePicker.js';
import { formatRelative, t } from '../i18n/index.js';
import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, FileText, LoaderCircle, Lock, Mail } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark.js';
import { SignInIllustration } from './SignInIllustration.js';
import { forgetReturning, readReturning, startRemembering, type Returning } from './remembered.js';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
import { pageView } from '../workbench/route.js';
import './sign-in.css';

startRemembering();

function greeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return t('Good morning');
  if (hour >= 12 && hour < 18) return t('Good afternoon');
  return t('Good evening');
}

function since(at: number) {
  const minutes = Math.round((at - Date.now()) / 60000);
  if (minutes > -60) return formatRelative(Math.min(minutes, 0), 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return formatRelative(hours, 'hour');
  return formatRelative(Math.round(hours / 24), 'day');
}

export function SignIn() {
  const [returning, setReturning] = useState<Returning | null>(readReturning);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reveal, setReveal] = useState(false);
  const [keep, setKeep] = useState(true);
  const [landing, setLanding] = useState<'page' | 'home'>('page');
  // Someone following an invitation link is told why they are asked to sign in first.
  const invited =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('invite');
  const known = returning && !signup ? returning : null;

  async function authenticate(email: string, password: string, name?: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/auth/${signup && name ? 'sign-up' : 'sign-in'}/email`, {
        method: 'POST',
        body: json(
          signup && name ? { email, password, name } : { email, password, rememberMe: keep },
        ),
      });
      await useWorkspace.getState().initialize();
      const state = useWorkspace.getState();
      if (known?.email === email && !invited) {
        if (landing === 'home') state.navigate(null, 'home', 'replace');
        else if (known.page && state.pages.some((page) => page.id === known.page?.id))
          state.navigate(known.page.id, pageView(known.page.kind), 'replace');
      }
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
      known ? known.email : String(data.get('email')),
      String(data.get('password')),
      String(data.get('name') ?? ''),
    );
  }
  function anotherAccount() {
    forgetReturning();
    setReturning(null);
    setError('');
  }

  const title = signup
    ? t('Create your account')
    : known
      ? t('Good to see you again, {{name}}.', { name: known.name.split(' ')[0] })
      : t('Welcome back');
  const lede = invited
    ? t('Sign in or create an account to accept your invitation.')
    : signup
      ? t('Start a workspace in under a minute.')
      : known?.workspace
        ? t('{{workspace}} is just as you left it.', { workspace: known.workspace })
        : t('Sign in to your workspace.');

  return (
    <main className="sign-in">
      <section className="sign-in-side">
        <header className="sign-in-top">
          <span className="sign-in-brand">
            <BrandMark size={22} />
            Sinapta
          </span>
          <LanguagePicker />
        </header>
        <div className="sign-in-body">
          {!signup && (
            <span className="sign-in-kicker">
              <i />
              {greeting()}
            </span>
          )}
          <h1>{title}</h1>
          <p className="sign-in-lede">{lede}</p>
          <form onSubmit={submit} noValidate={false}>
            {known ? (
              <div className="sign-in-account">
                <span className="avatar" aria-hidden="true">
                  {known.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="who">
                  <b>{known.name}</b>
                  <small>{known.email}</small>
                </span>
                <button type="button" className="switch" onClick={anotherAccount}>
                  {t('Switch')}
                </button>
              </div>
            ) : (
              <>
                {signup && (
                  <label className="sign-in-field">
                    <span>{t('Your name')}</span>
                    <span className="control">
                      <input autoComplete="name" name="name" required maxLength={120} />
                    </span>
                  </label>
                )}
                <label className="sign-in-field">
                  <span>{t('Email')}</span>
                  <span className="control">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      autoComplete="email"
                      type="email"
                      name="email"
                      placeholder={t('you@company.com')}
                      required
                    />
                  </span>
                </label>
              </>
            )}
            <label className="sign-in-field">
              <span>{t('Password')}</span>
              <span className="control">
                <Lock size={16} aria-hidden="true" />
                <input
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  type={reveal ? 'text' : 'password'}
                  name="password"
                  minLength={10}
                  required
                  autoFocus={Boolean(known)}
                />
                <button
                  type="button"
                  className="reveal"
                  aria-label={reveal ? t('Hide password') : t('Show password')}
                  aria-pressed={reveal}
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {!signup && (
              <label className="sign-in-keep">
                <input
                  type="checkbox"
                  checked={keep}
                  onChange={(event) => setKeep(event.target.checked)}
                />
                <span className="box" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
                {t('Keep me signed in on this computer')}
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
            <button className="sign-in-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" />
              ) : signup ? (
                t('Create account')
              ) : (
                t('Sign in')
              )}
              {!busy && <kbd aria-hidden="true">↵</kbd>}
            </button>
          </form>
          {known?.page && !invited && (
            <div className="sign-in-resume">
              <span className="icon" aria-hidden="true">
                <FileText size={16} />
              </span>
              <span className="text">
                <small>
                  {landing === 'page'
                    ? t('After signing in, continue in')
                    : t('After signing in, go to')}
                </small>
                <b>
                  {landing === 'page' ? known.page.title || t('Untitled') : t('Home')}
                  {landing === 'page' && <span> · {since(known.page.at)}</span>}
                </b>
              </span>
              <button
                type="button"
                onClick={() => setLanding(landing === 'page' ? 'home' : 'page')}
              >
                {landing === 'page' ? t('Go to Home instead') : t('Continue where I left off')}
              </button>
            </div>
          )}
          {import.meta.env.DEV && (
            <>
              <div className="sign-in-or">{t('or')}</div>
              <button
                type="button"
                className="sign-in-demo"
                disabled={busy}
                onClick={() => void authenticate('jonathan@note.test', 'Note-local-demo-2026')}
              >
                {t('Open demo workspace')}
              </button>
            </>
          )}
          <p className="sign-in-switch">
            {known ? (
              <button type="button" onClick={anotherAccount}>
                {t('Use another account')}
              </button>
            ) : (
              <>
                {signup ? t('Already have an account?') : t('New to Sinapta?')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSignup(!signup);
                    setError('');
                  }}
                >
                  {signup ? t('Sign in') : t('Create an account')}
                </button>
              </>
            )}
          </p>
        </div>
        <footer className="sign-in-foot">
          <span>
            <i />
            {t('Secure connection')}
          </span>
        </footer>
      </section>
      <SignInIllustration />
    </main>
  );
}
