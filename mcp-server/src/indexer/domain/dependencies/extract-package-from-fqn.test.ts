/**
 * Extract Package From FQN Tests
 */

import { describe, it, expect } from 'vitest';
import { extractPackageFromFqn } from './extract-package-from-fqn.js';

describe('extractPackageFromFqn', () => {
  describe('dot-separated paths (Kotlin/Java)', () => {
    it('should extract package from simple FQN', () => {
      expect(extractPackageFromFqn('com.example.payment.PaymentService.process')).toBe(
        'com.example.payment'
      );
    });

    it('should handle nested classes', () => {
      expect(extractPackageFromFqn('com.example.payment.PaymentService.Inner.method')).toBe(
        'com.example.payment'
      );
    });

    it('should return null for single segment', () => {
      expect(extractPackageFromFqn('PaymentService')).toBe(null);
    });

    it('should handle lowercase-only FQN', () => {
      expect(extractPackageFromFqn('com.example.payment.service')).toBe('com.example.payment');
    });
  });

  describe('slash-separated paths (TypeScript/JavaScript)', () => {
    it('should extract module path from TypeScript FQN', () => {
      expect(extractPackageFromFqn('src/payment/PaymentService')).toBe('src/payment');
    });

    it('should handle nested paths', () => {
      expect(extractPackageFromFqn('src/modules/payment/services/PaymentService')).toBe(
        'src/modules/payment/services'
      );
    });

    it('should handle scoped packages', () => {
      expect(extractPackageFromFqn('@company/package/Service')).toBe('@company/package');
    });

    it('should handle class method path', () => {
      expect(extractPackageFromFqn('src/user/UserController/create')).toBe('src/user');
    });

    it('should return null for single segment with slash', () => {
      expect(extractPackageFromFqn('Service')).toBe(null);
    });

    it('should handle file-like paths', () => {
      expect(extractPackageFromFqn('lib/utils/helpers')).toBe('lib/utils');
    });
  });
});
