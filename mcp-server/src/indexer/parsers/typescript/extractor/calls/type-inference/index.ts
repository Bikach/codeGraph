/**
 * Type inference module for TypeScript call arguments.
 *
 * This module provides type inference for function arguments based on
 * their AST representation. It can infer types from:
 * - Literals (string, number, boolean, null, undefined, bigint, regex)
 * - Array literals (with element type inference)
 * - Object literals
 * - Function expressions (arrow functions, function expressions)
 * - Constructor calls (new expressions)
 * - Type assertions (as expressions)
 * - Binary and unary expressions
 *
 * Limitations:
 * - Cannot infer types from identifiers (variable references)
 * - Cannot infer types from function call return values
 * - Cannot infer types from member access expressions
 * - Does not perform type narrowing or union type analysis
 */

export { isExpressionType } from './is-expression-type.js';
export { findFirstExpression } from './find-first-expression.js';
export { inferExpressionType } from './infer-expression-type.js';
export { inferArgumentType } from './infer-argument-type.js';
export { extractArgumentTypes } from './extract-argument-types.js';
