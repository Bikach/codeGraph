/**
 * Extract Package From FQN Tests
 */

import { describe, it, expect } from 'vitest';
import { extractPackageFromFqn } from './extract-package-from-fqn.js';

describe('extractPackageFromFqn', () => {
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
