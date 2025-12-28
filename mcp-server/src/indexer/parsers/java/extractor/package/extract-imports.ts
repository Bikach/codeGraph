/**
 * Extract imports from Java source file.
 *
 * Handles:
 * - Simple imports: import com.example.User;
 * - Wildcard imports: import com.example.*;
 * - Static imports: import static java.lang.Math.PI;
 * - Static wildcard: import static java.util.Collections.*;
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Extract all import declarations from the root of a Java AST.
 *
 * Java AST structure:
 * - import_declaration
 *   - "static" (optional, for static imports)
 *   - scoped_identifier (e.g., "java.util.List")
 *   - asterisk (optional, for wildcard imports)
 */
export function extractImports(root: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  for (const child of root.children) {
    if (child.type === 'import_declaration') {
      const parsed = parseImportDeclaration(child);
      if (parsed) {
        imports.push(parsed);
      }
    }
  }

  return imports;
}

/**
 * Parse a single import declaration node.
 */
function parseImportDeclaration(node: SyntaxNode): ParsedImport | undefined {
  // Check if it's a static import
  const isStatic = node.children.some((c) => c.type === 'static');

  // Check if it's a wildcard import
  const isWildcard = node.children.some((c) => c.type === 'asterisk');

  // Get the import path
  const scopedId = findChildByType(node, 'scoped_identifier');
  const identifier = findChildByType(node, 'identifier');
  const pathNode = scopedId ?? identifier;

  if (!pathNode) return undefined;

  let path = pathNode.text;

  // For static imports, encode with "static:" prefix
  // This allows the resolver to distinguish them without modifying types.ts
  if (isStatic) {
    path = `static:${path}`;
  }

  return {
    path,
    alias: undefined, // Java doesn't have import aliases
    isWildcard,
  };
}
