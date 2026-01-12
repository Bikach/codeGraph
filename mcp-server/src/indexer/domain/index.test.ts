/**
 * Domain Analyzer Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { analyzeDomains } from './index.js';
import type { ResolvedFile } from '../types.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const mockReadFile = vi.mocked(readFile);
const mockExistsSync = vi.mocked(existsSync);

describe('Domain Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeDomains', () => {
    it('should return empty result for empty files', async () => {
      const result = await analyzeDomains([]);

      expect(result.domains).toEqual([]);
      expect(result.dependencies).toEqual([]);
      expect(result.unassignedPackages).toEqual([]);
    });

    it('should infer domains from Kotlin package names', async () => {
      const files: ResolvedFile[] = [
        createMockFile('com.example.payment.domain', 'kotlin'),
        createMockFile('com.example.payment.service', 'kotlin'),
        createMockFile('com.example.user.domain', 'kotlin'),
        createMockFile('com.example.user.repository', 'kotlin'),
      ];

      const result = await analyzeDomains(files);

      expect(result.domains).toHaveLength(2);
      expect(result.domains.map((d) => d.name).sort()).toEqual(['Payment', 'User']);

      const paymentDomain = result.domains.find((d) => d.name === 'Payment');
      expect(paymentDomain?.matchedPackages).toContain('com.example.payment.domain');
      expect(paymentDomain?.matchedPackages).toContain('com.example.payment.service');

      const userDomain = result.domains.find((d) => d.name === 'User');
      expect(userDomain?.matchedPackages).toContain('com.example.user.domain');
      expect(userDomain?.matchedPackages).toContain('com.example.user.repository');
    });

    it('should infer domains from TypeScript paths', async () => {
      const files: ResolvedFile[] = [
        createMockFile('src/payment/service', 'typescript'),
        createMockFile('src/payment/types', 'typescript'),
        createMockFile('src/user/handler', 'typescript'),
      ];

      const result = await analyzeDomains(files);

      expect(result.domains).toHaveLength(2);
      expect(result.domains.map((d) => d.name).sort()).toEqual(['Payment', 'User']);
    });

    it('should skip common non-domain segments', async () => {
      const files: ResolvedFile[] = [
        createMockFile('com.example.domain.payment.service', 'kotlin'),
        createMockFile('com.example.infrastructure.user.repo', 'kotlin'),
      ];

      const result = await analyzeDomains(files);

      // Should skip 'domain' and 'infrastructure' and use next segment
      expect(result.domains.map((d) => d.name).sort()).toEqual(['Payment', 'User']);
    });

    it('should calculate dependencies between domains', async () => {
      const files: ResolvedFile[] = [
        {
          ...createMockFile('com.example.order.service', 'kotlin'),
          resolvedCalls: [
            {
              fromFqn: 'com.example.order.service.OrderService.create',
              toFqn: 'com.example.payment.service.PaymentService.charge',
              location: { filePath: '', startLine: 1, startColumn: 0, endLine: 1, endColumn: 0 },
            },
            {
              fromFqn: 'com.example.order.service.OrderService.create',
              toFqn: 'com.example.user.service.UserService.get',
              location: { filePath: '', startLine: 2, startColumn: 0, endLine: 2, endColumn: 0 },
            },
          ],
        },
        createMockFile('com.example.payment.service', 'kotlin'),
        createMockFile('com.example.user.service', 'kotlin'),
      ];

      const result = await analyzeDomains(files);

      expect(result.dependencies).toHaveLength(2);

      const orderToPayment = result.dependencies.find(
        (d) => d.from === 'Order' && d.to === 'Payment'
      );
      expect(orderToPayment).toBeDefined();
      expect(orderToPayment?.weight).toBe(1);

      const orderToUser = result.dependencies.find((d) => d.from === 'Order' && d.to === 'User');
      expect(orderToUser).toBeDefined();
      expect(orderToUser?.weight).toBe(1);
    });

    it('should not create self-referencing dependencies', async () => {
      const files: ResolvedFile[] = [
        {
          ...createMockFile('com.example.payment.service', 'kotlin'),
          resolvedCalls: [
            {
              fromFqn: 'com.example.payment.service.PaymentService.process',
              toFqn: 'com.example.payment.validator.PaymentValidator.validate',
              location: { filePath: '', startLine: 1, startColumn: 0, endLine: 1, endColumn: 0 },
            },
          ],
        },
        createMockFile('com.example.payment.validator', 'kotlin'),
      ];

      const result = await analyzeDomains(files);

      // No self-referencing Payment -> Payment dependency
      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('with config file', () => {
    it('should use config file when present', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          domains: [
            {
              name: 'Billing',
              description: 'Billing and payments',
              patterns: ['com.example.payment.*', 'com.example.billing.*'],
            },
            {
              name: 'Identity',
              patterns: ['com.example.user.*', 'com.example.auth.*'],
            },
          ],
        })
      );

      const files: ResolvedFile[] = [
        createMockFile('com.example.payment.service', 'kotlin'),
        createMockFile('com.example.user.domain', 'kotlin'),
        createMockFile('com.example.order.service', 'kotlin'), // Not in config
      ];

      const result = await analyzeDomains(files);

      // Should have 3 domains: 2 from config + 1 inferred
      expect(result.domains.map((d) => d.name).sort()).toEqual(['Billing', 'Identity', 'Order']);

      const billingDomain = result.domains.find((d) => d.name === 'Billing');
      expect(billingDomain?.description).toBe('Billing and payments');
      expect(billingDomain?.matchedPackages).toContain('com.example.payment.service');
    });

    it('should match glob patterns correctly', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          domains: [
            {
              name: 'Core',
              patterns: ['com.example.core.**'],
            },
          ],
        })
      );

      const files: ResolvedFile[] = [
        createMockFile('com.example.core.domain.user', 'kotlin'),
        createMockFile('com.example.core.service.impl', 'kotlin'),
        createMockFile('com.example.other', 'kotlin'),
      ];

      const result = await analyzeDomains(files);

      const coreDomain = result.domains.find((d) => d.name === 'Core');
      expect(coreDomain?.matchedPackages).toHaveLength(2);
      expect(coreDomain?.matchedPackages).toContain('com.example.core.domain.user');
      expect(coreDomain?.matchedPackages).toContain('com.example.core.service.impl');
    });
  });

  describe('pattern matching', () => {
    it('should match single wildcard patterns', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          domains: [
            {
              name: 'Payment',
              patterns: ['com.example.payment.*'],
            },
          ],
        })
      );

      const files: ResolvedFile[] = [
        createMockFile('com.example.payment.service', 'kotlin'),
        createMockFile('com.example.payment.domain.model', 'kotlin'), // Should NOT match (too deep)
      ];

      const result = await analyzeDomains(files);

      const paymentDomain = result.domains.find((d) => d.name === 'Payment');
      expect(paymentDomain?.matchedPackages).toContain('com.example.payment.service');
      expect(paymentDomain?.matchedPackages).not.toContain('com.example.payment.domain.model');
    });

    it('should match double wildcard patterns', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          domains: [
            {
              name: 'Payment',
              patterns: ['com.example.payment.**'],
            },
          ],
        })
      );

      const files: ResolvedFile[] = [
        createMockFile('com.example.payment.service', 'kotlin'),
        createMockFile('com.example.payment.domain.model', 'kotlin'),
        createMockFile('com.example.payment.infra.db.repo', 'kotlin'),
      ];

      const result = await analyzeDomains(files);

      const paymentDomain = result.domains.find((d) => d.name === 'Payment');
      expect(paymentDomain?.matchedPackages).toHaveLength(3);
    });
  });
});

/**
 * Create a mock ResolvedFile for testing.
 */
function createMockFile(
  packageName: string,
  language: 'kotlin' | 'java' | 'typescript' | 'javascript'
): ResolvedFile {
  return {
    filePath: `/src/${packageName.replace(/\./g, '/')}/File.kt`,
    language,
    packageName,
    imports: [],
    reexports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    resolvedCalls: [],
  };
}
