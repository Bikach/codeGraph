/**
 * TypeScript Symbol Extractor - Main Entry Point
 *
 * Traverses the tree-sitter AST and extracts TypeScript/JavaScript symbols
 * into the normalized ParsedFile format.
 */

import type { SyntaxNode, Tree } from 'tree-sitter';
import type { ParsedFile } from '../../../types.js';

import { extractImports } from './imports/index.js';
import { extractClass } from './class/extract-class.js';
import { extractInterface } from './class/extract-interface.js';
import { extractEnum } from './class/extract-enum.js';
import { extractFunction } from './function/extract-function.js';
import {
  extractArrowFunction,
  isArrowFunctionDeclarator,
  getArrowFunction,
} from './function/extract-arrow-function.js';
import { extractVariable, isVariableFunction } from './property/extract-variable.js';
import {
  extractDestructuring,
  isDestructuringDeclarator,
} from './destructuring/index.js';
import {
  extractObjectExpression,
  findObjectExpressions,
} from './object-expression/index.js';

/**
 * Extract all symbols from a TypeScript/JavaScript AST.
 *
 * @param tree - The tree-sitter AST
 * @param filePath - Path to the source file
 * @returns ParsedFile with extracted symbols
 */
export function extractSymbols(tree: Tree, filePath: string): ParsedFile {
  const root = tree.rootNode;

  const result: ParsedFile = {
    filePath,
    language: 'typescript',
    packageName: undefined, // TypeScript doesn't have package declarations
    imports: extractImports(root),
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
  };

  // Traverse top-level declarations
  traverseTopLevel(root, result);

  // Extract object expressions from variable assignments
  extractObjectExpressions(root, result);

  return result;
}

/**
 * Traverse top-level nodes and extract symbols.
 *
 * Handles both direct declarations and export_statement wrappers.
 */
function traverseTopLevel(root: SyntaxNode, result: ParsedFile): void {
  for (const child of root.children) {
    // Handle export statements - unwrap and extract the inner declaration
    if (child.type === 'export_statement') {
      extractFromExportStatement(child, result);
      continue;
    }

    // Direct declarations
    extractDeclaration(child, result);
  }
}

/**
 * Extract declarations from an export_statement.
 *
 * export_statement can contain:
 * - export class Foo {}
 * - export function foo() {}
 * - export const x = ...
 * - export default ...
 * - export { ... }
 */
function extractFromExportStatement(exportNode: SyntaxNode, result: ParsedFile): void {
  for (const child of exportNode.children) {
    // Skip export keyword, default, type modifiers, etc.
    if (
      child.type === 'export' ||
      child.type === 'default' ||
      child.type === 'type' ||
      child.type === '{' ||
      child.type === '}' ||
      child.type === 'export_clause' ||
      child.type === 'from' ||
      child.type === 'string'
    ) {
      continue;
    }

    extractDeclaration(child, result);
  }
}

/**
 * Extract a single declaration based on its type.
 */
function extractDeclaration(node: SyntaxNode, result: ParsedFile): void {
  switch (node.type) {
    // Classes
    case 'class_declaration':
    case 'abstract_class_declaration':
      result.classes.push(extractClass(node));
      break;

    // Interfaces
    case 'interface_declaration':
      result.classes.push(extractInterface(node));
      break;

    // Enums
    case 'enum_declaration':
      result.classes.push(extractEnum(node));
      break;

    // Functions
    case 'function_declaration':
    case 'generator_function_declaration':
      result.topLevelFunctions.push(extractFunction(node));
      break;

    // Variables (const, let, var) - may contain arrow functions
    case 'lexical_declaration':
    case 'variable_declaration':
      extractVariableOrFunction(node, result);
      break;

    // Type aliases (type Foo = ...)
    case 'type_alias_declaration':
      // TODO: Implement type alias extraction if needed
      break;

    // Ambient declarations (declare ...)
    case 'ambient_declaration':
      extractAmbientDeclaration(node, result);
      break;
  }
}

/**
 * Extract variables, arrow functions, or destructuring declarations from a variable declaration.
 *
 * In TypeScript/JavaScript, we need to distinguish between:
 * - Regular variables: const x = 1
 * - Arrow functions: const foo = () => {}
 * - Destructuring: const { name, age } = user; or const [first, second] = array;
 */
function extractVariableOrFunction(node: SyntaxNode, result: ParsedFile): void {
  for (const child of node.children) {
    if (child.type === 'variable_declarator') {
      // Check if it's a destructuring declaration
      if (isDestructuringDeclarator(child)) {
        const destructuring = extractDestructuring(node, child);
        if (destructuring) {
          result.destructuringDeclarations.push(destructuring);
        }
        continue;
      }

      // Check if it's an arrow function
      if (isArrowFunctionDeclarator(child)) {
        const arrowFunc = getArrowFunction(child);
        if (arrowFunc) {
          result.topLevelFunctions.push(extractArrowFunction(child, arrowFunc));
        }
        continue;
      }

      // Check if it's a function expression
      if (isVariableFunction(child)) {
        continue;
      }

      // Regular variable (not a function expression or destructuring)
      const properties = extractVariable(node);
      result.topLevelProperties.push(...properties);
      return; // extractVariable handles all declarators in the node
    }
  }
}

/**
 * Extract declarations from ambient (declare) blocks.
 *
 * declare class Foo {}
 * declare function foo(): void
 * declare const x: number
 */
function extractAmbientDeclaration(node: SyntaxNode, result: ParsedFile): void {
  for (const child of node.children) {
    if (child.type === 'declare') continue;
    extractDeclaration(child, result);
  }
}

/**
 * Extract object expressions from variable assignments.
 *
 * Object expressions in TypeScript/JavaScript are object literals:
 * const handler = { name: 'handler', onClick() {} };
 *
 * We extract these for dependency tracking when objects are used
 * as implementations (e.g., passed to functions expecting interfaces).
 */
function extractObjectExpressions(root: SyntaxNode, result: ParsedFile): void {
  // Find all object literals in variable declarations
  const objects = findObjectExpressions(root);

  for (const objectNode of objects) {
    // Only extract top-level object expressions (direct variable assignments)
    // Skip nested objects to avoid duplicates
    if (isTopLevelObjectExpression(objectNode)) {
      result.objectExpressions.push(extractObjectExpression(objectNode));
    }
  }
}

/**
 * Check if an object expression is a top-level variable assignment.
 * This filters out nested objects and objects used as arguments.
 */
function isTopLevelObjectExpression(objectNode: SyntaxNode): boolean {
  const parent = objectNode.parent;
  if (!parent) return false;

  // Direct assignment: const x = { ... }
  if (parent.type === 'variable_declarator') {
    return true;
  }

  // Inside a pair value (nested object): { outer: { inner } }
  // We want to skip these as they're nested
  if (parent.type === 'pair') {
    return false;
  }

  return false;
}
