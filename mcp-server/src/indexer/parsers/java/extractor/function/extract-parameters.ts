/**
 * Extract method parameters from Java AST.
 *
 * Java method parameters are simpler than Kotlin's:
 * - No default values (until Java 21 preview)
 * - No crossinline/noinline modifiers
 * - Support for varargs (...)
 * - Support for final modifier
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedParameter } from '../../../../types.js';
import { findChildByType, findChildrenByType } from '../ast-utils/index.js';
import { extractAnnotations } from '../modifiers/index.js';
import { extractFullTypeName } from '../ast-utils/index.js';

/**
 * Extract parameters from a method or constructor declaration.
 *
 * Java AST structure:
 * - method_declaration > formal_parameters > formal_parameter*
 * - formal_parameter > modifiers? type identifier dimensions?
 * - spread_parameter > modifiers? type ... identifier (varargs)
 *
 * @param node - The method_declaration or constructor_declaration node
 * @returns Array of parsed parameters
 */
export function extractParameters(node: SyntaxNode): ParsedParameter[] {
  const params: ParsedParameter[] = [];
  const formalParams = findChildByType(node, 'formal_parameters');

  if (!formalParams) return params;

  for (const child of formalParams.children) {
    if (child.type === 'formal_parameter') {
      const param = extractFormalParameter(child);
      if (param) params.push(param);
    } else if (child.type === 'spread_parameter') {
      // Varargs: String... args
      const param = extractSpreadParameter(child);
      if (param) params.push(param);
    }
    // receiver_parameter is for explicit 'this' type annotations, rare - skip for now
  }

  return params;
}

/**
 * Extract a regular formal parameter.
 *
 * Structure: modifiers? type identifier dimensions?
 * Examples:
 * - String name
 * - final int count
 * - @NotNull List<String> items
 * - int[] array
 * - int matrix[][]  (dimensions after name)
 */
function extractFormalParameter(node: SyntaxNode): ParsedParameter | undefined {
  const nameNode = findChildByType(node, 'identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;
  const annotations = extractAnnotations(node);

  // Type can be various node types
  const typeNode = findTypeNode(node);
  let type = typeNode ? extractFullTypeName(typeNode) : undefined;

  // Handle dimensions after identifier: int matrix[][]
  const dimensions = findChildrenByType(node, 'dimensions');
  if (dimensions.length > 0 && type) {
    type = type + dimensions.map(() => '[]').join('');
  }

  return {
    name,
    type,
    annotations,
  };
}

/**
 * Extract a varargs (spread) parameter.
 *
 * AST Structure: spread_parameter > type ... variable_declarator > identifier
 * Example: String... args -> type becomes "String..."
 */
function extractSpreadParameter(node: SyntaxNode): ParsedParameter | undefined {
  // In spread_parameter, the name is inside variable_declarator > identifier
  const varDeclarator = findChildByType(node, 'variable_declarator');
  const nameNode = varDeclarator
    ? findChildByType(varDeclarator, 'identifier')
    : findChildByType(node, 'identifier');
  if (!nameNode) return undefined;

  const name = nameNode.text;
  const annotations = extractAnnotations(node);

  const typeNode = findTypeNode(node);
  let type = typeNode ? extractFullTypeName(typeNode) : undefined;

  // Add varargs marker to type
  if (type) {
    type = type + '...';
  }

  return {
    name,
    type,
    annotations,
  };
}

/**
 * Find the type node in a parameter declaration.
 *
 * Type can be:
 * - type_identifier (String)
 * - generic_type (List<String>)
 * - array_type (int[])
 * - scoped_type_identifier (java.util.List)
 * - integral_type, floating_point_type, boolean_type (primitives)
 */
function findTypeNode(node: SyntaxNode): SyntaxNode | undefined {
  // Try common type nodes in order of likelihood
  return (
    findChildByType(node, 'generic_type') ??
    findChildByType(node, 'array_type') ??
    findChildByType(node, 'type_identifier') ??
    findChildByType(node, 'scoped_type_identifier') ??
    findChildByType(node, 'integral_type') ??
    findChildByType(node, 'floating_point_type') ??
    findChildByType(node, 'boolean_type') ??
    findChildByType(node, 'void_type')
  );
}
