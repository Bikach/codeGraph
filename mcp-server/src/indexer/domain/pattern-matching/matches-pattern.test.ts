/**
 * Matches Pattern Tests
 */

import { describe, it, expect } from 'vitest';
import { matchesPattern } from './matches-pattern.js';

describe('matchesPattern', () => {
  describe('dot-separated patterns (Kotlin/Java)', () => {
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

  describe('slash-separated patterns (TypeScript/JavaScript)', () => {
    describe('single wildcard (*)', () => {
      it('should match single segment', () => {
        expect(matchesPattern('src/payment/service', 'src/payment/*')).toBe(true);
      });

      it('should not match multiple segments', () => {
        expect(matchesPattern('src/payment/domain/model', 'src/payment/*')).toBe(false);
      });

      it('should match any single segment', () => {
        expect(matchesPattern('src/payment/service', 'src/*/service')).toBe(true);
        expect(matchesPattern('src/user/service', 'src/*/service')).toBe(true);
      });
    });

    describe('double wildcard (**)', () => {
      it('should match any number of segments', () => {
        expect(matchesPattern('src/payment/service', '**/payment/**')).toBe(true);
        expect(matchesPattern('src/payment', '**/payment')).toBe(true);
        expect(matchesPattern('lib/modules/payment', '**/payment')).toBe(true);
      });

      it('should match deeply nested paths', () => {
        expect(matchesPattern('src/modules/payment/services/handler', '**/payment/**')).toBe(true);
      });

      it('should match root-relative paths', () => {
        expect(matchesPattern('src/payment/index', 'src/**')).toBe(true);
        expect(matchesPattern('src/user/components/button', 'src/**')).toBe(true);
      });
    });

    describe('exact match', () => {
      it('should match exact path', () => {
        expect(matchesPattern('src/payment', 'src/payment')).toBe(true);
      });

      it('should not match different path', () => {
        expect(matchesPattern('src/user', 'src/payment')).toBe(false);
      });
    });

    describe('common TypeScript patterns', () => {
      it('should match feature folder pattern', () => {
        expect(matchesPattern('src/features/payment/slice', '**/features/*/**')).toBe(true);
      });

      it('should match components pattern', () => {
        expect(matchesPattern('src/components/Button', '**/components/*')).toBe(true);
      });
    });
  });
});
