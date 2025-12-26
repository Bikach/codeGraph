/**
 * Infer Domains From Packages Tests
 */

import { describe, it, expect } from 'vitest';
import { inferDomainsFromPackages, DEFAULT_DOMAIN_SEGMENT_INDEX } from './infer-domains-from-packages.js';

describe('inferDomainsFromPackages', () => {
  describe('Kotlin packages', () => {
    it('should infer domains from Kotlin package names', () => {
      const packages = [
        'com.example.payment.domain',
        'com.example.payment.service',
        'com.example.user.domain',
        'com.example.user.repository',
      ];

      const result = inferDomainsFromPackages(packages, 'kotlin', {});

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.name).sort()).toEqual(['Payment', 'User']);

      const paymentDomain = result.find((d) => d.name === 'Payment');
      expect(paymentDomain?.matchedPackages).toContain('com.example.payment.domain');
      expect(paymentDomain?.matchedPackages).toContain('com.example.payment.service');
    });

    it('should generate inferred patterns', () => {
      const packages = ['com.example.payment.service'];

      const result = inferDomainsFromPackages(packages, 'kotlin', {});

      expect(result[0]?.patterns).toEqual(['*.payment.*', '*.payment']);
    });
  });

  describe('TypeScript paths', () => {
    it('should infer domains from TypeScript paths', () => {
      const packages = [
        'src/payment/service',
        'src/payment/types',
        'src/user/handler',
      ];

      const result = inferDomainsFromPackages(packages, 'typescript', {});

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.name).sort()).toEqual(['Payment', 'User']);
    });
  });

  describe('custom segment index', () => {
    it('should use custom domain segment index', () => {
      const packages = ['com.company.project.payment.service'];

      const result = inferDomainsFromPackages(packages, 'kotlin', { domainSegmentIndex: 3 });

      expect(result[0]?.name).toBe('Payment');
    });
  });

  describe('DEFAULT_DOMAIN_SEGMENT_INDEX', () => {
    it('should have correct defaults', () => {
      expect(DEFAULT_DOMAIN_SEGMENT_INDEX.kotlin).toBe(2);
      expect(DEFAULT_DOMAIN_SEGMENT_INDEX.java).toBe(2);
      expect(DEFAULT_DOMAIN_SEGMENT_INDEX.typescript).toBe(1);
      expect(DEFAULT_DOMAIN_SEGMENT_INDEX.javascript).toBe(1);
    });
  });
});
