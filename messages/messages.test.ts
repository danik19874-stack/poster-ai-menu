import { describe, expect, it } from 'vitest';
import ru from './ru.json';
import en from './en.json';

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('message catalogs', () => {
  it('ru and en expose exactly the same set of keys', () => {
    const ruKeys = collectKeyPaths(ru).sort();
    const enKeys = collectKeyPaths(en).sort();
    expect(enKeys).toEqual(ruKeys);
  });

  it('has no empty string values in either catalog', () => {
    const emptyRu = collectKeyPaths(ru).filter((path) => {
      const value = path.split('.').reduce((o: any, k) => o?.[k], ru);
      return value === '';
    });
    const emptyEn = collectKeyPaths(en).filter((path) => {
      const value = path.split('.').reduce((o: any, k) => o?.[k], en);
      return value === '';
    });
    expect(emptyRu).toEqual([]);
    expect(emptyEn).toEqual([]);
  });
});
