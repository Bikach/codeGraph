/**
 * Extract type name from AST node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from './find-child-by-type.js';

/**
 * Extract the type name from a user_type or constructor_invocation node.
 */
export function extractTypeName(typeNode: SyntaxNode): string | undefined {
  if (typeNode.type === 'user_type') {
    const identifier = findChildByType(typeNode, 'simple_identifier');
    return identifier?.text ?? typeNode.text;
  }
  if (typeNode.type === 'constructor_invocation') {
    const userType = findChildByType(typeNode, 'user_type');
    return userType ? extractTypeName(userType) : typeNode.text;
  }
  return typeNode.text;
}
