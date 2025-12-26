/**
 * Assign Packages To Domains Tests
 */

import { describe, it, expect } from 'vitest';
import { assignPackagesToConfiguredDomains } from './assign-packages-to-domains.js';
import type { DomainConfig } from '../types.js';

describe('assignPackagesToConfiguredDomains', () => {
  it('should assign packages to configured domains based on patterns', () => {
    const packages = [
      'com.example.payment.service',
      'com.example.billing.invoice',
      'com.example.user.domain',
      'com.example.order.service', // Not in config
    ];

    const configs: DomainConfig[] = [
      {
        name: 'Billing',
        description: 'Billing and payments',
        patterns: ['com.example.payment.*', 'com.example.billing.*'],
      },
      {
        name: 'Identity',
        patterns: ['com.example.user.*', 'com.example.auth.*'],
      },
    ];

    const result = assignPackagesToConfiguredDomains(packages, configs);

    expect(result.domains).toHaveLength(2);

    const billingDomain = result.domains.find((d) => d.name === 'Billing');
    expect(billingDomain?.matchedPackages).toContain('com.example.payment.service');
    expect(billingDomain?.matchedPackages).toContain('com.example.billing.invoice');
    expect(billingDomain?.description).toBe('Billing and payments');

    const identityDomain = result.domains.find((d) => d.name === 'Identity');
    expect(identityDomain?.matchedPackages).toContain('com.example.user.domain');

    expect(result.unassigned).toEqual(['com.example.order.service']);
  });

  it('should return all packages as unassigned when no configs match', () => {
    const packages = ['com.example.order.service'];
    const configs: DomainConfig[] = [
      {
        name: 'Payment',
        patterns: ['com.example.payment.*'],
      },
    ];

    const result = assignPackagesToConfiguredDomains(packages, configs);

    expect(result.unassigned).toEqual(['com.example.order.service']);
  });

  it('should handle empty packages', () => {
    const configs: DomainConfig[] = [
      {
        name: 'Payment',
        patterns: ['com.example.payment.*'],
      },
    ];

    const result = assignPackagesToConfiguredDomains([], configs);

    expect(result.domains[0]?.matchedPackages).toEqual([]);
    expect(result.unassigned).toEqual([]);
  });

  it('should handle empty configs', () => {
    const packages = ['com.example.payment.service'];

    const result = assignPackagesToConfiguredDomains(packages, []);

    expect(result.domains).toEqual([]);
    expect(result.unassigned).toEqual(['com.example.payment.service']);
  });

  it('should use first matching domain (first match wins)', () => {
    const packages = ['com.example.payment.service'];
    const configs: DomainConfig[] = [
      {
        name: 'First',
        patterns: ['com.example.payment.*'],
      },
      {
        name: 'Second',
        patterns: ['com.example.payment.*'],
      },
    ];

    const result = assignPackagesToConfiguredDomains(packages, configs);

    const firstDomain = result.domains.find((d) => d.name === 'First');
    const secondDomain = result.domains.find((d) => d.name === 'Second');

    expect(firstDomain?.matchedPackages).toContain('com.example.payment.service');
    expect(secondDomain?.matchedPackages).toEqual([]);
  });
});
