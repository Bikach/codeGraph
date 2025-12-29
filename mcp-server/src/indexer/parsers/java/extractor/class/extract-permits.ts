/**
 * Extract permitted subclasses from sealed class/interface declarations.
 *
 * Java sealed classes (Java 17+) can specify which classes are allowed to extend them:
 * `sealed class Shape permits Circle, Rectangle, Triangle { }`
 *
 * AST structure:
 * class_declaration:
 *   modifiers (includes 'sealed')
 *   class
 *   identifier
 *   permits:
 *     permits
 *     type_list:
 *       type_identifier (Circle)
 *       ,
 *       type_identifier (Rectangle)
 *       ...
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';

/**
 * Extract the list of permitted subclasses from a sealed class declaration.
 *
 * @param node - The class_declaration or interface_declaration AST node
 * @returns Array of type names that are permitted to extend this class, or undefined if not sealed
 */
export function extractPermits(node: SyntaxNode): string[] | undefined {
  // Find the 'permits' clause
  const permitsNode = findChildByType(node, 'permits');
  if (!permitsNode) {
    return undefined;
  }

  // Find the type_list within permits
  const typeList = findChildByType(permitsNode, 'type_list');
  if (!typeList) {
    return undefined;
  }

  const permittedTypes: string[] = [];

  for (const child of typeList.children) {
    // Skip punctuation (commas)
    if (child.type === ',') continue;

    // Extract type identifiers (simple or scoped)
    if (
      child.type === 'type_identifier' ||
      child.type === 'scoped_type_identifier' ||
      child.type === 'generic_type'
    ) {
      permittedTypes.push(extractFullTypeName(child));
    }
  }

  return permittedTypes.length > 0 ? permittedTypes : undefined;
}
