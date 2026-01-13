/**
 * Extract types from all arguments in an arguments node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { inferArgumentType } from './infer-argument-type.js';

/**
 * Extract types from all arguments in an arguments node.
 * Returns an array of inferred types for each argument.
 */
export function extractArgumentTypes(args: SyntaxNode): string[] {
  const types: string[] = [];

  for (const child of args.children) {
    // Skip parentheses and commas
    if (child.type === '(' || child.type === ')' || child.type === ',') {
      continue;
    }

    // Infer the type of this argument
    const argType = inferArgumentType(child);
    types.push(argType);
  }

  return types;
}
