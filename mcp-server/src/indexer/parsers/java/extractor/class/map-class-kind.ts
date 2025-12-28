/**
 * Class kind mapping for Java parsing.
 *
 * Maps Java AST node types to ParsedClass.kind values.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass } from '../../../../types.js';

/**
 * Map a Java AST node type to a ParsedClass kind.
 *
 * | Node type                      | Kind          | Notes                    |
 * |-------------------------------|---------------|--------------------------|
 * | class_declaration             | 'class'       |                          |
 * | interface_declaration         | 'interface'   |                          |
 * | enum_declaration              | 'enum'        |                          |
 * | annotation_type_declaration   | 'annotation'  | @interface               |
 * | record_declaration            | 'class'       | Java 16+ (isData: true)  |
 *
 * @param node - The AST node representing a type declaration
 * @returns The corresponding ParsedClass kind
 */
export function mapClassKind(node: SyntaxNode): ParsedClass['kind'] {
  switch (node.type) {
    case 'interface_declaration':
      return 'interface';

    case 'enum_declaration':
      return 'enum';

    case 'annotation_type_declaration':
      return 'annotation';

    case 'record_declaration':
      // Records are mapped to 'class' with isData: true
      // This is handled in extract-class.ts
      return 'class';

    case 'class_declaration':
    default:
      return 'class';
  }
}

/**
 * Check if a node represents a record declaration (Java 16+).
 *
 * @param node - The AST node to check
 * @returns true if this is a record declaration
 */
export function isRecordDeclaration(node: SyntaxNode): boolean {
  return node.type === 'record_declaration';
}
