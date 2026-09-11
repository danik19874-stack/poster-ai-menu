import { describe, expect, it } from 'vitest';
import { routing } from './routing';

describe('i18n routing config', () => {
  it('has ru as the default locale', () => {
    expect(routing.defaultLocale).toBe('ru');
  });

  it('supports exactly ru and en for now', () => {
    expect(routing.locales).toEqual(['ru', 'en']);
  });

  it('does not prefix the default locale in the URL', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});
