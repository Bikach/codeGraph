/**
 * Class extraction functions for Java parsing.
 */
export { mapClassKind, isRecordDeclaration } from './map-class-kind.js';
export { extractSuperTypes } from './extract-super-types.js';
export type { SuperTypesResult } from './extract-super-types.js';
export { extractClassBody } from './extract-class-body.js';
export type { ClassBodyResult, ClassExtractor } from './extract-class-body.js';
export { extractClass } from './extract-class.js';
