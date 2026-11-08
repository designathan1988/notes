import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useWorkspace } from '../state/store.js';
import type { AppearanceOverrides } from '../../../../packages/contracts/src/index.js';
import { IconButton } from '../ui/IconButton.js';
import { appearanceVariableNames } from './projection.js';

const fontRoles = [
  ['interfaceFont', 'Interface'],
  ['bodyFont', 'Body'],
  ['headingFont', 'Headings'],
  ['codeFont', 'Code'],
] as const;
const colorRoles = [
  ['background', 'Background'],
  ['text', 'Text'],
  ['navigation', 'Navigation'],
  ['surface', 'Surface'],
  ['accent', 'Accent'],
  ['selection', 'Selection'],
  ['muted', 'Secondary text'],
  ['border', 'Borders'],
] as const;
const fontChoices = [
  'Inter',
  'Arial',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Courier New',
  'Consolas',
  'monospace',
];
export function AppearancePanel() {
  const state = useWorkspace(),
    page = state.pages.find((page) => page.id === state.selectedId),
    pageScope = state.appearanceScope === 'page',
    draft = page && state.pageAppearanceDrafts[page.id],
    appearance = pageScope ? (draft?.overrides ?? page?.appearance ?? {}) : state.appearance,
    readOnly =
      pageScope &&
      state.workspaces.find((item) => item.id === state.workspaceId)?.role === 'viewer';
  const ref = useRef<HTMLElement>(null),
    [addingFont, setAddingFont] = useState(false),
    [family, setFamily] = useState(''),
    [url, setUrl] = useState(''),
    [fontError, setFontError] = useState('');
  const [inherited, setInherited] = useState<Record<string, string>>({});
  useEffect(() => {
    const surface = pageScope
      ? document.querySelector(`[data-styled-page="${page?.id}"]`)
      : document.documentElement;
    if (!surface) return;
    const computed = getComputedStyle(surface);
    setInherited(
      Object.fromEntries(
        Object.entries(appearanceVariableNames).map(([key, variable]) => [
          key,
          computed.getPropertyValue(variable).trim(),
        ]),
      ),
    );
  }, [pageScope, page?.id]);
  const close = () => useWorkspace.getState().closeAppearance();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (matchMedia('(max-width:1050px)').matches)
      ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  function change(key: keyof AppearanceOverrides, value: unknown) {
    if (readOnly) return;
    if (pageScope && page) {
      const next = { ...appearance } as Record<string, unknown>;
      if (value === null) delete next[key];
      else next[key] = value;
      state.changePageAppearance(page.id, next as AppearanceOverrides);
    } else state.changeAppearance({ [key]: value });
  }
  const status = pageScope ? (draft?.status ?? 'saved') : state.appearanceStatus,
    error = pageScope ? draft?.error : state.appearanceError;
  return (
    <aside
      className="appearance-panel"
      ref={ref}
      aria-label="Appearance"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
        if (event.key === 'Tab' && matchMedia('(max-width:1050px)').matches) {
          const controls = [
            ...ref.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary',
            ),
          ].filter((item) => item.getClientRects().length);
          const target = event.shiftKey ? controls.at(-1) : controls[0];
          if (
            (event.shiftKey && document.activeElement === controls[0]) ||
            (!event.shiftKey && document.activeElement === controls.at(-1))
          ) {
            event.preventDefault();
            target?.focus();
          }
        }
      }}
    >
      <header>
        <h2>Appearance</h2>
        <button
          className="text-button"
          disabled={!!readOnly}
          onClick={() =>
            pageScope && page ? state.changePageAppearance(page.id, {}) : state.resetAppearance()
          }
        >
          Reset
        </button>
        <IconButton label="Close appearance" onClick={close}>
          <X />
        </IconButton>
      </header>
      <div className="appearance-scroll">
        <div className="appearance-scopes" role="group" aria-label="Appearance scope">
          <button
            aria-pressed={!pageScope}
            onClick={() => useWorkspace.getState().openAppearance('app')}
          >
            App
          </button>
          <button
            aria-pressed={pageScope}
            disabled={!page}
            onClick={() => useWorkspace.getState().openAppearance('page')}
          >
            This page
          </button>
        </div>
        <p className="appearance-hint">
          {pageScope
            ? 'Style this page. Changes are shared with its collaborators.'
            : 'Your personal appearance across pages and devices.'}
        </p>
        <fieldset disabled={!!readOnly || (!pageScope && state.appearanceStatus === 'loading')}>
          <section>
            <h3>Typography</h3>
            <datalist id="appearance-fonts">
              {[
                ...new Set([
                  ...fontChoices,
                  ...(appearance.fonts ?? []).map((font) => font.family),
                ]),
              ].map((font) => (
                <option key={font} value={font} />
              ))}
            </datalist>
            {fontRoles
              .filter(([key]) => !pageScope || key !== 'interfaceFont')
              .map(([key, label]) => (
                <label className="appearance-row" key={key}>
                  <span>{label}</span>
                  <input
                    aria-label={`${label} font`}
                    list="appearance-fonts"
                    placeholder={inherited[key] || 'Inherit default'}
                    value={appearance[key] ?? ''}
                    onChange={(event) => change(key, event.target.value || null)}
                  />
                </label>
              ))}
            <button
              className="text-button appearance-add-font"
              onClick={() => setAddingFont(!addingFont)}
            >
              <Plus size={15} />
              Add font…
            </button>
            {addingFont && (
              <div className="appearance-font-source">
                <input
                  aria-label="Custom font family"
                  placeholder="Font family"
                  value={family}
                  onChange={(event) => setFamily(event.target.value)}
                />
                <input
                  aria-label="Font source URL"
                  placeholder="https://…/font.woff2"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <button
                  className="button"
                  onClick={() => {
                    try {
                      const source = new URL(url);
                      if (!family.trim() || !['http:', 'https:'].includes(source.protocol))
                        throw new Error('Enter a font family and an HTTP or HTTPS font URL.');
                      change('fonts', [
                        ...(appearance.fonts ?? []).filter((font) => font.family !== family.trim()),
                        { family: family.trim(), url: source.href },
                      ]);
                      setAddingFont(false);
                      setFontError('');
                      setFamily('');
                      setUrl('');
                    } catch (error) {
                      setFontError((error as Error).message);
                    }
                  }}
                >
                  Add font
                </button>
                {fontError && <p role="alert">{fontError}</p>}
              </div>
            )}
            {(appearance.fonts ?? []).map((font) => (
              <div className="appearance-font-entry" key={font.family}>
                <span title={font.url}>{font.family}</span>
                <IconButton
                  label={`Remove font ${font.family}`}
                  onClick={() =>
                    change(
                      'fonts',
                      appearance.fonts!.filter((item) => item.family !== font.family),
                    )
                  }
                >
                  <X size={13} />
                </IconButton>
              </div>
            ))}
          </section>
          <section>
            {!pageScope && (
              <label className="appearance-row">
                <span>Interface size</span>
                <input
                  type="number"
                  min="11"
                  max="24"
                  aria-label="Interface size"
                  value={appearance.interfaceSize ?? ''}
                  placeholder="Default"
                  onChange={(event) =>
                    change('interfaceSize', event.target.value ? Number(event.target.value) : null)
                  }
                />
              </label>
            )}
            <label className="appearance-row">
              <span>Body size</span>
              <input
                type="number"
                min="10"
                max="40"
                aria-label="Body size"
                value={appearance.bodySize ?? ''}
                placeholder="Default"
                onChange={(event) =>
                  change('bodySize', event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
            <label className="appearance-row">
              <span>Line height</span>
              <input
                type="number"
                min="1"
                max="2.5"
                step="0.05"
                aria-label="Line height"
                value={appearance.lineHeight ?? ''}
                placeholder="Default"
                onChange={(event) =>
                  change('lineHeight', event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
            {!pageScope && (
              <label className="appearance-row">
                <span>Density</span>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  aria-label="Interface density"
                  value={appearance.density ?? 1}
                  onChange={(event) => change('density', Number(event.target.value))}
                />
              </label>
            )}
          </section>
          <section>
            <h3>Colors</h3>
            {colorRoles
              .filter(([key]) => !pageScope || !['navigation', 'surface'].includes(key))
              .map(([key, label]) => (
                <label className="appearance-row" key={key}>
                  <span>{label}</span>
                  <span className="appearance-color">
                    <span
                      className="color-preview"
                      style={{ background: appearance[key] ?? inherited[key] }}
                    />
                    <input
                      aria-label={`${label} color`}
                      placeholder={inherited[key] || 'Inherit default'}
                      value={appearance[key] ?? ''}
                      onChange={(event) => change(key, event.target.value || null)}
                    />
                  </span>
                </label>
              ))}
          </section>
          <details className="appearance-css">
            <summary>Custom CSS</summary>
            <textarea
              aria-label={pageScope ? 'Page custom CSS' : 'App custom CSS'}
              spellCheck={false}
              value={appearance.customCss ?? ''}
              placeholder={pageScope ? '.page-title { … }' : '.workbench-tab { … }'}
              onChange={(event) => change('customCss', event.target.value || null)}
            />
            <small>
              {pageScope
                ? 'Selectors apply inside this page.'
                : 'Reset appearance anytime with Ctrl Alt Shift Backspace.'}
            </small>
          </details>
        </fieldset>
      </div>
      <footer aria-live="polite">
        {status === 'error' ? (
          <>
            <span>{error}</span>
            <button
              className="text-button"
              onClick={() =>
                pageScope && page
                  ? state.savePageAppearance(page.id)
                  : state.appearanceOwner && state.loadAppearance(state.appearanceOwner)
              }
            >
              Retry
            </button>
          </>
        ) : status === 'saving' ? (
          'Saving changes…'
        ) : status === 'loading' ? (
          'Loading appearance…'
        ) : (
          'Changes save automatically.'
        )}
        {readOnly && <span>Read only</span>}
      </footer>
    </aside>
  );
}
