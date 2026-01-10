/**
 * Extract an enum from a TypeScript enum_declaration AST node.
 *
 * TypeScript enum structure:
 * - enum_declaration
 *   - const?                       # const enum
 *   - enum                         # keyword
 *   - identifier                   # EnumName
 *   - enum_body
 *     - enum_assignment            # VALUE = 1
 *     - property_identifier        # VALUE (without assignment)
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';

/**
 * Extract an enum declaration from a TypeScript AST node.
 *
 * @param node - The enum_declaration node
 * @returns ParsedClass representing the extracted enum
 */
export function extractEnum(node: SyntaxNode): ParsedClass {
  // Find enum name
  const nameNode = findChildByType(node, 'identifier');
  const name = nameNode?.text ?? '<anonymous>';

  // Extract modifiers (export, const, declare)
  const modifiers = extractModifiers(node);

  // Check for const enum
  const isConst = node.children.some((c) => c.type === 'const');

  // Extract enum members
  const enumBody = findChildByType(node, 'enum_body');
  const properties = extractEnumMembers(enumBody);

  return {
    name,
    kind: 'enum',
    visibility: modifiers.visibility,
    isAbstract: false,
    isData: false,
    isSealed: isConst, // Use isSealed to indicate const enum
    superClass: undefined,
    interfaces: [],
    typeParameters: undefined,
    annotations: [], // TypeScript enums can't have decorators
    properties,
    functions: [],
    nestedClasses: [],
    companionObject: undefined,
    secondaryConstructors: undefined,
    location: nodeLocation(node),
  };
}

/**
 * Extract enum members as properties.
 */
function extractEnumMembers(enumBody: SyntaxNode | undefined): ParsedProperty[] {
  const members: ParsedProperty[] = [];

  if (!enumBody) return members;

  for (const child of enumBody.children) {
    // Skip punctuation
    if (child.type === '{' || child.type === '}' || child.type === ',') continue;

    if (child.type === 'enum_assignment') {
      // Member with explicit value: VALUE = 1
      const nameNode =
        findChildByType(child, 'property_identifier') ?? findChildByType(child, 'identifier');
      const name = nameNode?.text ?? '<unknown>';

      // Find the value (after =)
      const valueNode = child.children.find(
        (c) =>
          c.type !== '=' &&
          c.type !== 'property_identifier' &&
          c.type !== 'identifier' &&
          c.type !== 'comment'
      );

      members.push({
        name,
        type: 'number', // TypeScript enum values are typically numbers
        visibility: 'public',
        isVal: true, // Enum members are readonly
        initializer: valueNode?.text,
        annotations: [],
        location: nodeLocation(child),
      });
    } else if (child.type === 'property_identifier' || child.type === 'identifier') {
      // Member without explicit value: VALUE
      members.push({
        name: child.text,
        type: 'number',
        visibility: 'public',
        isVal: true,
        initializer: undefined,
        annotations: [],
        location: nodeLocation(child),
      });
    }
  }

  return members;
}
