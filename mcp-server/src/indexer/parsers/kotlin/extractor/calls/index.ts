/**
 * Call extraction functions for Kotlin parsing.
 */
export {
  isExpressionType,
  inferExpressionType,
  findFirstExpression,
  inferArgumentType,
} from './type-inference/index.js';

export { extractNavigationPath, type NavigationPathResult } from './extract-navigation-path.js';
export { extractCallArguments, type CallArgumentsResult } from './extract-call-arguments.js';
export { extractCallExpression } from './extract-call-expression.js';
export { extractCalls } from './extract-calls.js';
