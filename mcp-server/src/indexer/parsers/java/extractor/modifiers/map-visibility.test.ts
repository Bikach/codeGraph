import { describe, it, expect } from 'vitest';
import { mapVisibility } from './map-visibility.js';

describe('mapVisibility', () => {
  it('should map public to public', () => {
    expect(mapVisibility('public')).toBe('public');
  });

  it('should map private to private', () => {
    expect(mapVisibility('private')).toBe('private');
  });

  it('should map protected to protected', () => {
    expect(mapVisibility('protected')).toBe('protected');
  });

  it('should map unknown to internal (package-private)', () => {
    expect(mapVisibility('')).toBe('internal');
    expect(mapVisibility('unknown')).toBe('internal');
  });

  it('should default to internal for no modifier (Java package-private)', () => {
    expect(mapVisibility('')).toBe('internal');
  });
});
