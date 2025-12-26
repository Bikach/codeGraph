import { describe, it, expect } from 'vitest';
import { mapVisibility } from './map-visibility.js';

describe('mapVisibility', () => {
  it('should map private visibility', () => {
    expect(mapVisibility('private')).toBe('private');
  });

  it('should map protected visibility', () => {
    expect(mapVisibility('protected')).toBe('protected');
  });

  it('should map internal visibility', () => {
    expect(mapVisibility('internal')).toBe('internal');
  });

  it('should map public visibility', () => {
    expect(mapVisibility('public')).toBe('public');
  });

  it('should default to public for unknown visibility', () => {
    expect(mapVisibility('unknown')).toBe('public');
    expect(mapVisibility('')).toBe('public');
  });
});
