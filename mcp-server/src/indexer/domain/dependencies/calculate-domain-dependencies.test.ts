/**
 * Calculate Domain Dependencies Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateDomainDependencies } from './calculate-domain-dependencies.js';
import type { ResolvedFile } from '../../types.js';
import type { Domain } from '../types.js';

function createMockFile(
  packageName: string,
  resolvedCalls: { fromFqn: string; toFqn: string }[] = []
): ResolvedFile {
  return {
    filePath: `/src/${packageName.replace(/\./g, '/')}/File.kt`,
    language: 'kotlin',
    packageName,
    imports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    resolvedCalls: resolvedCalls.map((call) => ({
      ...call,
      location: { filePath: '', startLine: 1, startColumn: 0, endLine: 1, endColumn: 0 },
    })),
  };
}

describe('calculateDomainDependencies', () => {
  it('should calculate dependencies between domains', () => {
    const files: ResolvedFile[] = [
      createMockFile('com.example.order.service', [
        {
          fromFqn: 'com.example.order.service.OrderService.create',
          toFqn: 'com.example.payment.service.PaymentService.charge',
        },
        {
          fromFqn: 'com.example.order.service.OrderService.create',
          toFqn: 'com.example.user.service.UserService.get',
        },
      ]),
      createMockFile('com.example.payment.service'),
      createMockFile('com.example.user.service'),
    ];

    const domains: Domain[] = [
      { name: 'Order', patterns: [], matchedPackages: ['com.example.order.service'] },
      { name: 'Payment', patterns: [], matchedPackages: ['com.example.payment.service'] },
      { name: 'User', patterns: [], matchedPackages: ['com.example.user.service'] },
    ];

    const result = calculateDomainDependencies(files, domains);

    expect(result).toHaveLength(2);

    const orderToPayment = result.find((d) => d.from === 'Order' && d.to === 'Payment');
    expect(orderToPayment).toBeDefined();
    expect(orderToPayment?.weight).toBe(1);

    const orderToUser = result.find((d) => d.from === 'Order' && d.to === 'User');
    expect(orderToUser).toBeDefined();
    expect(orderToUser?.weight).toBe(1);
  });

  it('should not create self-referencing dependencies', () => {
    const files: ResolvedFile[] = [
      createMockFile('com.example.payment.service', [
        {
          fromFqn: 'com.example.payment.service.PaymentService.process',
          toFqn: 'com.example.payment.validator.PaymentValidator.validate',
        },
      ]),
      createMockFile('com.example.payment.validator'),
    ];

    const domains: Domain[] = [
      {
        name: 'Payment',
        patterns: [],
        matchedPackages: ['com.example.payment.service', 'com.example.payment.validator'],
      },
    ];

    const result = calculateDomainDependencies(files, domains);

    expect(result).toHaveLength(0);
  });

  it('should aggregate multiple calls to same domain', () => {
    const files: ResolvedFile[] = [
      createMockFile('com.example.order.service', [
        {
          fromFqn: 'com.example.order.service.OrderService.create',
          toFqn: 'com.example.payment.service.PaymentService.charge',
        },
        {
          fromFqn: 'com.example.order.service.OrderService.update',
          toFqn: 'com.example.payment.service.PaymentService.refund',
        },
      ]),
    ];

    const domains: Domain[] = [
      { name: 'Order', patterns: [], matchedPackages: ['com.example.order.service'] },
      { name: 'Payment', patterns: [], matchedPackages: ['com.example.payment.service'] },
    ];

    const result = calculateDomainDependencies(files, domains);

    expect(result).toHaveLength(1);
    expect(result[0]?.weight).toBe(2);
  });

  it('should sort dependencies by weight descending', () => {
    const files: ResolvedFile[] = [
      createMockFile('com.example.order.service', [
        {
          fromFqn: 'com.example.order.service.OrderService.a',
          toFqn: 'com.example.payment.service.PaymentService.a',
        },
        {
          fromFqn: 'com.example.order.service.OrderService.b',
          toFqn: 'com.example.payment.service.PaymentService.b',
        },
        {
          fromFqn: 'com.example.order.service.OrderService.c',
          toFqn: 'com.example.payment.service.PaymentService.c',
        },
        {
          fromFqn: 'com.example.order.service.OrderService.d',
          toFqn: 'com.example.user.service.UserService.d',
        },
      ]),
    ];

    const domains: Domain[] = [
      { name: 'Order', patterns: [], matchedPackages: ['com.example.order.service'] },
      { name: 'Payment', patterns: [], matchedPackages: ['com.example.payment.service'] },
      { name: 'User', patterns: [], matchedPackages: ['com.example.user.service'] },
    ];

    const result = calculateDomainDependencies(files, domains);

    expect(result[0]?.weight).toBe(3); // Order -> Payment
    expect(result[1]?.weight).toBe(1); // Order -> User
  });
});
