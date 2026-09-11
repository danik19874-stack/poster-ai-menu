import { describe, it, expect } from 'vitest';
import { buildMenuLink } from './buildMenuLink';

describe('buildMenuLink', () => {
  it('builds a guest menu URL for the given restaurant and table', () => {
    expect(buildMenuLink('https://poster-ai-menu.vercel.app', 'rest-123', 5)).toBe(
      'https://poster-ai-menu.vercel.app/menu-preview/rest-123?table=5',
    );
  });

  it('strips a trailing slash from the origin', () => {
    expect(buildMenuLink('https://poster-ai-menu.vercel.app/', 'rest-123', 1)).toBe(
      'https://poster-ai-menu.vercel.app/menu-preview/rest-123?table=1',
    );
  });

  it('throws for a table number below 1', () => {
    expect(() => buildMenuLink('https://example.com', 'rest-123', 0)).toThrow('table');
  });

  it('throws for a non-integer table number', () => {
    expect(() => buildMenuLink('https://example.com', 'rest-123', 1.5)).toThrow('table');
  });
});
