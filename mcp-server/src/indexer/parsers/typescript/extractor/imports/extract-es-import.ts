/**
 * Extract ES6 imports from a TypeScript/JavaScript import_statement node.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract ES6 imports from an import_statement.
 * A single statement can generate multiple ParsedImport entries (for named imports).
 */
export function extractEsImport(node: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  // Find the module path (string node)
  const sourceNode = findChildByType(node, 'string');
  if (!sourceNode) return imports;

  const path = sourceNode.text.slice(1, -1); // Remove quotes

  // Check if it's a type-only import: import type { X } from 'y'
  const isTypeOnly = node.children.some((c) => c.type === 'type');

  // Find the import_clause
  const importClause = findChildByType(node, 'import_clause');
  if (!importClause) {
    // Side-effect import: import 'module'
    imports.push({ path, isTypeOnly: isTypeOnly || undefined });
    return imports;
  }

  for (const child of importClause.children) {
    switch (child.type) {
      case 'identifier':
        // Default import: import X from 'y'
        imports.push({
          path,
          name: child.text,
          isTypeOnly: isTypeOnly || undefined,
        });
        break;

      case 'namespace_import':
        // Namespace import: import * as X from 'y'
        {
          const aliasNode = findChildByType(child, 'identifier');
          imports.push({
            path,
            alias: aliasNode?.text,
            isWildcard: true,
            isTypeOnly: isTypeOnly || undefined,
          });
        }
        break;

      case 'named_imports':
        // Named imports: import { X, Y as Z } from 'y'
        for (const specifier of child.children) {
          if (specifier.type === 'import_specifier') {
            const names = specifier.children.filter((c) => c.type === 'identifier');
            const name = names[0]?.text;
            const alias = names.length > 1 ? names[1]?.text : undefined;
            if (name) {
              imports.push({
                path,
                name,
                alias,
                isTypeOnly: isTypeOnly || undefined,
              });
            }
          }
        }
        break;
    }
  }

  return imports;
}
