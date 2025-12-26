/**
 * Navigation path extraction for Kotlin call expressions.
 *
 * Handles qualified calls like: com.example.Utils.method()
 * Returns the receiver path (com.example.Utils) and the method name (method).
 */

import type { SyntaxNode } from 'tree-sitter';

export interface NavigationPathResult {
  receiverPath: string | undefined;
  methodName: string;
  hasSafeCall: boolean;
}

/**
 * Extract the full navigation path from a (possibly nested) navigation_expression.
 * Handles qualified calls like: com.example.Utils.method()
 * Returns the receiver path (com.example.Utils) and the method name (method).
 */
export function extractNavigationPath(navExpr: SyntaxNode): NavigationPathResult {
  // Collect all parts of the navigation path
  const parts: string[] = [];
  let hasSafeCall = false;

  // Recursively collect parts from nested navigation_expressions
  function collectParts(node: SyntaxNode): void {
    if (node.type === 'simple_identifier') {
      parts.push(node.text);
    } else if (node.type === 'navigation_expression') {
      // Process children in order
      for (const child of node.children) {
        if (child.type === 'navigation_expression' || child.type === 'simple_identifier') {
          collectParts(child);
        } else if (child.type === 'navigation_suffix') {
          // Check for safe call
          for (const suffixChild of child.children) {
            if (suffixChild.text === '?.' || suffixChild.type === '?.') {
              hasSafeCall = true;
            } else if (suffixChild.type === 'simple_identifier') {
              parts.push(suffixChild.text);
            }
          }
        }
      }
    }
  }

  collectParts(navExpr);

  // The last part is the method name, everything before is the receiver
  if (parts.length === 0) {
    return { receiverPath: undefined, methodName: '<unknown>', hasSafeCall };
  }

  if (parts.length === 1) {
    // Just a method call without receiver (shouldn't happen for navigation_expression)
    return { receiverPath: undefined, methodName: parts[0]!, hasSafeCall };
  }

  const methodName = parts.pop()!;
  const receiverPath = parts.join('.');

  return { receiverPath, methodName, hasSafeCall };
}
