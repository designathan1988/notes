import { Check, Database, Feather, ShieldCheck } from 'lucide-react';
import { t } from '../i18n/index.js';

const NERVES = (
  <g
    fill="none"
    stroke="currentColor"
    strokeWidth="6.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8.5 13.5c7.4 0 12.6 4.4 13.6 10.5-1 6.1-6.2 10.5-13.6 10.5" />
    <path d="M39.5 13.5c-7.4 0-12.6 4.4-13.6 10.5 1 6.1 6.2 10.5 13.6 10.5" />
  </g>
);

/**
 * The product explaining itself: a highlighted passage passes through the synapse, where the
 * signal is, and reaches its source, a database, a verified badge and the graph.
 * Decorative only; the sign-in form never depends on it.
 */
export function SignInIllustration() {
  return (
    <section className="sign-in-art" aria-hidden="true">
      <div className="sign-in-stage">
        <svg className="sign-in-wires" viewBox="0 0 880 900" preserveAspectRatio="none">
          <defs>
            <marker
              id="sign-in-dot"
              viewBox="0 0 8 8"
              refX="4"
              refY="4"
              markerWidth="8"
              markerHeight="8"
            >
              <circle cx="4" cy="4" r="3" className="signal" />
            </marker>
            <marker
              id="sign-in-end"
              viewBox="0 0 8 8"
              refX="4"
              refY="4"
              markerWidth="7"
              markerHeight="7"
            >
              <circle cx="4" cy="4" r="2.6" className="ink" />
            </marker>
          </defs>
          <path
            className="wire signal"
            d="M452 226 C 482 230, 494 268, 500 300"
            markerStart="url(#sign-in-dot)"
          />
          <path
            className="wire"
            d="M574 330 C 620 300, 640 250, 652 236"
            markerEnd="url(#sign-in-end)"
          />
          <path
            className="wire signal"
            d="M574 372 C 610 396, 626 420, 640 440"
            markerEnd="url(#sign-in-dot)"
          />
          <path
            className="wire"
            d="M534 412 C 548 480, 560 540, 590 586"
            markerEnd="url(#sign-in-end)"
          />
          <path className="wire dashed" d="M300 446 C 300 540, 250 600, 230 652" />
          <g transform="translate(150 640)" className="sign-in-graph">
            <path
              className="edge"
              d="M80 18 30 52M80 18 132 40M80 18 92 84M30 52 0 96M132 40 170 70M92 84 150 110"
            />
            <circle cx="80" cy="18" r="13" className="halo" />
            <circle cx="80" cy="18" r="6.5" className="ink" />
            <circle cx="30" cy="52" r="4.5" className="ink soft" />
            <circle cx="132" cy="40" r="5" className="signal" />
            <circle cx="92" cy="84" r="4.5" className="blue" />
            <circle cx="0" cy="96" r="3" className="faint" />
            <circle cx="170" cy="70" r="3" className="blue" />
            <circle cx="150" cy="110" r="3" className="rose" />
          </g>
        </svg>

        <div className="sign-in-capture">
          <Feather size={14} />
          {t('Capture from anywhere')}
          <kbd>Ctrl ⇧ {t('Space')}</kbd>
        </div>

        <article className="sign-in-sheet">
          <div className="kind">
            <i />
            {t('Page')} · Product
          </div>
          <h3>Product direction</h3>
          <p>
            {t('Keep the')} <mark>{t('clarity of a document')}</mark>
            <span className="cite">1</span>
            {t(', the structure of a database and the context of a connected knowledge base.')}
          </p>
          <div className="bars">
            <i style={{ width: '100%' }} />
            <i style={{ width: '88%' }} />
            <i style={{ width: '62%' }} />
          </div>
          <div className="todo done">
            <span className="box">
              <Check size={10} strokeWidth={3} />
            </span>
            <s>{t('Make space for focused thinking')}</s>
          </div>
          <div className="todo done">
            <span className="box">
              <Check size={10} strokeWidth={3} />
            </span>
            <s>{t('Keep information connected')}</s>
          </div>
          <div className="todo">
            <span className="box" />
            {t('Build with care, not complexity')}
          </div>
        </article>

        <div className="sign-in-hub">
          <svg viewBox="4 9 40 30">
            {NERVES}
            <circle cx="24" cy="24" r="4.2" className="signal" />
          </svg>
        </div>

        <div className="sign-in-node database">
          <div className="head">
            <Database size={15} />
            Research
            <small>{t('{{count}} records', { count: 8 })}</small>
          </div>
          <div className="rows">
            <div>
              <i className="blue" />
              User interviews<em>{t('In progress')}</em>
            </div>
            <div>
              <i className="green" />
              Design principles<em>Evergreen</em>
            </div>
            <div>
              <i className="signal" />
              Reading list<em>{t('Active')}</em>
            </div>
          </div>
        </div>

        <div className="sign-in-node source">
          <div className="head">
            <span className="pdf">PDF</span>
            <span>
              <b>interviews-2026.pdf</b>
              <small>{t('Source 1 · 14 pages')}</small>
            </span>
          </div>
          <p>{t('“Clarity comes before structure.” · p. 6')}</p>
        </div>

        <div className="sign-in-verified">
          <span className="seal">
            <ShieldCheck size={16} />
          </span>
          <span>
            <b>{t('Verified')}</b>
            <small>{t('3 of 3 claims with a source')}</small>
          </span>
        </div>

        <div className="sign-in-caption">
          <div>
            <b>{t('Ideas become useful when they connect.')}</b>
            <small>{t('Write it down, link each idea to its source and see what you know.')}</small>
          </div>
          <div className="steps">
            <span>
              <i className="ink" />
              {t('Capture')}
            </span>
            <span>
              <i className="signal" />
              {t('Connect')}
            </span>
            <span>
              <i className="green" />
              {t('Check')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
