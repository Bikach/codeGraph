/**
 * Types for object expression extraction
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction, ParsedProperty } from '../../../../types.js';

/**
 * Result of extracting class body members.
 * This is a subset of the full ClassBodyResult used in extractor.ts.
 */
export interface ClassBodyResult {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
}

/**
 * Function type for extracting class body members.
 * Passed as dependency to avoid circular imports with extractor.ts.
 */
export type ClassBodyExtractor = (classBody: SyntaxNode | undefined) => ClassBodyResult;
