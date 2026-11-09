import { Select } from '../ui/Select.js';
import { setLocale, t, useLocale, type Locale } from './index.js';

export function LanguagePicker() {
  const locale = useLocale();
  return (
    <label className="field">
      <span>{t('Language')}</span>
      <Select
        aria-label={t('Language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value="en-US">English (US)</option>
        <option value="pt-BR">Português (Brasil)</option>
      </Select>
    </label>
  );
}
