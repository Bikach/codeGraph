/**
 * Merge Domains Tests
 */

import { describe, it, expect } from 'vitest';
import { mergeDomains } from './merge-domains.js';
import type { Domain } from '../types.js';

describe('mergeDomains', () => {
  it('should merge two domain lists without duplicates', () => {
    const existing: Domain[] = [
      { name: 'Payment', patterns: ['*.payment.*'], matchedPackages: ['com.example.payment'] },
    ];
    const inferred: Domain[] = [
      { name: 'User', patterns: ['*.user.*'], matchedPackages: ['com.example.user'] },
    ];

    const result = mergeDomains(existing, inferred);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.name)).toEqual(['Payment', 'User']);
  });

  it('should skip duplicates case-insensitively', () => {
    const existing: Domain[] = [
      { name: 'Payment', patterns: ['*.payment.*'], matchedPackages: ['com.example.payment'] },
    ];
    const inferred: Domain[] = [
      { name: 'payment', patterns: ['*.payment2.*'], matchedPackages: ['com.example.payment2'] },
    ];

    const result = mergeDomains(existing, inferred);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Payment');
  });

  it('should handle empty existing list', () => {
    const existing: Domain[] = [];
    const inferred: Domain[] = [
      { name: 'User', patterns: ['*.user.*'], matchedPackages: ['com.example.user'] },
    ];

    const result = mergeDomains(existing, inferred);

    expect(result).toHaveLength(1);
  });

  it('should handle empty inferred list', () => {
    const existing: Domain[] = [
      { name: 'Payment', patterns: ['*.payment.*'], matchedPackages: ['com.example.payment'] },
    ];
    const inferred: Domain[] = [];

    const result = mergeDomains(existing, inferred);

    expect(result).toHaveLength(1);
  });
});
