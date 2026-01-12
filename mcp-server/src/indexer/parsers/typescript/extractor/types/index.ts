/**
 * Type extraction functions for TypeScript parsing.
 */
export { extractTypeAlias } from './extract-type-alias.js';
export { extractMappedType, isMappedType } from './extract-mapped-type.js';
export {
  extractConditionalType,
  isConditionalType,
  findConditionalTypeNode,
} from './extract-conditional-type.js';
