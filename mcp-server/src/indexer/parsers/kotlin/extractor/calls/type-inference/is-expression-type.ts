/**
 * Check if a node type is an expression type.
 */

/**
 * List of AST node types that represent expressions.
 */
const expressionTypes = [
  'integer_literal',
  'long_literal',
  'real_literal',
  'string_literal',
  'character_literal',
  'boolean_literal',
  'null_literal',
  'call_expression',
  'navigation_expression',
  'simple_identifier',
  'prefix_expression',
  'postfix_expression',
  'additive_expression',
  'multiplicative_expression',
  'comparison_expression',
  'equality_expression',
  'conjunction_expression',
  'disjunction_expression',
  'lambda_literal',
  'object_literal',
  'collection_literal',
  'if_expression',
  'when_expression',
  'try_expression',
  'parenthesized_expression',
];

/**
 * Check if a node type is an expression type.
 */
export function isExpressionType(type: string): boolean {
  return expressionTypes.includes(type);
}
