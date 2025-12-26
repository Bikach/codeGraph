/**
 * Call expression extraction for Kotlin parsing.
 *
 * Extracts function call details from call_expression AST nodes.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractNavigationPath } from './extract-navigation-path.js';
import { extractCallArguments } from './extract-call-arguments.js';

/**
 * Extract a function call from a call_expression AST node.
 *
 * Handles:
 * - Direct calls: functionName(args)
 * - Qualified calls: receiver.method(args)
 * - Safe calls: receiver?.method(args)
 * - Chained calls: a.b.c.method(args)
 */
export function extractCallExpression(node: SyntaxNode): ParsedCall | undefined {
  // call_expression has structure: receiver.function_name(args)
  // or just: function_name(args)
  // For qualified calls: com.example.Utils.method(args) has nested navigation_expressions

  const navigations = findChildByType(node, 'navigation_expression');
  const callSuffix = findChildByType(node, 'call_suffix');

  if (!callSuffix) return undefined;

  let name: string;
  let receiver: string | undefined;
  let isSafeCall = false;

  if (navigations) {
    // Extract the full receiver path and method name from navigation_expression
    const { receiverPath, methodName, hasSafeCall } = extractNavigationPath(navigations);
    receiver = receiverPath;
    name = methodName;
    isSafeCall = hasSafeCall;
  } else {
    // Direct function call
    const identifier = node.children.find((c) => c.type === 'simple_identifier');
    name = identifier?.text ?? '<unknown>';
  }

  // Extract argument information from call_suffix
  const { argumentCount, argumentTypes } = extractCallArguments(callSuffix);

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
