/**
 * Generics extraction functions for TypeScript parsing.
 */
export { extractTypeParameters } from './extract-type-parameters.js';
export { extractSingleTypeParameter } from './extract-single-type-parameter.js';

// Note: extractTypeParametersFromNode is not exported from index as it's only used in tests.
// Tests can import it directly from ./extract-type-parameters.js if needed.
