/**
 * Destructuring declaration extraction for TypeScript/JavaScript parsing.
 *
 * Handles:
 * - Object destructuring: const { name, age } = user;
 * - Array destructuring: const [first, second] = array;
 * - Renaming: const { name: userName } = user;
 * - Default values: const { name = 'default' } = user;
 * - Nested destructuring: const { user: { name } } = data;
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedDestructuringDeclaration } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';

/**
 * Check if a variable_declarator contains a destructuring pattern.
 */
export function isDestructuringDeclarator(declarator: SyntaxNode): boolean {
  const pattern = findChildByType(declarator, 'object_pattern') ??
    findChildByType(declarator, 'array_pattern');
  return pattern !== undefined;
}

/**
 * Extract a destructuring declaration from a lexical_declaration or variable_declaration.
 *
 * TypeScript/JavaScript destructuring:
 * - Object: const { name, age } = user;
 * - Array: const [first, second] = array;
 * - With types: const { name, age }: { name: string; age: number } = user;
 *
 * @param declarationNode - The lexical_declaration or variable_declaration node
 * @param declarator - The specific variable_declarator with the destructuring pattern
 * @returns ParsedDestructuringDeclaration or undefined if not a destructuring
 */
export function extractDestructuring(
  declarationNode: SyntaxNode,
  declarator: SyntaxNode
): ParsedDestructuringDeclaration | undefined {
  const objectPattern = findChildByType(declarator, 'object_pattern');
  const arrayPattern = findChildByType(declarator, 'array_pattern');

  if (!objectPattern && !arrayPattern) {
    return undefined;
  }

  const pattern = objectPattern ?? arrayPattern!;
  const isObjectDestructuring = objectPattern !== undefined;

  const componentNames: string[] = [];
  const componentTypes: (string | undefined)[] = [];

  if (isObjectDestructuring) {
    extractObjectPatternComponents(pattern, componentNames, componentTypes);
  } else {
    extractArrayPatternComponents(pattern, componentNames, componentTypes);
  }

  if (componentNames.length === 0) {
    return undefined;
  }

  // Check if const, let, or var
  const isConst = declarationNode.children.some((c) => c.text === 'const');

  // Get type annotation if present (on the declarator)
  const typeAnnotation = findChildByType(declarator, 'type_annotation');

  // If there's a type annotation, we could extract component types from it
  // For now, we'll use the annotation text as a hint
  if (typeAnnotation && componentTypes.every((t) => t === undefined)) {
    // Type annotation exists but individual types weren't extracted
    // Leave componentTypes as undefined since they're not individually specified
  }

  // Get initializer
  const initializer = findInitializer(declarator);

  return {
    componentNames,
    componentTypes: componentTypes.some((t) => t !== undefined) ? componentTypes : undefined,
    initializer: initializer?.text,
    visibility: 'public', // Top-level variables are effectively public in TS/JS
    isVal: isConst,
    location: nodeLocation(declarator),
  };
}

/**
 * Extract component names and types from an object pattern.
 *
 * Object pattern structure:
 * object_pattern > shorthand_property_identifier_pattern | pair_pattern | rest_pattern
 *
 * Examples:
 * - { name } -> shorthand_property_identifier_pattern
 * - { name: userName } -> pair_pattern
 * - { name = 'default' } -> object_assignment_pattern
 * - { ...rest } -> rest_pattern
 */
function extractObjectPatternComponents(
  pattern: SyntaxNode,
  names: string[],
  types: (string | undefined)[]
): void {
  for (const child of pattern.children) {
    switch (child.type) {
      case 'shorthand_property_identifier_pattern': {
        // Simple: { name }
        names.push(child.text);
        types.push(extractTypeFromPattern(child));
        break;
      }
      case 'pair_pattern': {
        // Renaming: { name: userName }
        const key = findChildByType(child, 'property_identifier');
        const value = findChildByTypes(child, [
          'identifier',
          'shorthand_property_identifier_pattern',
          'object_pattern',
          'array_pattern',
        ]);

        if (value) {
          if (value.type === 'identifier') {
            // { name: userName } -> use the new name (userName)
            names.push(value.text);
          } else if (value.type === 'object_pattern' || value.type === 'array_pattern') {
            // Nested destructuring: { user: { name } }
            // Flatten nested names with prefix
            const nestedNames: string[] = [];
            const nestedTypes: (string | undefined)[] = [];
            if (value.type === 'object_pattern') {
              extractObjectPatternComponents(value, nestedNames, nestedTypes);
            } else {
              extractArrayPatternComponents(value, nestedNames, nestedTypes);
            }
            names.push(...nestedNames);
            types.push(...nestedTypes);
            continue; // Skip the types.push below
          } else {
            names.push(value.text);
          }
          types.push(extractTypeFromPattern(value));
        } else if (key) {
          // Fallback to key name
          names.push(key.text);
          types.push(undefined);
        }
        break;
      }
      case 'object_assignment_pattern': {
        // Default value: { name = 'default' }
        const left = child.children[0];
        if (left) {
          if (left.type === 'shorthand_property_identifier_pattern') {
            names.push(left.text);
            types.push(extractTypeFromPattern(left));
          } else if (left.type === 'identifier') {
            names.push(left.text);
            types.push(extractTypeFromPattern(left));
          }
        }
        break;
      }
      case 'rest_pattern': {
        // Rest: { ...rest }
        const restIdentifier = findChildByType(child, 'identifier');
        if (restIdentifier) {
          names.push(restIdentifier.text);
          types.push(undefined);
        }
        break;
      }
    }
  }
}

/**
 * Find all children matching any of the given types.
 */
function findChildByTypes(node: SyntaxNode, types: string[]): SyntaxNode | undefined {
  return node.children.find((c) => types.includes(c.type));
}

/**
 * Extract component names and types from an array pattern.
 *
 * Array pattern structure:
 * array_pattern > identifier | rest_pattern | array_pattern | object_pattern
 *
 * Examples:
 * - [first, second] -> identifier, identifier
 * - [first, ...rest] -> identifier, rest_pattern
 * - [, second] -> omitted element, identifier
 */
function extractArrayPatternComponents(
  pattern: SyntaxNode,
  names: string[],
  types: (string | undefined)[]
): void {
  for (const child of pattern.children) {
    switch (child.type) {
      case 'identifier': {
        names.push(child.text);
        types.push(extractTypeFromPattern(child));
        break;
      }
      case 'assignment_pattern': {
        // Default value: [first = 'default']
        const left = child.children[0];
        if (left?.type === 'identifier') {
          names.push(left.text);
          types.push(extractTypeFromPattern(left));
        }
        break;
      }
      case 'rest_pattern': {
        // Rest: [...rest]
        const restIdentifier = findChildByType(child, 'identifier');
        if (restIdentifier) {
          names.push(restIdentifier.text);
          types.push(undefined);
        }
        break;
      }
      case 'object_pattern': {
        // Nested object destructuring in array: [{ name }]
        const nestedNames: string[] = [];
        const nestedTypes: (string | undefined)[] = [];
        extractObjectPatternComponents(child, nestedNames, nestedTypes);
        names.push(...nestedNames);
        types.push(...nestedTypes);
        break;
      }
      case 'array_pattern': {
        // Nested array destructuring: [[a, b]]
        const nestedNames: string[] = [];
        const nestedTypes: (string | undefined)[] = [];
        extractArrayPatternComponents(child, nestedNames, nestedTypes);
        names.push(...nestedNames);
        types.push(...nestedTypes);
        break;
      }
      // Skip commas and brackets
      case ',':
      case '[':
      case ']':
        break;
    }
  }
}

/**
 * Extract type from a pattern element if it has a type annotation.
 */
function extractTypeFromPattern(node: SyntaxNode): string | undefined {
  // Check if the node's parent has a type annotation
  const typeAnnotation = findChildByType(node, 'type_annotation');
  if (typeAnnotation) {
    return extractFullTypeName(typeAnnotation);
  }
  return undefined;
}

/**
 * Find the initializer value in a variable declarator.
 * The initializer follows the = sign.
 */
function findInitializer(node: SyntaxNode): SyntaxNode | undefined {
  let foundEquals = false;
  for (const child of node.children) {
    if (foundEquals) {
      return child;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }
  return undefined;
}
