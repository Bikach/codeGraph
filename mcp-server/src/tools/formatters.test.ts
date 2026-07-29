import { describe, it, expect } from 'vitest';
import { buildCompactOutput } from './formatters.js';

describe('buildCompactOutput', () => {
  const fmt = (x: { n: string }) => x.n;

  it('returns a "No results" line for an empty list', () => {
    expect(buildCompactOutput('CALLERS', [], fmt)).toBe('CALLERS: No results found.');
  });

  it('renders the count and items when not truncated', () => {
    expect(buildCompactOutput('CALLERS', [{ n: 'a' }, { n: 'b' }], fmt)).toBe('CALLERS (2):\na\nb');
  });

  it('shows "N of total" and a "… more" hint when truncated', () => {
    const out = buildCompactOutput('CALLERS', [{ n: 'a' }, { n: 'b' }], fmt, 5);
    expect(out).toBe('CALLERS (2 of 5):\na\nb\n… 3 more (raise limit, or narrow with scope/depth)');
  });

  it('does not add the hint when total equals the shown count', () => {
    expect(buildCompactOutput('CALLERS', [{ n: 'a' }], fmt, 1)).toBe('CALLERS (1):\na');
  });
});
