import { useSyncExternalStore } from 'react';
import editor from './editor.pt-BR.js';
import workspace from './workspace.pt-BR.js';
import product from './product.pt-BR.js';
import extra from './product-extra.pt-BR.js';
import errors from './errors.pt-BR.js';

export type Locale = 'en-US' | 'pt-BR';
export const localeStorageKey = 'mosaic:locale';
export const messages: Record<string, string> = {
  ...editor,
  ...workspace,
  ...product,
  ...extra,
  ...errors,
  Language: 'Idioma',
  'Opening your workspace…': 'Abrindo seu espaço de trabalho…',
  'We couldn’t reach your workspace.': 'Não foi possível acessar seu espaço de trabalho.',
  'Retry connection': 'Tentar conexão novamente',
};
const listeners = new Set<() => void>();
function storedLocale(): Locale {
  try {
    return globalThis.localStorage?.getItem(localeStorageKey) === 'pt-BR' ? 'pt-BR' : 'en-US';
  } catch {
    return 'en-US';
  }
}
let locale: Locale = storedLocale();
export function getLocale(): Locale {
  return locale;
}
function projectLocale() {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
projectLocale();
export function setLocale(next: Locale) {
  if (next !== 'en-US' && next !== 'pt-BR') return;
  try {
    globalThis.localStorage?.setItem(localeStorageKey, next);
  } catch {
    // The preference remains usable in memory when storage is unavailable.
  }
  if (locale === next) return;
  locale = next;
  projectLocale();
  listeners.forEach((listener) => listener());
}
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== localeStorageKey && event.key !== null) return;
    const next = storedLocale();
    if (next !== locale) {
      locale = next;
      projectLocale();
      listeners.forEach((listener) => listener());
    }
  });
}
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => 'en-US');
}
type Values = Record<string, string | number>;
/** Canonical error text stays in state; resolve it to the current language at render time. */
export function sourceMessage(message: string, values: Values = {}): string {
  return message.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    !Object.hasOwn(values, key) || values[key] === undefined ? token : String(values[key]),
  );
}
// API diagnostics arrive interpolated. Match only known error templates and keep
// authored property names verbatim. Ordinary content is never passed to t().
const errorPatterns = [
  'Unknown property: {{id}}',
  '{{name}} is derived and cannot be edited.',
  'Invalid value for {{name}}.',
  '{{name}} must contain between 1 and {{max}} characters.',
  '{{key}} must be between {{min}} and {{max}}.',
  'Unknown appearance option: {{key}}.',
  'The property name {{name}} is ambiguous. Insert its reference using a property button.',
  'Choose a numeric property for {{name}}.',
  'Formula reference [{{ref}}] must be a numeric property.',
  'Open “{{title}}” to synchronize its local draft before copying. Your local content has been kept.',
].map((id) => {
  const names: string[] = [];
  const parts = id.split(/(\{\{\w+\}\})/).map((part) => {
    const token = /^\{\{(\w+)\}\}$/.exec(part);
    if (token) {
      names.push(token[1]);
      return token[1] === 'title' ? '([\\s\\S]*?)' : '([\\s\\S]+?)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { id, names, pattern: new RegExp('^' + parts.join('') + '$') };
});
/** English source messages are stable catalog IDs; user-authored content never goes here. */
export function t(message: string, values: Values = {}): string {
  let text = locale === 'pt-BR' && Object.hasOwn(messages, message) ? messages[message] : message;
  if (locale === 'pt-BR' && !Object.hasOwn(messages, message)) {
    for (const { id, names, pattern } of errorPatterns) {
      const match = pattern.exec(message);
      if (!match) continue;
      text = messages[id];
      values = {
        ...values,
        ...Object.fromEntries(names.map((name, index) => [name, match[index + 1]])),
      };
      break;
    }
  }
  return text.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    !Object.hasOwn(values, key) || values[key] === undefined ? token : String(values[key]),
  );
}
export function formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(
    typeof value === 'string' ? new Date(value) : value,
  );
}
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}
export function formatRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
) {
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}
