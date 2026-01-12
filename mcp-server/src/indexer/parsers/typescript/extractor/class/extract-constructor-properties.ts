/**
 * Extract constructor parameter properties from TypeScript AST.
 *
 * TypeScript allows declaring and initializing class properties directly
 * in the constructor using visibility modifiers or readonly:
 *
 * class User {
 *   constructor(
 *     public name: string,      // Creates property 'name' with public visibility
 *     private age: number,      // Creates property 'age' with private visibility
 *     readonly id: string,      // Creates readonly property 'id' with public visibility
 *     protected email: string,  // Creates property 'email' with protected visibility
 *     normalParam: string       // NOT a property, just a regular parameter
 *   ) {}
 * }
 *
 * AST structure for constructor parameter properties:
 * method_definition (constructor)
 *   property_identifier "constructor"
 *   formal_parameters
 *     required_parameter
 *       accessibility_modifier (public|private|protected)?
 *       readonly?
 *       identifier
 *       type_annotation?
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty, Visibility } from '../../../../types.js';
import { findChildByType, nodeLocation, extractFullTypeName } from '../ast-utils/index.js';
import { extractDecorators } from '../decorators/index.js';

/**
 * Check if a parameter node is a constructor parameter property.
 * A parameter is a property if it has an accessibility modifier or readonly.
 */
function isParameterProperty(paramNode: SyntaxNode): boolean {
  return paramNode.children.some(
    (child) => child.type === 'accessibility_modifier' || child.type === 'readonly'
  );
}

/**
 * Extract visibility from a parameter property node.
 * Returns 'public' if only readonly is present (TypeScript default).
 */
function extractParameterVisibility(paramNode: SyntaxNode): Visibility {
  const accessibilityModifier = findChildByType(paramNode, 'accessibility_modifier');
  if (accessibilityModifier) {
    const modifier = accessibilityModifier.text;
    if (modifier === 'private') return 'private';
    if (modifier === 'protected') return 'protected';
  }
  return 'public';
}

/**
 * Check if a parameter property is readonly.
 */
function isReadonlyParameter(paramNode: SyntaxNode): boolean {
  return paramNode.children.some((child) => child.type === 'readonly');
}

/**
 * Extract a single constructor parameter property as a ParsedProperty.
 */
function extractParameterProperty(paramNode: SyntaxNode): ParsedProperty {
  const nameNode = findChildByType(paramNode, 'identifier');
  const name = nameNode?.text ?? 'unknown';

  const typeAnnotation = findChildByType(paramNode, 'type_annotation');
  const type = extractFullTypeName(typeAnnotation);

  const visibility = extractParameterVisibility(paramNode);
  const isReadonly = isReadonlyParameter(paramNode);
  const decorators = extractDecorators(paramNode);

  // Find default value (after '=' sign)
  let initializer: string | undefined;
  let foundEquals = false;
  for (const child of paramNode.children) {
    if (foundEquals) {
      initializer = child.text;
      break;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }

  return {
    name,
    type,
    visibility,
    isVal: isReadonly,
    initializer,
    annotations: decorators,
    location: nodeLocation(paramNode),
  };
}

/**
 * Extract all constructor parameter properties from a class body.
 *
 * @param classBody - The class_body AST node
 * @returns Array of ParsedProperty for constructor parameter properties
 */
export function extractConstructorProperties(classBody: SyntaxNode | undefined): ParsedProperty[] {
  if (!classBody) {
    return [];
  }

  const properties: ParsedProperty[] = [];

  // Find constructor (method_definition with name 'constructor')
  for (const child of classBody.children) {
    if (child.type === 'method_definition') {
      const nameNode = findChildByType(child, 'property_identifier');
      if (nameNode?.text === 'constructor') {
        const formalParams = findChildByType(child, 'formal_parameters');
        if (formalParams) {
          for (const param of formalParams.children) {
            if (
              (param.type === 'required_parameter' || param.type === 'optional_parameter') &&
              isParameterProperty(param)
            ) {
              properties.push(extractParameterProperty(param));
            }
          }
        }
        break; // Only one constructor allowed
      }
    }
  }

  return properties;
}
