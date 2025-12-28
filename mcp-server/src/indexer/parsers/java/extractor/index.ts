/**
 * Java Symbol Extractor
 *
 * Extracts symbols from a Java AST produced by tree-sitter-java.
 * This is the main entry point for the extractor module.
 */

import type { Tree } from '../parser.js';
import type { ParsedFile } from '../../../types.js';

/**
 * Extract all symbols from a Java AST.
 *
 * @param tree - The tree-sitter AST
 * @param filePath - Path to the source file
 * @returns Parsed file with all extracted symbols
 */
export function extractSymbols(_tree: Tree, filePath: string): ParsedFile {
  // TODO: Implement extraction in Phase 2
  return {
    filePath,
    language: 'java',
    packageName: undefined,
    imports: [],
    classes: [],
    topLevelFunctions: [], // Java doesn't have top-level functions
    topLevelProperties: [], // Java doesn't have top-level properties
    typeAliases: [], // Java doesn't have type aliases
    destructuringDeclarations: [],
    objectExpressions: [],
  };
}
