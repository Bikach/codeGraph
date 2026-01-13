/**
 * Call expression extraction for TypeScript parsing.
 *
 * Extracts function call details from call_expression AST nodes.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractArgumentTypes } from './type-inference/index.js';

/**
 * Extract a function call from a call_expression AST node.
 *
 * TypeScript call_expression structure:
 * call_expression > function (identifier | member_expression) > arguments
 *
 * Handles:
 * - Direct calls: functionName(args)
 * - Member calls: receiver.method(args)
 * - Optional chaining: receiver?.method(args)
 * - Chained calls: a.b.c.method(args)
 */
export function extractCallExpression(node: SyntaxNode): ParsedCall | undefined {
  const args = findChildByType(node, 'arguments');
  if (!args) return undefined;

  // The function being called is the first child (before arguments)
  const functionNode = node.children[0];
  if (!functionNode) return undefined;

  let name: string;
  let receiver: string | undefined;
  let isSafeCall = false;

  if (functionNode.type === 'member_expression') {
    // receiver.method(args) or receiver?.method(args)
    const { receiverPath, methodName, hasSafeCall } = extractMemberExpression(functionNode);
    receiver = receiverPath;
    name = methodName;
    isSafeCall = hasSafeCall;
  } else if (functionNode.type === 'identifier') {
    // Direct function call
    name = functionNode.text;
  } else if (functionNode.type === 'call_expression') {
    // Chained call like foo()()
    name = '<chained>';
    receiver = functionNode.text;
  } else {
    // Other cases (e.g., IIFE)
    name = functionNode.text ?? '<unknown>';
  }

  // Count arguments and infer types
  const argumentCount = countArguments(args);
  const argumentTypes = extractArgumentTypes(args);

  return {
    name,
    receiver,
    receiverType: undefined, // Will be resolved later
    argumentCount,
    argumentTypes: argumentTypes.length > 0 ? argumentTypes : undefined,
    isSafeCall: isSafeCall || undefined,
    location: nodeLocation(node),
  };
}

/**
 * Extract receiver and method name from a member_expression.
 *
 * member_expression structure:
 * member_expression > object (expression) > . or ?. > property (property_identifier)
 */
function extractMemberExpression(node: SyntaxNode): {
  receiverPath: string | undefined;
  methodName: string;
  hasSafeCall: boolean;
} {
  let hasSafeCall = false;
  const parts: string[] = [];

  // Walk through nested member expressions
  let current: SyntaxNode | undefined = node;

  while (current && current.type === 'member_expression') {
    // Check for optional chaining
    if (current.children.some((c) => c.type === '?.')) {
      hasSafeCall = true;
    }

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

  // Last part is the method name, rest is receiver
  const methodName = parts.pop() ?? '<unknown>';
  const receiverPath = parts.length > 0 ? parts.join('.') : undefined;

  return { receiverPath, methodName, hasSafeCall };
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
