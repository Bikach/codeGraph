/**
 * Capitalize Tests
 */

import { describe, it, expect } from 'vitest';
import { capitalize } from './capitalize.js';

describe('capitalize', () => {
  it('should capitalize the first letter of a string', () => {
    expect(capitalize('payment')).toBe('Payment');
  });

  it('should handle already capitalized strings', () => {
    expect(capitalize('Payment')).toBe('Payment');
  });

  it('should handle single character strings', () => {
    expect(capitalize('p')).toBe('P');
  });

  it('should handle empty strings', () => {
    expect(capitalize('')).toBe('');
  });
});
