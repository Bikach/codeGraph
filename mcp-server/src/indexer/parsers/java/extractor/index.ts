/**
 * Java Symbol Extractor
 *
 * Extracts symbols from a Java AST produced by tree-sitter-java.
 * This is the main entry point for the extractor module.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { Tree } from '../parser.js';
import type { ParsedFile, ParsedClass } from '../../../types.js';
import { extractPackageName, extractImports } from './package/index.js';
import { extractClass } from './class/index.js';

/**
 * Type declaration node types in Java.
 */
const TYPE_DECLARATION_TYPES = [
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'annotation_type_declaration',
  'record_declaration',
];

/**
 * Extract all top-level classes from a Java AST root node.
 *
 * In Java, a file can contain multiple top-level type declarations,
 * but only one can be public and must match the filename.
 *
 * @param root - The root AST node (program)
 * @returns Array of parsed classes
 */
function extractClasses(root: SyntaxNode): ParsedClass[] {
  const classes: ParsedClass[] = [];

  for (const child of root.children) {
    if (TYPE_DECLARATION_TYPES.includes(child.type)) {
      classes.push(extractClass(child));
    }
  }

  return classes;
}

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
    reexports: [], // Java doesn't have re-exports
    classes: extractClasses(root),
    topLevelFunctions: [], // Java doesn't have top-level functions
    topLevelProperties: [], // Java doesn't have top-level properties
    typeAliases: [], // Java doesn't have type aliases
    destructuringDeclarations: [],
    objectExpressions: [],
  };
}
