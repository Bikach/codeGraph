/**
 * Matches Pattern Tests
 */

import { describe, it, expect } from 'vitest';
import { matchesPattern } from './matches-pattern.js';

describe('matchesPattern', () => {
  describe('single wildcard (*)', () => {
    it('should match single segment', () => {
      expect(matchesPattern('com.example.payment.service', 'com.example.payment.*')).toBe(true);
    });

    it('should not match multiple segments', () => {
      expect(matchesPattern('com.example.payment.domain.model', 'com.example.payment.*')).toBe(false);
    });

    it('should match any single segment', () => {
      expect(matchesPattern('com.example.payment.service', 'com.example.*.service')).toBe(true);
      expect(matchesPattern('com.example.user.service', 'com.example.*.service')).toBe(true);
    });
  });

  describe('double wildcard (**)', () => {
    it('should match any number of segments', () => {
      expect(matchesPattern('com.example.payment.service', 'com.example.payment.**')).toBe(true);
      expect(matchesPattern('com.example.payment.domain.model', 'com.example.payment.**')).toBe(true);
      expect(matchesPattern('com.example.payment.infra.db.repo', 'com.example.payment.**')).toBe(true);
    });
  });

  describe('exact match', () => {
    it('should match exact pattern', () => {
      expect(matchesPattern('com.example.payment', 'com.example.payment')).toBe(true);
    });

    it('should not match different pattern', () => {
      expect(matchesPattern('com.example.user', 'com.example.payment')).toBe(false);
    });
  });
});
