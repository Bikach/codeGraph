/**
 * Object expression extraction for TypeScript parsing.
 */
export {
  extractObjectExpression,
  findObjectExpressions,
} from './extract-object-expression.js';

// Note: isObjectExpression is not exported from index as it's only used in tests.
// Tests can import it directly from ./extract-object-expression.js if needed.
