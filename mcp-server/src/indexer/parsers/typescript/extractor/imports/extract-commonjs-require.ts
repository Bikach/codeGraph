/**
 * Extract CommonJS require() calls from a TypeScript/JavaScript AST.
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
