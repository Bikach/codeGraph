/**
 * Function/method extraction functions for TypeScript parsing.
 */
export {
  extractFunction,
  extractMethod,
  extractFunctionSignature,
  extractMethodSignature,
  toOverloadSignature,
  linkOverloadsToImplementations,
} from './extract-function.js';
export { extractMethodSignature as extractInterfaceMethodSignature } from './extract-method.js';
export { extractArrowFunction, isArrowFunctionDeclarator, getArrowFunction } from './extract-arrow-function.js';
export { extractParameters } from './extract-parameters.js';
export { extractReturnType } from './extract-return-type.js';
export { extractTypeGuard } from './extract-type-guard.js';
