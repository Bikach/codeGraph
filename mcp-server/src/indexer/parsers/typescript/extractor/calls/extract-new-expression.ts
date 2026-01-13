/**
 * Constructor call (new expression) extraction for TypeScript parsing.
 *
 * Extracts constructor call details from new_expression AST nodes.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractArgumentTypes } from './type-inference/index.js';

/**
 * Extract a constructor call from a new_expression AST node.
 *
 * TypeScript new_expression structure:
 * new_expression > constructor (identifier | member_expression) > type_arguments? > arguments?
 *
 * Handles:
 * - Basic constructor: new User()
 * - Constructor with arguments: new User('John', 25)
 * - Generic constructor: new Array<string>()
 * - Namespaced constructor: new Namespace.Class()
 */
export function extractNewExpression(node: SyntaxNode): ParsedCall | undefined {
  // Find the constructor (class name being instantiated)
  // First non-'new' child is typically the constructor identifier/expression
  let constructorNode: SyntaxNode | undefined;

  for (const child of node.children) {
    if (child.type !== 'new' && child.type !== 'type_arguments' && child.type !== 'arguments') {
      constructorNode = child;
      break;
    }
  }

  if (!constructorNode) return undefined;

  let name: string;
  let receiver: string | undefined;

  if (constructorNode.type === 'identifier') {
    // Simple: new User()
    name = constructorNode.text;
  } else if (constructorNode.type === 'member_expression') {
    // Namespaced: new Namespace.Class()
    const { receiverPath, className } = extractMemberExpressionForNew(constructorNode);
    name = className;
    receiver = receiverPath;
  } else {
    // Other cases (computed property, etc.)
    name = constructorNode.text ?? '<unknown>';
  }

  // Count arguments and infer types
  const args = findChildByType(node, 'arguments');
  const argumentCount = args ? countArguments(args) : 0;
  const argumentTypes = args ? extractArgumentTypes(args) : [];

  return {
    name,
    receiver,
    receiverType: undefined, // Will be resolved later
    argumentCount,
    argumentTypes: argumentTypes.length > 0 ? argumentTypes : undefined,
    isConstructorCall: true,
    location: nodeLocation(node),
  };
}

/**
 * Extract receiver and class name from a member_expression in a new expression.
 *
 * For `new Namespace.SubNamespace.Class()`:
 * - receiverPath: "Namespace.SubNamespace"
 * - className: "Class"
 */
function extractMemberExpressionForNew(node: SyntaxNode): {
  receiverPath: string | undefined;
  className: string;
} {
  const parts: string[] = [];

  // Walk through nested member expressions
  let current: SyntaxNode | undefined = node;

  while (current && current.type === 'member_expression') {
    // Get property name
    const property = findChildByType(current, 'property_identifier');
    if (property) {
      parts.unshift(property.text);
    }

    // Move to object (receiver)
    const objectNode: SyntaxNode | undefined = current.children[0];
    if (objectNode?.type === 'member_expression') {
      current = objectNode;
    } else {
      // Base case: identifier or other expression
      if (objectNode) {
        parts.unshift(objectNode.text);
      }
      break;
    }
  }

  // Last part is the class name, rest is receiver/namespace
  const className = parts.pop() ?? '<unknown>';
  const receiverPath = parts.length > 0 ? parts.join('.') : undefined;

  return { receiverPath, className };
}

/**
 * Count the number of arguments in an arguments node.
 */
function countArguments(args: SyntaxNode): number {
  let count = 0;

  for (const child of args.children) {
    // Skip parentheses and commas
    if (child.type !== '(' && child.type !== ')' && child.type !== ',') {
      count++;
    }
  }

  return count;
}
