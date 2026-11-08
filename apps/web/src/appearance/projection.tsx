import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { AppearanceOverrides } from '../../../../packages/contracts/src/index.js';
import { useWorkspace } from '../state/store.js';

export const appearanceVariableNames: Record<string, string> = {
  interfaceFont: '--ui',
  bodyFont: '--prose',
  headingFont: '--heading',
  codeFont: '--code',
  interfaceSize: '--ui-size',
  bodySize: '--body-size',
  lineHeight: '--body-leading',
  density: '--density',
  background: '--canvas',
  text: '--ink',
  navigation: '--sidebar',
  surface: '--soft',
  accent: '--accent',
  selection: '--selected',
  muted: '--muted',
  border: '--rule',
};
export function appearanceVariables(overrides: AppearanceOverrides): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overrides).flatMap(([key, value]) => {
      if (!Object.hasOwn(appearanceVariableNames, key)) return [];
      const font = key.endsWith('Font');
      const formatted = font
        ? `${JSON.stringify(value)}, ${key === 'codeFont' ? 'monospace' : 'sans-serif'}`
        : key.endsWith('Size')
          ? `${value}px`
          : String(value);
      return [[appearanceVariableNames[key], formatted]];
    }),
  );
}
function Fonts({ fonts }: { fonts: AppearanceOverrides['fonts'] }) {
  const report = useWorkspace((state) => state.setError);
  useEffect(() => {
    const faces: FontFace[] = [];
    let disposed = false;
    for (const source of fonts ?? []) {
      const face = new FontFace(source.family, `url(${JSON.stringify(source.url)})`);
      faces.push(face);
      void face
        .load()
        .then((loaded) => {
          if (!disposed) document.fonts.add(loaded);
        })
        .catch(() => {
          if (!disposed)
            report(
              new Error(
                `The font “${source.family}” could not load. Check its URL and cross-origin permissions.`,
              ),
            );
        });
    }
    return () => {
      disposed = true;
      for (const face of faces) document.fonts.delete(face);
    };
  }, [fonts, report]);
  return null;
}
export function AppearanceProjection() {
  const appearance = useWorkspace((state) => state.appearance);
  useEffect(() => {
    const root = document.documentElement;
    const values = appearanceVariables(appearance);
    for (const [key, value] of Object.entries(values)) root.style.setProperty(key, value);
    return () => {
      for (const key of Object.keys(values)) root.style.removeProperty(key);
    };
  }, [appearance]);
  useEffect(() => {
    const reset = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        event.shiftKey &&
        event.code === 'Backspace'
      ) {
        event.preventDefault();
        useWorkspace.getState().resetAppearance();
      }
    };
    window.addEventListener('keydown', reset, true);
    return () => window.removeEventListener('keydown', reset, true);
  }, []);
  return (
    <>
      <Fonts fonts={appearance.fonts} />
      {createPortal(
        <style data-personal-appearance>{appearance.customCss ?? ''}</style>,
        document.head,
      )}
    </>
  );
}
export function PageAppearance({
  appearance,
  id,
}: {
  appearance?: AppearanceOverrides;
  id: string;
}) {
  // Parse standalone first: unmatched braces in authored CSS must never close our scope.
  const scoped = useMemo(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(appearance?.customCss ?? '');
    return `@scope ([data-styled-page="${CSS.escape(id)}"]) { ${Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')} }`;
  }, [appearance?.customCss, id]);
  return (
    <>
      <Fonts fonts={appearance?.fonts} />
      <style>{scoped}</style>
    </>
  );
}
