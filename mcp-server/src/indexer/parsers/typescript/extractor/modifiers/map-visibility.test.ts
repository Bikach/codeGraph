import { describe, it, expect } from 'vitest';
import { mapVisibility } from './map-visibility.js';

describe('mapVisibility', () => {
  it('should map "public" to public', () => {
    expect(mapVisibility('public')).toBe('public');
  });

  it('should map "private" to private', () => {
    expect(mapVisibility('private')).toBe('private');
  });

  it('should map "protected" to protected', () => {
    expect(mapVisibility('protected')).toBe('protected');
  });

  it('should map undefined to public (default)', () => {
    expect(mapVisibility(undefined)).toBe('public');
  });

  it('should map unknown modifier to public', () => {
    expect(mapVisibility('unknown')).toBe('public');
  });
});
