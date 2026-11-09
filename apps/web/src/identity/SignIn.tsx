import { useState, type FormEvent } from 'react';
import { ArrowRight, Database, FileText, LoaderCircle, Network, Shapes } from 'lucide-react';
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
      <section className="auth-hero" aria-label="About Note">
        <div className="auth-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="auth-brand">
          <BrandMark size={30} />
          <span>Note</span>
        </div>
        <div className="auth-pitch">
          <h2>
            Think in pages.
            <br />
            Organize in data.
            <br />
            <span>See the connections.</span>
          </h2>
          <ul>
            <li>
              <FileText size={16} /> Documents that write like a notebook
            </li>
            <li>
              <Database size={16} /> Databases with real views and formulas
            </li>
            <li>
              <Shapes size={16} /> Canvases for spatial thinking
            </li>
            <li>
              <Network size={16} /> A live graph of everything you link
            </li>
          </ul>
        </div>
        <footer>Capture what matters. Connect what comes next.</footer>
      </section>
      <div className="auth-form">
        <h1>{signup ? 'Room for your next idea.' : 'Welcome back.'}</h1>
        <p>A shared space for connected thinking.</p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              Your name
              <input autoComplete="name" name="name" required maxLength={120} />
            </label>
          )}
          <label>
            Email
            <input autoComplete="email" type="email" name="email" required />
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
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <>
                {signup ? 'Create account' : 'Sign in'}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setSignup(!signup);
            setError('');
          }}
        >
          {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
        {import.meta.env.DEV && (
          <button
            className="button demo-button"
            disabled={busy}
            onClick={() => void authenticate('jonathan@note.test', 'Note-local-demo-2026')}
          >
            Open demo workspace <ArrowRight size={16} />
          </button>
        )}
      </div>
    </main>
  );
}
