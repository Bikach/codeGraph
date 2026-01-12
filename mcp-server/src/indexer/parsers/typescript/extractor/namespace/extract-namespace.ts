/**
 * Extract a namespace from a TypeScript namespace declaration AST node.
 *
 * TypeScript namespaces (and legacy `module` keyword) are container structures
 * that can hold classes, functions, interfaces, variables, and nested namespaces.
 *
 * AST structure for `namespace` keyword:
 * - internal_module (wrapped in expression_statement at top level)
 *   - namespace           # keyword
 *   - identifier          # NamespaceName
 *   - statement_block
 *     - export_statement* # exported members
 *       - class_declaration | function_declaration | ...
 *     - internal_module*  # nested namespaces
 *
 * AST structure for `module` keyword (legacy):
 * - module
 *   - module              # keyword
 *   - identifier          # ModuleName
 *   - statement_block
 *     - ...
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractClass } from '../class/extract-class.js';
import { extractInterface } from '../class/extract-interface.js';
import { extractEnum } from '../class/extract-enum.js';
import { extractFunction } from '../function/extract-function.js';
import { extractVariable } from '../property/extract-variable.js';
import { extractTypeAlias } from '../types/extract-type-alias.js';
import type { ParsedTypeAlias } from '../../../../types.js';

/**
 * Result of extracting namespace body contents.
 */
export interface NamespaceBodyResult {
  functions: ParsedFunction[];
  properties: ParsedProperty[];
  nestedClasses: ParsedClass[];
  typeAliases: ParsedTypeAlias[];
}

/**
 * Checks if a node is a namespace declaration.
 *
 * @param node - AST node to check
 * @returns True if the node represents a namespace
 */
export function isNamespaceNode(node: SyntaxNode): boolean {
  return node.type === 'internal_module' || node.type === 'module';
}

/**
 * Extract a namespace/module node from an expression_statement if present.
 *
 * At top level, `namespace` declarations are wrapped in expression_statement.
 * This helper unwraps them.
 *
 * @param node - AST node that might contain a namespace
 * @returns The namespace node if found, undefined otherwise
 */
export function unwrapNamespaceFromExpression(node: SyntaxNode): SyntaxNode | undefined {
  if (isNamespaceNode(node)) {
    return node;
  }
  if (node.type === 'expression_statement') {
    const inner = findChildByType(node, 'internal_module');
    if (inner) return inner;
  }
  return undefined;
}

/**
 * Extract a namespace declaration from a TypeScript AST node.
 *
 * @param node - The internal_module or module node
 * @returns ParsedClass representing the namespace as a container
 */
export function extractNamespace(node: SyntaxNode): ParsedClass {
  // Find namespace name
  const nameNode = findChildByType(node, 'identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Extract modifiers (export, declare)
  const modifiers = extractModifiers(node);

  // Determine if this is a legacy module or modern namespace
  const isLegacyModule = node.type === 'module';

  // Extract body contents
  const body = findChildByType(node, 'statement_block');
  const bodyResult = extractNamespaceBody(body);

  return {
    name,
    kind: 'object', // Namespaces are conceptually similar to objects/modules
    visibility: modifiers.visibility,
    isAbstract: false,
    isData: false,
    isSealed: false,
    superClass: undefined,
    interfaces: [],
    typeParameters: undefined,
    annotations: isLegacyModule ? [{ name: 'module' }] : [], // Mark legacy module syntax
    properties: bodyResult.properties,
    functions: bodyResult.functions,
    nestedClasses: bodyResult.nestedClasses,
    companionObject: undefined,
    secondaryConstructors: undefined,
    location: nodeLocation(node),
  };
}

/**
 * Extract contents from a namespace body (statement_block).
 *
 * @param body - The statement_block node containing namespace members
 * @returns Extracted functions, properties, and nested types
 */
function extractNamespaceBody(body: SyntaxNode | undefined): NamespaceBodyResult {
  const result: NamespaceBodyResult = {
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
      extractFromExportInNamespace(child, result);
      continue;
    }

    // Handle expression_statement which may contain nested namespaces
    if (child.type === 'expression_statement') {
      const innerNamespace = findChildByType(child, 'internal_module');
      if (innerNamespace) {
        result.nestedClasses.push(extractNamespace(innerNamespace));
      }
      continue;
    }

    // Direct declarations (non-exported)
    extractNamespaceMember(child, result);
  }

  return result;
}

/**
 * Extract a member declaration from an export statement inside a namespace.
 */
function extractFromExportInNamespace(exportNode: SyntaxNode, result: NamespaceBodyResult): void {
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
      child.type === 'string'
    ) {
      continue;
    }

    extractNamespaceMember(child, result);
  }
}

/**
 * Extract a single member declaration from a namespace.
 */
function extractNamespaceMember(node: SyntaxNode, result: NamespaceBodyResult): void {
  switch (node.type) {
    // Classes
    case 'class_declaration':
    case 'abstract_class_declaration':
      result.nestedClasses.push(extractClass(node));
      break;

    // Interfaces
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

    // Variables
    case 'lexical_declaration':
    case 'variable_declaration':
      result.properties.push(...extractVariable(node));
      break;

    // Type aliases
    case 'type_alias_declaration':
      result.typeAliases.push(extractTypeAlias(node));
      break;

    // Nested namespaces (via internal_module directly)
    case 'internal_module':
    case 'module':
      result.nestedClasses.push(extractNamespace(node));
      break;
  }
}
