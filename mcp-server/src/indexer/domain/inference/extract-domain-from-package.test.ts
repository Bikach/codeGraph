/**
 * Extract Domain From Package Tests
 */

import { describe, it, expect } from 'vitest';
import { extractDomainFromPackage } from './extract-domain-from-package.js';

describe('extractDomainFromPackage', () => {
  describe('dot-separated packages (Java/Kotlin)', () => {
    it('should extract domain at segment index 2', () => {
      expect(extractDomainFromPackage('com.example.payment.service', 2)).toBe('payment');
      expect(extractDomainFromPackage('com.example.user.domain', 2)).toBe('user');
    });

    it('should return null if segment index is out of bounds', () => {
      expect(extractDomainFromPackage('com.example', 2)).toBe(null);
    });
  });

  describe('slash-separated paths (TypeScript/JavaScript)', () => {
    it('should extract domain at segment index 1', () => {
      expect(extractDomainFromPackage('src/payment/service', 1)).toBe('payment');
      expect(extractDomainFromPackage('src/user/handler', 1)).toBe('user');
    });
  });

  describe('skip common non-domain segments', () => {
    it('should skip domain segment and use next', () => {
      expect(extractDomainFromPackage('com.example.domain.payment.service', 2)).toBe('payment');
    });

    it('should skip infrastructure segment and use next', () => {
      expect(extractDomainFromPackage('com.example.infrastructure.user.repo', 2)).toBe('user');
    });

    it('should skip application segment and use next', () => {
      expect(extractDomainFromPackage('com.example.application.order.handler', 2)).toBe('order');
    });

    it('should return null if no valid segment after skip', () => {
      expect(extractDomainFromPackage('com.example.domain', 2)).toBe(null);
    });
  });
});
