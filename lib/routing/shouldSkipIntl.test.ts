import { describe, expect, it } from 'vitest';
import { shouldSkipIntl } from './shouldSkipIntl';

describe('shouldSkipIntl', () => {
  it('skips /admin pages', () => {
    expect(shouldSkipIntl('/admin')).toBe(true);
    expect(shouldSkipIntl('/admin/login')).toBe(true);
  });

  it('skips /api/admin routes', () => {
    expect(shouldSkipIntl('/api/admin/keys')).toBe(true);
  });

  it('does not skip other /api routes (they are excluded by the proxy matcher instead)', () => {
    expect(shouldSkipIntl('/api/orders')).toBe(false);
  });

  it('does not skip the landing page or the guest widget', () => {
    expect(shouldSkipIntl('/')).toBe(false);
    expect(shouldSkipIntl('/en')).toBe(false);
    expect(shouldSkipIntl('/menu-preview/abc-123')).toBe(false);
  });
});
