/**
 * Extract extension function receiver type from Kotlin AST.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';

export function extractReceiverType(node: SyntaxNode): string | undefined {
  const receiverType = node.childForFieldName('receiver_type');
  if (receiverType) {
    return receiverType.text;
  }

  // Extension function: user_type before the dot, e.g., "fun String.capitalize()"
  // AST: [user_type] [.] [simple_identifier]
  const userType = findChildByType(node, 'user_type');
  if (userType) {
    const nextSibling = userType.nextSibling;
    if (nextSibling?.type === '.') {
      return userType.text;
    }
  }

  return undefined;
}
