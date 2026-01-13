/**
 * Check if a node type is an expression type in TypeScript AST.
 */

/**
 * List of AST node types that represent expressions in TypeScript.
 */
const expressionTypes = [
  // Literals
  'number',
  'string',
  'true',
  'false',
  'null',
  'undefined',
  'regex',
  'template_string',

  // Expressions
  'identifier',
  'call_expression',
  'member_expression',
  'subscript_expression',
  'new_expression',
  'await_expression',
  'unary_expression',
  'binary_expression',
  'ternary_expression',
  'update_expression',
  'assignment_expression',
  'augmented_assignment_expression',
  'parenthesized_expression',
  'arrow_function',
  'function_expression',
  'class_expression',
  'object',
  'array',
  'spread_element',
  'yield_expression',
  'as_expression',
  'satisfies_expression',
  'non_null_expression',
  'type_assertion',
];

/**
 * Check if a node type is an expression type.
 */
export function isExpressionType(type: string): boolean {
  return expressionTypes.includes(type);
}
