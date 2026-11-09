import { t, formatNumber } from '../i18n/index.js';
import { useEffect, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { findDocumentMatches, matchLimit, type DocumentMatch } from '@note/editor/find';
import { isolatedDocumentEdit } from './history.js';

interface FindState {
  query: string;
  caseSensitive: boolean;
  active: number;
  matches: DocumentMatch[];
}
const initial: FindState = { query: '', caseSensitive: false, active: 0, matches: [] };
const key = new PluginKey<FindState>('document-find');
export const DocumentFind = Extension.create({
  name: 'documentFind',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key,
        state: {
          init: () => initial,
          apply(tr, previous) {
            const meta = tr.getMeta(key) as Partial<FindState> | undefined;
            if (!meta && !tr.docChanged) return previous;
            const next = { ...previous, ...meta };
            next.matches = findDocumentMatches(tr.doc, next.query, next.caseSensitive);
            next.active = Math.max(0, Math.min(next.active, next.matches.length - 1));
            return next;
          },
        },
        props: {
          decorations(state) {
            const find = key.getState(state)!;
            return DecorationSet.create(
              state.doc,
              find.matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class: `text-search-match${index === find.active ? ' is-current' : ''}`,
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});
export function FindInPage({ editor, close }: { editor: Editor; close(): void }) {
  const [find, setFind] = useState<FindState>(() => key.getState(editor.state) ?? initial);
  const [replacement, setReplacement] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const update = () => setFind(key.getState(editor.state) ?? initial);
    editor.on('transaction', update);
    return () => {
      editor.off('transaction', update);
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(key, initial));
    };
  }, [editor]);
  const change = (partial: Partial<FindState>, scroll = true) => {
    editor.view.dispatch(editor.state.tr.setMeta(key, partial));
    if (scroll) {
      // Let React/ProseMirror reveal a matching collapsed section before scrolling.
      requestAnimationFrame(() =>
        editor.view.dom
          .querySelector('.text-search-match.is-current')
          ?.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
    }
  };
  const step = (direction: number) =>
    change({
      active: (find.active + direction + find.matches.length) % Math.max(1, find.matches.length),
    });
  const replace = (all: boolean) => {
    if (!editor.isEditable) return;
    const targets = all ? find.matches : find.matches.slice(find.active, find.active + 1);
    const tr = editor.state.tr;
    for (const match of [...targets].reverse()) tr.insertText(replacement, match.from, match.to);
    isolatedDocumentEdit(editor, () => editor.view.dispatch(tr));
  };
  return (
    <div
      className="document-find"
      role="search"
      aria-label={t('Find in current page')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
          editor.commands.focus();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          step(event.shiftKey ? -1 : 1);
        }
      }}
    >
      <div className="find-row">
        <input
          ref={input}
          aria-label={t('Find text')}
          placeholder={t('Find in page…')}
          value={find.query}
          onChange={(event) => change({ query: event.target.value, active: 0 })}
        />
        <button
          aria-label={t('Match case')}
          aria-pressed={find.caseSensitive}
          onClick={() => change({ caseSensitive: !find.caseSensitive, active: 0 })}
        >
          {t('Aa')}
        </button>
        <span role="status" aria-label={t('Find results')}>
          {find.matches.length
            ? t('{{value1}} of {{length}}{{value3}}', {
                value1: formatNumber(find.active + 1),
                length: formatNumber(find.matches.length),
                value3: find.matches.length >= matchLimit ? '+' : '',
              })
            : t('0 results')}
        </span>
        <button
          aria-label={t('Previous match')}
          disabled={!find.matches.length}
          onClick={() => step(-1)}
        >
          <ChevronUp size={16} />
        </button>
        <button
          aria-label={t('Next match')}
          disabled={!find.matches.length}
          onClick={() => step(1)}
        >
          <ChevronDown size={16} />
        </button>
        <button aria-label={t('Close find')} onClick={close}>
          <X size={16} />
        </button>
      </div>
      {editor.isEditable && (
        <div className="find-row">
          <input
            aria-label={t('Replace with')}
            placeholder={t('Replace with…')}
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
          />
          <button
            aria-label={t('Replace match')}
            disabled={!find.matches.length}
            onClick={() => replace(false)}
          >
            {t('Replace')}
          </button>
          <button
            aria-label={t('Replace all matches')}
            disabled={!find.matches.length || find.matches.length >= matchLimit}
            onClick={() => replace(true)}
          >
            {t('All')}
          </button>
        </div>
      )}
      {find.matches.length >= matchLimit && (
        <small>
          {t('Showing the first {{count}} matches. Narrow the search to replace all.', {
            count: formatNumber(matchLimit),
          })}
        </small>
      )}
    </div>
  );
}
