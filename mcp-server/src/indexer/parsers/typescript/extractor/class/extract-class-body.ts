/**
 * Extract class body members from a class_body AST node.
 *
 * This function extracts properties, functions, and nested classes
 * from a TypeScript class body.
 *
 * TypeScript class body can contain:
 * - public_field_definition: public property
 * - field_definition: property with possible access modifier
 * - method_definition: method with implementation
 * - abstract_method_signature: abstract method
 * - class_declaration: nested class
 * - interface_declaration: nested interface
 * - enum_declaration: nested enum
 *
 * Important: In TypeScript AST, decorators on methods/properties are siblings
 * that appear before the decorated element, not children of it.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty, ParsedAnnotation } from '../../../../types.js';
import { extractClassProperty } from '../property/index.js';
import { extractMethod } from '../function/index.js';

/**
 * Result of extracting class body members.
 */
export interface ClassBodyResult {
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  nestedClasses: ParsedClass[];
}

/**
 * Function type for extracting a class from a class declaration node.
 * Passed as dependency to avoid circular imports.
 */
export type ClassExtractor = (node: SyntaxNode) => ParsedClass;

/**
 * Extract all members from a TypeScript class body AST node.
 *
 * @param classBody - The class_body AST node (can be undefined)
 * @param extractClass - Function to extract nested classes (passed to avoid circular dependency)
 * @returns ClassBodyResult with all extracted members
 */
export function extractClassBody(
  classBody: SyntaxNode | undefined,
  extractClass: ClassExtractor
): ClassBodyResult {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];
  const nestedClasses: ParsedClass[] = [];

  if (!classBody) {
    return { properties, functions, nestedClasses };
  }

  // Track pending decorators that will apply to the next member
  let pendingDecorators: ParsedAnnotation[] = [];

  for (const child of classBody.children) {
    switch (child.type) {
      // Decorators - collect them for the next declaration
      case 'decorator': {
        // Get the decorator for this specific child
        const singleDecorator = extractSingleDecoratorFromNode(child);
        if (singleDecorator) {
          pendingDecorators.push(singleDecorator);
        }
        break;
      }

      // Property definitions
      case 'public_field_definition':
      case 'field_definition': {
        const property = extractClassProperty(child);
        // Merge pending decorators
        property.annotations = [...pendingDecorators, ...property.annotations];
        properties.push(property);
        pendingDecorators = [];
        break;
      }

      // Method definitions
      case 'method_definition': {
        const method = extractMethod(child);
        // Merge pending decorators
        method.annotations = [...pendingDecorators, ...method.annotations];
        functions.push(method);
        pendingDecorators = [];
        break;
      }

      // Abstract method signatures
      case 'abstract_method_signature': {
        const method = extractMethod(child);
        method.annotations = [...pendingDecorators, ...method.annotations];
        functions.push(method);
        pendingDecorators = [];
        break;
      }

      // Getter/setter (treat as methods for now)
      case 'getter_declaration':
      case 'setter_declaration': {
        const method = extractMethod(child);
        method.annotations = [...pendingDecorators, ...method.annotations];
        functions.push(method);
        pendingDecorators = [];
        break;
      }

      // Nested type declarations
      case 'class_declaration':
      case 'abstract_class_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
        nestedClasses.push(extractClass(child));
        pendingDecorators = [];
        break;

      // Constructor - will be handled separately in extract-class.ts
      case 'constructor_declaration':
        // Constructors are not part of ClassBodyResult
        // They will be extracted by the main extractClass function
        pendingDecorators = [];
        break;

      // Static blocks (TypeScript 4.4+)
      case 'static_block':
        // Ignored for now
        pendingDecorators = [];
        break;

      // Punctuation and comments
      case ';':
      case '{':
      case '}':
      case 'comment':
        break;
    }
  }

  return { properties, functions, nestedClasses };
}

/**
 * Extract a single decorator from a decorator AST node.
 * This is used to extract decorators that are siblings of method/property definitions.
 */
function extractSingleDecoratorFromNode(decoratorNode: SyntaxNode): ParsedAnnotation | undefined {
  // Find call_expression or identifier inside decorator
  const expr = decoratorNode.children.find(
    (c) => c.type === 'call_expression' || c.type === 'identifier' || c.type === 'member_expression'
  );

  if (!expr) return undefined;

  if (expr.type === 'call_expression') {
    // @Decorator() or @Decorator(args)
    const functionNode = expr.children.find((c) => c.type === 'identifier' || c.type === 'member_expression');
    const name = functionNode?.text ?? expr.text;
    const args = extractDecoratorArguments(expr);

    return {
      name: extractDecoratorName(name),
      arguments: Object.keys(args).length > 0 ? args : undefined,
    };
  }

  // @Decorator without parentheses
  return {
    name: extractDecoratorName(expr.text),
  };
}

/**
 * Extract decorator arguments from a call_expression.
 */
function extractDecoratorArguments(callExpr: SyntaxNode): Record<string, string> {
  const args: Record<string, string> = {};

  const argsNode = callExpr.children.find((c) => c.type === 'arguments');
  if (!argsNode) return args;

  let argIndex = 0;
  for (const child of argsNode.children) {
    // Skip punctuation
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;

    if (child.type === 'object') {
      // Object literal argument: { key: value, ... }
      for (const pair of child.children) {
        if (pair.type === 'pair') {
          const keyNode = pair.children[0];
          const valueNode = pair.children.find(
            (n) => n.type !== ':' && n !== keyNode && n.type !== 'property_identifier'
          );
          if (keyNode && valueNode) {
            const key = keyNode.text.replace(/['"`]/g, '');
            args[key] = valueNode.text;
          }
        }
      }
    } else {
      // Positional argument
      args[`arg${argIndex}`] = child.text;
      argIndex++;
    }
  }

  return args;
}

/**
 * Extract the simple decorator name from a potentially qualified name.
 * For "decorators.Injectable", returns "Injectable".
 */
function extractDecoratorName(fullName: string): string {
  const parts = fullName.split('.');
  return parts[parts.length - 1] ?? fullName;
}
