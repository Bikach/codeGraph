/**
 * Kotlin Symbol Extractor - Main Entry Point
 *
 * Traverses the tree-sitter AST and extracts Kotlin symbols into
 * the normalized ParsedFile format.
 */

import type { SyntaxNode, Tree } from 'tree-sitter';
import type { ParsedFile, ParsedClass } from '../../../types.js';

import { extractPackageName, extractImports } from './package/index.js';
import { extractProperty } from './property/index.js';
import { extractFunction } from './function/index.js';
import { extractTypeAlias, extractDestructuringDeclaration } from './advanced/index.js';
import { extractAllObjectExpressions } from './object-expressions/index.js';
import { extractClass, extractClassBody } from './class/index.js';
import { extractCompanionObject } from './companion/index.js';

/**
 * Create a bound extractClassBody function that captures the recursive extractors.
 */
function createClassBodyExtractor() {
  // Create mutually recursive extractors
  const boundExtractCompanionObject = (node: SyntaxNode): ParsedClass => {
    return extractCompanionObject(node, (classBody) =>
      extractClassBody(classBody, boundExtractClass, boundExtractCompanionObject)
    );
  };

  const boundExtractClass = (node: SyntaxNode): ParsedClass => {
    return extractClass(node, boundExtractCompanionObject);
  };

  return {
    extractClass: boundExtractClass,
    extractCompanionObject: boundExtractCompanionObject,
    extractClassBody: (classBody: SyntaxNode | undefined) =>
      extractClassBody(classBody, boundExtractClass, boundExtractCompanionObject),
  };
}

/**
 * Extract all symbols from a Kotlin AST.
 */
export function extractSymbols(tree: Tree, filePath: string): ParsedFile {
  const root = tree.rootNode;
  const { extractClass: boundExtractClass, extractClassBody: boundExtractClassBody } = createClassBodyExtractor();

  const result: ParsedFile = {
    filePath,
    language: 'kotlin',
    packageName: extractPackageName(root),
    imports: extractImports(root),
    reexports: [], // Kotlin doesn't have re-exports
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
  };

  // Traverse top-level declarations
  for (const child of root.children) {
    switch (child.type) {
      case 'class_declaration':
      case 'interface_declaration':
      case 'object_declaration':
      case 'enum_class_declaration':
      case 'annotation_declaration':
        result.classes.push(boundExtractClass(child));
        break;

      case 'function_declaration':
        result.topLevelFunctions.push(extractFunction(child));
        break;

      case 'property_declaration': {
        // Check for destructuring declaration
        const destructuring = extractDestructuringDeclaration(child);
        if (destructuring) {
          result.destructuringDeclarations.push(destructuring);
        } else {
          result.topLevelProperties.push(extractProperty(child));
        }
        break;
      }

      case 'type_alias':
        result.typeAliases.push(extractTypeAlias(child));
        break;
    }
  }

  // Extract object expressions from all function bodies for dependency tracking
  result.objectExpressions = extractAllObjectExpressions(root, boundExtractClassBody);

  return result;
}
