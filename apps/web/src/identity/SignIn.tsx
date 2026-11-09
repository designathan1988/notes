import { useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark.js';
import { api, json } from '../state/api.js';
import { useWorkspace } from '../state/store.js';
export function SignIn() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      <section className="auth-hero" aria-label="About Mosaic">
        <div className="auth-watermark" aria-hidden="true">
          <BrandMark size={620} />
        </div>
        <div className="auth-brand">
          <BrandMark size={28} />
          <span>Mosaic</span>
        </div>
        <div className="auth-pitch">
          <h2>Documents, data and ideas in one connected workspace.</h2>
          <p>
            Write freely, organize records in real views, and see how every piece fits — with your
            team, in real time.
          </p>
          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-nav">
              <i />
              <i className="wide" />
              <i />
              <i />
              <i data-kind="document" />
              <i />
              <i data-kind="database" />
            </div>
            <div className="auth-preview-doc">
              <i className="title" />
              <i className="sub" />
              <i />
              <i />
              <i className="short" />
              <div className="auth-preview-table">
                <span>
                  <i />
                  <b data-kind="record" />
                  <b data-kind="canvas" />
                </span>
                <span>
                  <i />
                  <b data-kind="document" />
                  <b data-kind="database" />
                </span>
                <span>
                  <i />
                  <b data-kind="record" />
                  <b />
                </span>
              </div>
            </div>
          </div>
        </div>
        <footer>Capture what matters. Connect what comes next.</footer>
      </section>
      <div className="auth-form">
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signup ? 'Start a workspace in under a minute.' : 'Sign in to your workspace.'}</p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              Your name
              <input autoComplete="name" name="name" required maxLength={120} />
            </label>
          )}
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              name="email"
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
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
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {import.meta.env.DEV && (
          <>
            <div className="auth-divider">or</div>
            <button
              className="button demo-button"
              disabled={busy}
              onClick={() => void authenticate('jonathan@note.test', 'Note-local-demo-2026')}
            >
              Open demo workspace
            </button>
          </>
        )}
        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to Mosaic?'}{' '}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSignup(!signup);
              setError('');
            }}
          >
            {signup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </main>
  );
}
