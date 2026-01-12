/**
 * Extract ambient module declarations from TypeScript AST nodes.
 *
 * Ambient module declarations are used for:
 * 1. Module augmentation: extending third-party types
 *    `declare module 'express' { interface Request { user?: User; } }`
 *
 * 2. Global augmentation: extending global scope
 *    `declare global { interface Window { myApp: MyApp; } }`
 *
 * 3. Wildcard module declarations: for non-code imports
 *    `declare module "*.css" { const styles: Record<string, string>; }`
 *
 * AST structure for `declare module 'name'`:
 * - ambient_declaration
 *   - declare                    # keyword
 *   - module                     # container node
 *     - module                   # keyword
 *     - string                   # module name (e.g., 'express')
 *       - string_fragment        # actual name text
 *     - statement_block          # body with declarations
 *
 * AST structure for `declare global`:
 * - ambient_declaration
 *   - declare                    # keyword
 *   - global                     # keyword (instead of module node)
 *   - statement_block            # body with declarations
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty, ParsedTypeAlias } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { nodeLocation } from '../ast-utils/node-location.js';
import { extractClass } from '../class/extract-class.js';
import { extractInterface } from '../class/extract-interface.js';
import { extractEnum } from '../class/extract-enum.js';
import { extractFunction } from '../function/extract-function.js';
import { extractVariable } from '../property/extract-variable.js';
import { extractTypeAlias } from '../types/extract-type-alias.js';

/**
 * Result of extracting ambient module body contents.
 */
export interface AmbientModuleBodyResult {
  functions: ParsedFunction[];
  properties: ParsedProperty[];
  nestedClasses: ParsedClass[];
  typeAliases: ParsedTypeAlias[];
}

/**
 * Checks if a node is an ambient module declaration (declare module 'x' or declare global).
 *
 * @param node - AST node to check
 * @returns True if the node represents an ambient module declaration
 */
export function isAmbientModuleNode(node: SyntaxNode): boolean {
  if (node.type !== 'ambient_declaration') {
    return false;
  }

  // Check for `declare module` or `declare global`
  return hasModuleChild(node) || hasGlobalChild(node);
}

/**
 * Checks if an ambient_declaration node contains a module declaration.
 */
function hasModuleChild(node: SyntaxNode): boolean {
  return node.children.some((c) => c.type === 'module');
}

/**
 * Checks if an ambient_declaration node is a global augmentation.
 */
function hasGlobalChild(node: SyntaxNode): boolean {
  return node.children.some((c) => c.type === 'global');
}

/**
 * Extract an ambient module declaration from a TypeScript AST node.
 *
 * @param node - The ambient_declaration node
 * @returns ParsedClass representing the ambient module as a container
 */
export function extractAmbientModule(node: SyntaxNode): ParsedClass {
  // Determine if this is a global augmentation or module augmentation
  const isGlobal = hasGlobalChild(node);

  let name: string;
  let body: SyntaxNode | undefined;

  if (isGlobal) {
    // declare global { ... }
    name = 'global';
    body = findChildByType(node, 'statement_block');
  } else {
    // declare module 'name' { ... }
    const moduleNode = findChildByType(node, 'module');
    name = extractModuleName(moduleNode);
    body = moduleNode ? findChildByType(moduleNode, 'statement_block') : undefined;
  }

  // Extract body contents
  const bodyResult = extractAmbientModuleBody(body);

  return {
    name,
    kind: 'interface', // Ambient modules are similar to interfaces (declaration merging)
    visibility: 'public',
    isAbstract: true,
    isData: false,
    isSealed: false,
    superClass: undefined,
    interfaces: [],
    typeParameters: undefined,
    annotations: isGlobal
      ? [{ name: 'global' }]
      : [{ name: 'ambient-module' }],
    properties: bodyResult.properties,
    functions: bodyResult.functions,
    nestedClasses: bodyResult.nestedClasses,
    companionObject: undefined,
    secondaryConstructors: undefined,
    location: nodeLocation(node),
  };
}

/**
 * Extract the module name from a module node.
 *
 * The module name is stored in a string node containing the quoted module path.
 * For wildcards like "*.css", we preserve the pattern.
 *
 * @param moduleNode - The module node containing the name
 * @returns The extracted module name (without quotes)
 */
function extractModuleName(moduleNode: SyntaxNode | undefined): string {
  if (!moduleNode) return '<unknown>';

  const stringNode = findChildByType(moduleNode, 'string');
  if (!stringNode) return '<unknown>';

  // Find the string_fragment inside the string node (actual text without quotes)
  const fragmentNode = findChildByType(stringNode, 'string_fragment');
  if (fragmentNode) {
    return fragmentNode.text;
  }

  // Fallback: use the full string text and strip quotes
  const text = stringNode.text;
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1);
  }

  return text;
}

/**
 * Extract contents from an ambient module body (statement_block).
 *
 * @param body - The statement_block node containing module members
 * @returns Extracted functions, properties, and nested types
 */
function extractAmbientModuleBody(body: SyntaxNode | undefined): AmbientModuleBodyResult {
  const result: AmbientModuleBodyResult = {
    functions: [],
    properties: [],
    nestedClasses: [],
    typeAliases: [],
  };

  if (!body) return result;

  for (const child of body.children) {
    // Skip punctuation
    if (child.type === '{' || child.type === '}') continue;

    // Handle export statements - unwrap and extract inner declaration
    if (child.type === 'export_statement') {
      extractFromExportInAmbient(child, result);
      continue;
    }

    // Direct declarations
    extractAmbientMember(child, result);
  }

  return result;
}

/**
 * Extract a member declaration from an export statement inside an ambient module.
 */
function extractFromExportInAmbient(exportNode: SyntaxNode, result: AmbientModuleBodyResult): void {
  for (const child of exportNode.children) {
    // Skip export keyword and other tokens
    if (
      child.type === 'export' ||
      child.type === 'default' ||
      child.type === 'type' ||
      child.type === '{' ||
      child.type === '}' ||
      child.type === 'export_clause' ||
      child.type === 'from' ||
      child.type === 'string' ||
      child.type === ';'
    ) {
      continue;
    }

    extractAmbientMember(child, result);
  }
}

/**
 * Extract a single member declaration from an ambient module.
 */
function extractAmbientMember(node: SyntaxNode, result: AmbientModuleBodyResult): void {
  switch (node.type) {
    // Classes
    case 'class_declaration':
    case 'abstract_class_declaration':
      result.nestedClasses.push(extractClass(node));
      break;

    // Interfaces (most common in ambient modules)
    case 'interface_declaration':
      result.nestedClasses.push(extractInterface(node));
      break;

    // Enums
    case 'enum_declaration':
      result.nestedClasses.push(extractEnum(node));
      break;

    // Functions
    case 'function_declaration':
    case 'generator_function_declaration':
      result.functions.push(extractFunction(node));
      break;

    // Function signatures (common in ambient modules)
    case 'function_signature': {
      const func = extractFunction(node);
      func.isOverloadSignature = true;
      result.functions.push(func);
      break;
    }

    // Variables
    case 'lexical_declaration':
    case 'variable_declaration':
      result.properties.push(...extractVariable(node));
      break;

    // Type aliases
    case 'type_alias_declaration':
      result.typeAliases.push(extractTypeAlias(node));
      break;

    // Nested ambient module (rare but possible)
    case 'ambient_declaration':
      if (isAmbientModuleNode(node)) {
        result.nestedClasses.push(extractAmbientModule(node));
      }
      break;
  }
}
