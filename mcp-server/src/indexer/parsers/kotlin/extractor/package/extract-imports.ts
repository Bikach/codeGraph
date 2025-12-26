/**
 * Extract imports from Kotlin source file.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract all import declarations from the root of a Kotlin AST.
 */
export function extractImports(root: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  // Imports are inside import_list
  const importList = root.children.find((c) => c.type === 'import_list');
  const importHeaders = importList ? importList.children : root.children;

  for (const child of importHeaders) {
    if (child.type === 'import_header') {
      const identifier = findChildByType(child, 'identifier');
      if (identifier) {
        const path = identifier.text;
        // Wildcard can be: path ends with *, STAR node, or wildcard_import node
        const isWildcard =
          path.endsWith('*') ||
          child.children.some((c) => c.type === 'STAR' || c.type === 'wildcard_import');
        const aliasNode = findChildByType(child, 'import_alias');

        imports.push({
          path: path.replace(/\.\*$/, ''),
          alias: aliasNode
            ? (findChildByType(aliasNode, 'type_identifier') ?? findChildByType(aliasNode, 'simple_identifier'))?.text
            : undefined,
          isWildcard,
        });
      }
    }
  }

  return imports;
}
