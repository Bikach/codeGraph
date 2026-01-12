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

/**
 * Extract return type from an arrow function.
 *
 * The return type appears after formal_parameters but before =>.
 * This is also used for arrow functions in object literals.
 *
 * @param arrowFunc - The arrow_function AST node
 * @returns The return type string or undefined
 */
export function extractArrowReturnType(arrowFunc: SyntaxNode): string | undefined {
  let foundParams = false;

  for (const child of arrowFunc.children) {
    if (child.type === 'formal_parameters') {
      foundParams = true;
      continue;
    }

    if (foundParams && child.type === 'type_annotation') {
      return extractFullTypeName(child);
    }

    if (child.type === '=>') {
      break;
    }
  }

  return undefined;
}
