import { DomainError } from './index.js';

/** Only overrides are persisted. The default appearance belongs to the stylesheet. */
export interface AppearanceOverrides {
  interfaceFont?: string;
  bodyFont?: string;
  headingFont?: string;
  codeFont?: string;
  interfaceSize?: number;
  bodySize?: number;
  lineHeight?: number;
  density?: number;
  background?: string;
  text?: string;
  navigation?: string;
  surface?: string;
  accent?: string;
  selection?: string;
  muted?: string;
  border?: string;
  customCss?: string;
  fonts?: { family: string; url: string }[];
}
export interface AppearancePreference {
  revision: number;
  overrides: AppearanceOverrides;
}
const fontKeys = ['interfaceFont', 'bodyFont', 'headingFont', 'codeFont'];
const colorKeys = [
  'background',
  'text',
  'navigation',
  'surface',
  'accent',
  'selection',
  'muted',
  'border',
];
const ranges: Record<string, [number, number]> = {
  interfaceSize: [11, 24],
  bodySize: [10, 40],
  lineHeight: [1, 2.5],
  density: [0.75, 1.5],
};
export function validateAppearance(input: unknown): AppearanceOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new DomainError('INVALID', 'Appearance must be an object.');
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (fontKeys.includes(key)) {
      if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > 300 ||
        /[\x00-\x1f;{}]/u.test(value)
      )
        throw new DomainError('INVALID', 'Use a valid font family.');
    } else if (colorKeys.includes(key)) {
      if (
        typeof value !== 'string' ||
        value.length > 160 ||
        !value.trim() ||
        /[;{}<>\x00-\x1f]/u.test(value)
      )
        throw new DomainError('INVALID', 'Use a valid CSS color.');
    } else if (Object.hasOwn(ranges, key)) {
      const [min, max] = ranges[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new DomainError('INVALID', `${key} must be between ${min} and ${max}.`);
    } else if (key === 'customCss') {
      if (typeof value !== 'string' || value.length > 65536 || value.includes('\0'))
        throw new DomainError('INVALID', 'Use up to 64 KB of custom CSS.');
    } else if (key === 'fonts') {
      if (!Array.isArray(value) || value.length > 50)
        throw new DomainError('INVALID', 'Use up to 50 font sources.');
      for (const font of value) {
        if (
          !font ||
          typeof font.family !== 'string' ||
          !font.family.trim() ||
          font.family.length > 300 ||
          /[\x00-\x1f;{}]/u.test(font.family) ||
          typeof font.url !== 'string' ||
          font.url.length > 2048
        )
          throw new DomainError('INVALID', 'A font needs a family and a source URL.');
        let url: URL;
        try {
          url = new URL(font.url);
        } catch {
          throw new DomainError('INVALID', 'Use a valid font URL.');
        }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
          throw new DomainError('INVALID', 'Use an HTTP or HTTPS font source.');
      }
    } else throw new DomainError('INVALID', `Unknown appearance option: ${key}.`);
    result[key] = value;
  }
  return result as AppearanceOverrides;
}
