/**
 * Extract an interface from a TypeScript interface_declaration AST node.
 *
 * TypeScript interface structure:
 * - interface_declaration
 *   - interface                    # keyword
 *   - type_identifier              # InterfaceName
 *   - type_parameters?             # <T, U>
 *   - extends_type_clause?         # extends IOther, IAnotherInterface
 *   - interface_body | object_type
 *     - property_signature         # prop: Type
 *     - method_signature           # method(): Type
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractInterfaceExtends } from './extract-super-types.js';
import { extractInterfaceBody } from './extract-interface-body.js';

/**
 * Extract an interface declaration from a TypeScript AST node.
 *
 * @param node - The interface_declaration node
 * @returns ParsedClass representing the extracted interface
 */
export function extractInterface(node: SyntaxNode): ParsedClass {
  // Find interface name
  const nameNode = findChildByType(node, 'type_identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Extract modifiers (export, declare)
  const modifiers = extractModifiers(node);

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Interfaces can extend multiple other interfaces (no superClass, only interfaces)
  const interfaces = extractInterfaceExtends(node);

  // Extract body members
  const interfaceBody =
    findChildByType(node, 'interface_body') ?? findChildByType(node, 'object_type');
  const { properties, functions } = extractInterfaceBody(interfaceBody);

  return {
    name,
    kind: 'interface',
    visibility: modifiers.visibility,
    isAbstract: true, // Interfaces are implicitly abstract
    isData: false,
    isSealed: false,
    superClass: undefined, // Interfaces don't have a superclass
    interfaces,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: [], // TypeScript interfaces can't have decorators
    properties,
    functions,
    nestedClasses: [], // TypeScript interfaces can't have nested classes
    companionObject: undefined,
    secondaryConstructors: undefined,
    location: nodeLocation(node),
  };
}
