/**
 * Object Expressions module
 *
 * Exports functions for extracting Kotlin object expressions (anonymous objects).
 */

export { extractObjectExpression } from './extract-object-expression.js';
export { extractAllObjectExpressions } from './extract-all-object-expressions.js';
export type { ClassBodyExtractor, ClassBodyResult } from './types.js';
