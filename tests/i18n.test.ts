import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import {
  formatDate,
  formatNumber,
  formatRelative,
  getLocale,
  localeStorageKey,
  messages,
  setLocale,
  sourceMessage,
  subscribeLocale,
  t,
} from '../apps/web/src/i18n/index.js';

afterEach(() => {
  setLocale('en-US');
  vi.unstubAllGlobals();
});

test('locale changes notify mounted views and persist without changing user values', () => {
  const setItem = vi.fn();
  vi.stubGlobal('localStorage', { setItem });
  const listener = vi.fn();
  const unsubscribe = subscribeLocale(listener);
  const userTitle = 'Research projeto 原稿';
  setLocale('pt-BR');
  expect(getLocale()).toBe('pt-BR');
  expect(setItem).toHaveBeenCalledWith(localeStorageKey, 'pt-BR');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(t('Language')).toBe('Idioma');
  expect(t('Inspect {{value0}}', { value0: userTitle })).toBe(`Inspecionar ${userTitle}`);
  expect(t('Unknown message')).toBe('Unknown message');
  expect(t('Inspect {{value0}}')).toContain('{{value0}}');
  unsubscribe();
  setLocale('en-US');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(t('Language')).toBe('Language');
});

test('private storage failures do not prevent a language change', () => {
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw new Error('Storage disabled');
    },
  });
  expect(() => setLocale('pt-BR')).not.toThrow();
  expect(t('Language')).toBe('Idioma');
});

test('server validation translates known dynamic diagnostics while retaining field names', () => {
  setLocale('pt-BR');
  expect(t('Invalid value for Research ✍️.')).toBe('Valor inválido para Research ✍️.');
  expect(t('Unknown property: field_123')).toContain('field_123');
  expect(t('Formula reference [Price] must be a numeric property.')).toContain('[Price]');
  expect(t('constructor')).toBe('constructor');
  expect(t('toString')).toBe('toString');
  expect(t('Unknown error from extension')).toBe('Unknown error from extension');
});

test('retained local warnings translate in both directions without translating their stored value', () => {
  setLocale('pt-BR');
  const warning = sourceMessage('Preview access expired or changed. Run the current source again.');
  const dynamic = sourceMessage(
    'Open “{{title}}” to synchronize its local draft before copying. Your local content has been kept.',
    { title: 'Pesquisa {{title}}' },
  );
  expect(warning).toBe('Preview access expired or changed. Run the current source again.');
  expect(t(warning)).toBe(messages[warning]);
  expect(t(dynamic)).toContain('Pesquisa {{title}}');
  expect(t(dynamic)).not.toBe(dynamic);
  const copyWarning =
    'Open “{{title}}” to synchronize its local draft before copying. Your local content has been kept.';
  expect(t(sourceMessage(copyWarning, { title: '' }))).toBe(t(copyWarning, { title: '' }));
  setLocale('en-US');
  expect(t(warning)).toBe(warning);
  expect(t(dynamic)).toBe(dynamic);
  setLocale('pt-BR');
  expect(t(warning)).toBe(messages[warning]);
});

test('numbers, dates and relative times follow the selected locale', () => {
  setLocale('pt-BR');
  expect(formatNumber(1234.5)).toBe('1.234,5');
  expect(
    formatDate(new Date(2026, 10, 9), { day: '2-digit', month: '2-digit', year: 'numeric' }),
  ).toBe('09/11/2026');
  expect(formatRelative(-1, 'day')).toBe('ontem');
  setLocale('en-US');
  expect(formatNumber(1234.5)).toBe('1,234.5');
});

test('Portuguese catalog preserves every interpolation token', () => {
  const tokens = (text: string) =>
    [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const [source, translation] of Object.entries(messages)) {
    expect(translation.trim(), source).not.toBe('');
    expect(tokens(translation), source).toEqual(tokens(source));
  }
});

test('every static application translation call has a Portuguese catalog entry', () => {
  const missing = new Set<string>();
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'i18n') scan(file);
        continue;
      }
      if (!/\.tsx?$/.test(file)) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 't') {
          const argument = node.arguments[0];
          if (
            argument &&
            (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
            !(argument.text in messages)
          )
            missing.add(argument.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan(resolve('apps/web/src'));
  expect([...missing].sort()).toEqual([]);
});

test('error and warning paths retain source messages instead of caching a translation', () => {
  const violations: string[] = [];
  const setters = new Set(['setError', 'setFailure', 'reportError', 'notify', 'notice']);
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'i18n') scan(file);
        continue;
      }
      if (!/\.tsx?$/.test(file)) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 't') {
          let ancestor = node.parent;
          while (ancestor && !ts.isFunctionLike(ancestor) && !ts.isJsxExpression(ancestor)) {
            if (
              ts.isNewExpression(ancestor) &&
              ['Error', 'UploadError'].includes(ancestor.expression.getText(source))
            )
              violations.push(node.getText(source));
            if (ts.isCallExpression(ancestor)) {
              const name = ts.isPropertyAccessExpression(ancestor.expression)
                ? ancestor.expression.name.text
                : ancestor.expression.getText(source);
              if (setters.has(name)) violations.push(node.getText(source));
            }
            ancestor = ancestor.parent;
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan(resolve('apps/web/src'));
  expect(violations).toEqual([]);
});
