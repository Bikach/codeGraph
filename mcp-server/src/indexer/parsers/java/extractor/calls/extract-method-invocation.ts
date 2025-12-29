/**
 * Extract method invocation from Java AST.
 *
 * Handles all forms of method calls:
 * - Direct calls: method()
 * - Qualified calls: obj.method()
 * - Static calls: Class.method()
 * - Chained calls: obj.a().b().c()
 * - this/super calls: this.method(), super.method()
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';

/**
 * Extract a method invocation from a method_invocation AST node.
 *
 * Java AST structure for method_invocation:
 * - Direct call: identifier argument_list
 * - Qualified call: (identifier|field_access|this|super|method_invocation) . identifier argument_list
 *
 * @param node - The method_invocation AST node
 * @returns ParsedCall or undefined if extraction fails
 */
export function extractMethodInvocation(node: SyntaxNode): ParsedCall | undefined {
  if (node.type !== 'method_invocation') return undefined;

  const argList = findChildByType(node, 'argument_list');
  if (!argList) return undefined;

  // Find method name - it's the identifier just before argument_list
  const methodName = findMethodName(node);
  if (!methodName) return undefined;

  // Extract receiver
  const receiver = extractReceiver(node);

  // Count arguments
  const argumentCount = countArguments(argList);

  return {
    name: methodName,
    receiver,
    receiverType: undefined, // Resolved later by resolver
    argumentCount,
    isSafeCall: false, // Java doesn't have safe calls
    location: nodeLocation(node),
  };
}

/**
 * Find the method name in a method_invocation node.
 *
 * The method name is the last identifier before the argument_list.
 */
function findMethodName(node: SyntaxNode): string | undefined {
  // Children pattern: [receiver, '.', identifier, argument_list]
  // or just: [identifier, argument_list]
  const children = node.children;

  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (!child) continue;
    if (child.type === 'identifier') {
      return child.text;
    }
    if (child.type === 'argument_list') {
      // Continue searching before argument_list
      continue;
    }
  }

  return undefined;
}

/**
 * Extract the receiver expression from a method invocation.
 *
 * Receiver can be:
 * - identifier: variable name (obj.method())
 * - field_access: qualified name (System.out.println())
 * - this/super: special keywords
 * - method_invocation: chained call (a.b().c())
 */
function extractReceiver(node: SyntaxNode): string | undefined {
  const firstChild = node.children[0];
  if (!firstChild) return undefined;

  switch (firstChild.type) {
    case 'identifier':
      // Check if this is the method name (no receiver) or the receiver
      // If there's a '.' after it, it's a receiver
      const hasDot = node.children.some((c) => c.type === '.');
      if (!hasDot) {
        // Direct call like calculate() - no receiver
        return undefined;
      }
      return firstChild.text;

    case 'field_access':
      // System.out -> extract as "System.out"
      return extractFieldAccessText(firstChild);

    case 'this':
      return 'this';

    case 'super':
      return 'super';

    case 'method_invocation':
      // Chained call: the receiver is the result of another method call
      // Extract as text for now (e.g., "obj.chain1()")
      return firstChild.text;

    case 'parenthesized_expression':
      // (expr).method() - extract inner expression as text
      return firstChild.text;

    case 'array_access':
      // arr[0].method()
      return firstChild.text;

    case 'string_literal':
      // "hello".toUpperCase()
      return firstChild.text;

    default:
      // Unknown receiver type - return text representation
      if (node.children.some((c) => c.type === '.')) {
        return firstChild.text;
      }
      return undefined;
  }
}

/**
 * Extract text from a field_access node.
 *
 * field_access structure: identifier . identifier (can be nested)
 * System.out -> "System.out"
 */
function extractFieldAccessText(node: SyntaxNode): string {
  const parts: string[] = [];

  for (const child of node.children) {
    if (child.type === 'identifier') {
      parts.push(child.text);
    } else if (child.type === 'field_access') {
      parts.push(extractFieldAccessText(child));
    }
  }

  return parts.join('.');
}

/**
 * Count the number of arguments in an argument_list.
 */
function countArguments(argList: SyntaxNode): number {
  let count = 0;

  for (const child of argList.children) {
    // Skip punctuation: (, ), ,
    if (child.type !== '(' && child.type !== ')' && child.type !== ',') {
      count++;
    }
  }

  return count;
}
