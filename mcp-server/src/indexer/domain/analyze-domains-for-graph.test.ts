/**
 * analyzeDomainsForGraph — cross-language domain inference for the persisted graph (§3bis-B).
 * Focus: the TS/JS path (no package → module path) and the file → domain mapping. Dependency
 * weighting is NOT computed here (the writer derives it from the persisted graph) — see the
 * embedded-writer/reader tests for that.
 */

import { describe, it, expect } from 'vitest';
import { analyzeDomainsForGraph } from './index.js';
import type { ResolvedFile, SupportedLanguage } from '../types.js';

const rf = (filePath: string, language: SupportedLanguage, packageName: string | undefined): ResolvedFile => ({
  filePath,
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
});

describe('analyzeDomainsForGraph', () => {
  it('groups TS files by inferred (src-stripped) module path — no package needed', async () => {
    const files: ResolvedFile[] = [
      rf('/proj/src/billing/Invoice.ts', 'typescript', undefined),
      rf('/proj/src/auth/Login.ts', 'typescript', undefined),
    ];

    const result = await analyzeDomainsForGraph(files, { projectPath: '/proj' });

    // Domain = first segment after src.
    expect(result.domains).toEqual([
      { name: 'Auth', packages: ['auth'] },
      { name: 'Billing', packages: ['billing'] },
    ]);
    // Every file is mapped to its domain (the writer uses this to derive counts + deps).
    expect(result.fileDomain.get('/proj/src/billing/Invoice.ts')).toBe('Billing');
    expect(result.fileDomain.get('/proj/src/auth/Login.ts')).toBe('Auth');
  });

  it('still groups Kotlin/Java files by their package', async () => {
    const files: ResolvedFile[] = [
      rf('/proj/UserService.kt', 'kotlin', 'com.app.user'),
      rf('/proj/PayService.kt', 'kotlin', 'com.app.payment'),
    ];

    const result = await analyzeDomainsForGraph(files, { projectPath: '/proj' });

    expect(result.domains.map((d) => d.name).sort()).toEqual(['Payment', 'User']);
    expect(result.fileDomain.get('/proj/UserService.kt')).toBe('User');
  });

  it('returns empty when there are no group keys', async () => {
    const result = await analyzeDomainsForGraph([], { projectPath: '/proj' });
    expect(result.domains).toEqual([]);
    expect(result.fileDomain.size).toBe(0);
  });

  it('groups a multi-module Maven build by module (dir above src), not by package (P3)', async () => {
    // Every package is com.macro.mall.* → package grouping would collapse to ONE domain. The module
    // boundary (the directory above `src`) recovers the 7-module structure.
    const files: ResolvedFile[] = [
      rf('/mall/mall-admin/src/main/java/com/macro/mall/admin/A.java', 'java', 'com.macro.mall.admin'),
      rf('/mall/mall-portal/src/main/java/com/macro/mall/portal/B.java', 'java', 'com.macro.mall.portal'),
      rf('/mall/mall-common/src/main/java/com/macro/mall/common/C.java', 'java', 'com.macro.mall.common'),
    ];

    const result = await analyzeDomainsForGraph(files, { projectPath: '/mall' });

    expect(result.domains.map((d) => d.name).sort()).toEqual(['Mall-admin', 'Mall-common', 'Mall-portal']);
    expect(result.fileDomain.get('/mall/mall-admin/src/main/java/com/macro/mall/admin/A.java')).toBe('Mall-admin');
  });

  it('keeps package grouping for a single-module build (src at the project root)', async () => {
    // Only one `src` boundary (no module wrapper) → falls back to package-based domains, unchanged.
    const files: ResolvedFile[] = [
      rf('/pet/src/main/java/org/app/owner/Owner.java', 'java', 'org.app.owner'),
      rf('/pet/src/main/java/org/app/vet/Vet.java', 'java', 'org.app.vet'),
    ];

    const result = await analyzeDomainsForGraph(files, { projectPath: '/pet' });

    expect(result.domains.map((d) => d.name).sort()).toEqual(['Owner', 'Vet']);
  });
});
