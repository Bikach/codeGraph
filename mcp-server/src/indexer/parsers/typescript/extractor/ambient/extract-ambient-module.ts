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
import type { ParsedClass } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractContainerBody } from '../container/index.js';
import type { ContainerBodyResult } from '../container/index.js';

/**
 * Result of extracting ambient module body contents.
 * Alias for ContainerBodyResult for backwards compatibility.
 */
export type AmbientModuleBodyResult = ContainerBodyResult;

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
  const bodyResult = extractContainerBody(body, {
    handleFunctionSignatures: true, // Ambient modules commonly have function signatures
    extractNestedContainer: (childNode) => {
      // Handle nested ambient modules (rare but possible)
      if (childNode.type === 'ambient_declaration' && isAmbientModuleNode(childNode)) {
        return extractAmbientModule(childNode);
      }
      return undefined;
    },
  });

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
