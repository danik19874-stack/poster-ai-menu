import { describe, expect, it } from 'vitest';
import { buildGreeting } from './greeting';

describe('buildGreeting', () => {
  it('welcomes the guest with the restaurant name and description when both are set', () => {
    expect(buildGreeting('Ресторан Сандык', 'гастрономический мир восточной кухни')).toBe(
      'Добро пожаловать в Ресторан Сандык, гастрономический мир восточной кухни!',
    );
  });

  it('falls back to just the restaurant name when there is no description', () => {
    expect(buildGreeting('Частное Лицо', '')).toBe('Добро пожаловать в Частное Лицо!');
  });

  it('treats a whitespace-only description the same as an empty one', () => {
    expect(buildGreeting('Частное Лицо', '   ')).toBe('Добро пожаловать в Частное Лицо!');
  });

  it('trims surrounding whitespace from a real description', () => {
    expect(buildGreeting('Частное Лицо', '  тёплая домашняя кухня  ')).toBe(
      'Добро пожаловать в Частное Лицо, тёплая домашняя кухня!',
    );
  });
});
