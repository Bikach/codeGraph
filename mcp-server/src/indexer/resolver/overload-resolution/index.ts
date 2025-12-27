/**
 * Overload resolution module for the resolver.
 */

export { normalizeType } from './normalize-type.js';
export { isTypeCompatible } from './is-type-compatible.js';
export { scoreOverloadMatch } from './score-overload-match.js';
export { selectBestOverload } from './select-best-overload.js';
export { findMethodsInType } from './find-methods-in-type.js';
export { findFunctionsInPackage } from './find-functions-in-package.js';
