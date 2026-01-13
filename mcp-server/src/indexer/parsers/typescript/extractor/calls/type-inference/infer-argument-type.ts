/**
 * Infer the type of a function argument.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findFirstExpression } from './find-first-expression.js';
import { inferExpressionType } from './infer-expression-type.js';

/**
 * Infer the type of an argument from its expression.
 * Returns the inferred type or 'unknown' if it cannot be determined.
 */
export function inferArgumentType(argumentNode: SyntaxNode): string {
  // The argument node itself might be the expression, or contain it
  if (
    argumentNode.type === 'number' ||
    argumentNode.type === 'string' ||
    argumentNode.type === 'true' ||
    argumentNode.type === 'false' ||
    argumentNode.type === 'null' ||
    argumentNode.type === 'undefined' ||
    argumentNode.type === 'identifier' ||
    argumentNode.type === 'array' ||
    argumentNode.type === 'object' ||
    argumentNode.type === 'arrow_function' ||
    argumentNode.type === 'function_expression' ||
    argumentNode.type === 'call_expression' ||
    argumentNode.type === 'member_expression' ||
    argumentNode.type === 'new_expression' ||
    argumentNode.type === 'template_string' ||
    argumentNode.type === 'binary_expression' ||
    argumentNode.type === 'unary_expression' ||
    argumentNode.type === 'ternary_expression' ||
    argumentNode.type === 'parenthesized_expression' ||
    argumentNode.type === 'as_expression' ||
    argumentNode.type === 'await_expression' ||
    argumentNode.type === 'regex'
  ) {
    return inferExpressionType(argumentNode);
  }

  // Try to find the expression inside
  const expression = findFirstExpression(argumentNode);
  if (!expression) return 'unknown';

  return inferExpressionType(expression);
}
