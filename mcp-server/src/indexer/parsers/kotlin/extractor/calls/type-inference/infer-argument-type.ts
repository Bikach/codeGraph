/**
 * Infer the type of a function argument.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findFirstExpression } from './find-first-expression.js';
import { inferExpressionType } from './infer-expression-type.js';

/**
 * Infer the type of an argument from its expression.
 * Returns the inferred type or 'Unknown' if it cannot be determined.
 */
export function inferArgumentType(valueArgument: SyntaxNode): string {
  // value_argument may contain: expression, named argument (name = expression), or spread (*array)
  // Skip the name part for named arguments
  const expression = findFirstExpression(valueArgument);
  if (!expression) return 'Unknown';

  return inferExpressionType(expression);
}
