/**
 * Extract CommonJS require() calls from a TypeScript/JavaScript AST.
 *
 * NOTE: This function is intentionally separate from extractImports() because:
 * 1. ES modules (import/export) are the standard in modern TypeScript/JavaScript
 * 2. CommonJS require() calls are typically found in Node.js-specific code or legacy codebases
 * 3. Mixing both in extractImports() would make it harder to distinguish module systems
 *
 * Usage: Call extractCommonJsRequires() in addition to extractImports() when analyzing
 * Node.js projects or mixed module system codebases.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedImport } from '../../../../types.js';
import { findChildByType, traverseNode } from '../ast-utils/index.js';

/**
 * Extract CommonJS require() calls.
 * These are treated as imports for the dependency graph.
 *
 * Handles patterns like:
 * - const x = require('module')
 * - const { a, b } = require('module')
 * - require('module') (side-effect)
 *
 * @param root - The root AST node to search
 * @returns Array of ParsedImport representing require() calls
 */
export function extractCommonJsRequires(root: SyntaxNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  traverseNode(root, (node) => {
    if (node.type === 'call_expression') {
      const funcName = node.children[0];
      if (funcName?.type === 'identifier' && funcName.text === 'require') {
        const args = findChildByType(node, 'arguments');
        const pathNode = args?.children.find((c) => c.type === 'string');
        if (pathNode) {
          const path = pathNode.text.slice(1, -1); // Remove quotes

          // Try to find the variable name if assigned
          let name: string | undefined;
          if (node.parent?.type === 'variable_declarator') {
            const idNode = findChildByType(node.parent, 'identifier');
            if (idNode) {
              name = idNode.text;
            }
          }

          imports.push({ path, name });
        }
      }
    }
  });

  return imports;
}
