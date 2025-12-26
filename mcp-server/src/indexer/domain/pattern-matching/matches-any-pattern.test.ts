/**
 * Matches Any Pattern Tests
 */

import { describe, it, expect } from 'vitest';
import { matchesAnyPattern } from './matches-any-pattern.js';

describe('matchesAnyPattern', () => {
  it('should return true if any pattern matches', () => {
    const patterns = ['com.example.payment.*', 'com.example.billing.*'];

    expect(matchesAnyPattern('com.example.payment.service', patterns)).toBe(true);
    expect(matchesAnyPattern('com.example.billing.invoice', patterns)).toBe(true);
  });

  it('should return false if no pattern matches', () => {
    const patterns = ['com.example.payment.*', 'com.example.billing.*'];

    expect(matchesAnyPattern('com.example.user.service', patterns)).toBe(false);
  });

  it('should return false for empty patterns array', () => {
    expect(matchesAnyPattern('com.example.payment.service', [])).toBe(false);
  });

  it('should handle double wildcard patterns', () => {
    const patterns = ['com.example.core.**'];

    expect(matchesAnyPattern('com.example.core.domain.user', patterns)).toBe(true);
    expect(matchesAnyPattern('com.example.core.service.impl', patterns)).toBe(true);
    expect(matchesAnyPattern('com.example.other', patterns)).toBe(false);
  });
});
