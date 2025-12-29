/**
 * Extract constructor calls (object creation) from Java AST.
 *
 * Handles:
 * - Simple: new User()
 * - With arguments: new User("name", 25)
 * - Generic: new ArrayList<String>()
 * - Qualified: new com.example.User()
 * - Anonymous class: new Runnable() { ... } (extracted as constructor call)
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedCall } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/index.js';

/**
 * Extract a constructor call from an object_creation_expression AST node.
 *
 * Java AST structure:
 * object_creation_expression:
 *   new
 *   type_identifier | scoped_type_identifier | generic_type
 *   argument_list
 *   class_body?  (for anonymous classes)
 *
 * @param node - The object_creation_expression AST node
 * @returns ParsedCall with isConstructorCall: true
 */
export function extractConstructorCall(node: SyntaxNode): ParsedCall | undefined {
  if (node.type !== 'object_creation_expression') return undefined;

  // Find the type being constructed
  const typeName = extractConstructedType(node);
  if (!typeName) return undefined;

  // Find argument list
  const argList = findChildByType(node, 'argument_list');
  const argumentCount = argList ? countArguments(argList) : 0;

  return {
    name: typeName,
    receiver: undefined, // Constructor calls don't have a receiver
    receiverType: undefined,
    argumentCount,
    isConstructorCall: true,
    location: nodeLocation(node),
  };
}

/**
 * Extract the type name being constructed.
 *
 * Handles:
 * - type_identifier: User
 * - scoped_type_identifier: com.example.User
 * - generic_type: ArrayList<String>
 */
function extractConstructedType(node: SyntaxNode): string | undefined {
  // Try different type node types in order
  const typeNode =
    findChildByType(node, 'generic_type') ??
    findChildByType(node, 'scoped_type_identifier') ??
    findChildByType(node, 'type_identifier');

  if (!typeNode) return undefined;

  // For generic types, extract just the base type name (not the full generic signature)
  // new ArrayList<String>() -> "ArrayList" (not "ArrayList<String>")
  if (typeNode.type === 'generic_type') {
    const baseType =
      findChildByType(typeNode, 'type_identifier') ??
      findChildByType(typeNode, 'scoped_type_identifier');
    return baseType ? extractFullTypeName(baseType) : typeNode.text;
  }

  return extractFullTypeName(typeNode);
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
