/**
 * Extract property declaration from Kotlin AST.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';

export function extractProperty(node: SyntaxNode): ParsedProperty {
  // Property name is in variable_declaration > simple_identifier
  const varDecl = findChildByType(node, 'variable_declaration');
  const nameNode =
    node.childForFieldName('name') ??
    (varDecl ? findChildByType(varDecl, 'simple_identifier') : null) ??
    findChildByType(node, 'simple_identifier');

  const name = nameNode?.text ?? '<unnamed>';
  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);

  // Check if val or var (can be in binding_pattern_kind or directly)
  const bindingKind = findChildByType(node, 'binding_pattern_kind');
  const isVal = bindingKind
    ? bindingKind.children.some((c) => c.type === 'val')
    : node.children.some((c) => c.type === 'val');

  // Extract type from variable_declaration (can be user_type or nullable_type)
  const typeNode = varDecl
    ? findChildByType(varDecl, 'nullable_type') ?? findChildByType(varDecl, 'user_type')
    : findChildByType(node, 'nullable_type') ?? findChildByType(node, 'user_type') ?? findChildByType(node, 'type');
  const type = typeNode?.text;

  // Extract initializer
  const initializer = findChildByType(node, 'property_delegate') ?? node.childForFieldName('initializer');

  return {
    name,
    type,
    visibility: modifiers.visibility,
    isVal,
    initializer: initializer?.text,
    annotations,
    location: nodeLocation(node),
  };
}
