/**
 * Java Symbol Extractor
 *
 * Extracts symbols from a Java AST produced by tree-sitter-java.
 * This is the main entry point for the extractor module.
 */

import type { Tree } from '../parser.js';
import type { ParsedFile } from '../../../types.js';
import { extractPackageName, extractImports } from './package/index.js';

/**
 * Extract all symbols from a Java AST.
 *
 * @param tree - The tree-sitter AST
 * @param filePath - Path to the source file
 * @returns Parsed file with all extracted symbols
 */
export function extractSymbols(tree: Tree, filePath: string): ParsedFile {
  const root = tree.rootNode;

  return {
    filePath,
    language: 'java',
    packageName: extractPackageName(root),
    imports: extractImports(root),
    classes: [], // TODO: Phase 3
    topLevelFunctions: [], // Java doesn't have top-level functions
    topLevelProperties: [], // Java doesn't have top-level properties
    typeAliases: [], // Java doesn't have type aliases
    destructuringDeclarations: [],
    objectExpressions: [],
  };
}
