/**
 * Extract re-exports from TypeScript/JavaScript export statements.
 *
 * Handles the following patterns:
 * - Named re-export: export { foo as bar } from './module';
 * - Namespace re-export: export * as utils from './utils';
 * - Default re-export: export { default as Component } from './Component';
 * - Wildcard re-export: export * from './module';
 * - Type re-export: export type { User as AppUser } from './types';
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedReexport } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Check if an export_statement is a re-export (has 'from' clause).
 */
export function isReexportStatement(node: SyntaxNode): boolean {
  if (node.type !== 'export_statement') return false;
  return node.children.some((c) => c.type === 'from');
}

/**
 * Extract re-exports from an export_statement that has a 'from' clause.
 * A single statement can generate multiple ParsedReexport entries (for named re-exports).
 */
export function extractReexport(node: SyntaxNode): ParsedReexport[] {
  if (!isReexportStatement(node)) return [];

  const reexports: ParsedReexport[] = [];

  // Find the source module path (string node after 'from')
  const sourceNode = findChildByType(node, 'string');
  if (!sourceNode) return reexports;

  const sourcePath = sourceNode.text.slice(1, -1); // Remove quotes

  // Check if it's a type-only re-export: export type { X } from 'y'
  const isTypeOnly = node.children.some((c) => c.type === 'type');

  // Check for namespace re-export: export * as X from 'y'
  const namespaceExport = findChildByType(node, 'namespace_export');
  if (namespaceExport) {
    const aliasNode = findChildByType(namespaceExport, 'identifier');
    reexports.push({
      sourcePath,
      exportedName: aliasNode?.text,
      isNamespaceReexport: true,
      isTypeOnly: isTypeOnly || undefined,
    });
    return reexports;
  }

  // Check for wildcard re-export without alias: export * from 'y'
  const hasWildcard = node.children.some((c) => c.type === '*');
  const hasExportClause = findChildByType(node, 'export_clause');

  if (hasWildcard && !hasExportClause) {
    reexports.push({
      sourcePath,
      isWildcard: true,
      isTypeOnly: isTypeOnly || undefined,
    });
    return reexports;
  }

  // Handle named re-exports: export { foo, bar as baz } from 'y'
  const exportClause = findChildByType(node, 'export_clause');
  if (exportClause) {
    for (const child of exportClause.children) {
      if (child.type === 'export_specifier') {
        const identifiers = child.children.filter((c) => c.type === 'identifier');
        const originalName = identifiers[0]?.text;
        const exportedName = identifiers.length > 1 ? identifiers[1]?.text : originalName;

        if (originalName) {
          reexports.push({
            sourcePath,
            originalName,
            exportedName,
            isTypeOnly: isTypeOnly || undefined,
          });
        }
      }
    }
  }

  return reexports;
}

/**
 * Extract all re-exports from the root of a TypeScript/JavaScript AST.
 */
export function extractReexports(root: SyntaxNode): ParsedReexport[] {
  const reexports: ParsedReexport[] = [];

  for (const child of root.children) {
    if (child.type === 'export_statement' && isReexportStatement(child)) {
      const extracted = extractReexport(child);
      reexports.push(...extracted);
    }
  }

  return reexports;
}
