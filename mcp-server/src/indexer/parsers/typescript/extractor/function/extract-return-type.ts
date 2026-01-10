/**
 * Extract return type from TypeScript function AST nodes.
 */
import type { SyntaxNode } from 'tree-sitter';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';

/**
 * Extract the return type from a function or method declaration.
 *
 * The return type is in a type_annotation after the formal_parameters.
 * Returns undefined if no return type is specified.
 */
export function extractReturnType(node: SyntaxNode): string | undefined {
  // Find type_annotation that comes after formal_parameters
  let foundParams = false;

  for (const child of node.children) {
    if (child.type === 'formal_parameters') {
      foundParams = true;
      continue;
    }

    if (foundParams && child.type === 'type_annotation') {
      return extractFullTypeName(child);
    }

    // Stop if we hit the body or other non-type nodes
    if (child.type === 'statement_block' || child.type === '=>') {
      break;
    }
  }

  return undefined;
}
