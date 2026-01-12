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
import type { ParsedClass } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractContainerBody } from '../container/index.js';
import type { ContainerBodyResult } from '../container/index.js';

/**
 * Result of extracting namespace body contents.
 * Alias for ContainerBodyResult for backwards compatibility.
 */
export type NamespaceBodyResult = ContainerBodyResult;

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
  const bodyResult = extractContainerBody(body, {
    extractNestedContainer: (childNode) => {
      // Handle nested namespaces
      if (childNode.type === 'internal_module' || childNode.type === 'module') {
        return extractNamespace(childNode);
      }
      // Handle expression_statement which may contain nested namespaces
      if (childNode.type === 'expression_statement') {
        const innerNamespace = findChildByType(childNode, 'internal_module');
        if (innerNamespace) {
          return extractNamespace(innerNamespace);
        }
      }
      return undefined;
    },
  });

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
