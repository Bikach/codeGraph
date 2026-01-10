/**
 * Extract a method from a TypeScript class or interface member.
 *
 * TypeScript method types:
 * - method_definition: class method
 * - method_signature: interface method
 *
 * This is a minimal implementation for Phase 4.
 * Full implementation will come in Phase 6.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction, ParsedParameter } from '../../../../types.js';
import { findChildByType, nodeLocation, extractFullTypeName } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';

/**
 * Extract a method from a method_definition or method_signature node.
 */
export function extractMethod(node: SyntaxNode): ParsedFunction {
  const modifiers = extractModifiers(node);

  // Find method name
  const nameNode = findChildByType(node, 'property_identifier');
  const name = nameNode?.text ?? '<unknown>';

  // Extract parameters (minimal implementation)
  const parameters = extractParameters(node);

  // Extract return type
  const returnType = extractReturnType(node);

  // Check for abstract modifier
  const isAbstract = modifiers.isAbstract || node.children.some((c) => c.type === 'abstract');

  return {
    name,
    visibility: modifiers.visibility,
    parameters,
    returnType,
    isAbstract,
    isSuspend: false, // TypeScript doesn't have suspend
    isExtension: false, // TypeScript doesn't have extension methods
    isInline: false,
    annotations: [], // Decorators on methods will be added in Phase 6
    location: nodeLocation(node),
    calls: [], // Call extraction will be added in Phase 7
  };
}

/**
 * Extract method signature from an interface.
 */
export function extractMethodSignature(node: SyntaxNode): ParsedFunction {
  const nameNode = findChildByType(node, 'property_identifier');
  const name = nameNode?.text ?? '<unknown>';

  const parameters = extractParameters(node);
  const returnType = extractReturnType(node);
  const typeParameters = extractTypeParameters(node);

  return {
    name,
    visibility: 'public', // Interface methods are always public
    parameters,
    returnType,
    isAbstract: true, // Interface methods are implicitly abstract
    isSuspend: false,
    isExtension: false,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: [],
    location: nodeLocation(node),
    calls: [],
  };
}

/**
 * Minimal parameter extraction for Phase 4.
 */
function extractParameters(node: SyntaxNode): ParsedParameter[] {
  const params: ParsedParameter[] = [];

  const formalParams = findChildByType(node, 'formal_parameters');
  if (!formalParams) return params;

  for (const child of formalParams.children) {
    if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
      const nameNode =
        findChildByType(child, 'identifier') ??
        findChildByType(child, 'shorthand_property_identifier_pattern') ??
        findChildByType(child, 'shorthand_property_identifier');
      const name = nameNode?.text ?? '<unknown>';

      const typeAnnotation = findChildByType(child, 'type_annotation');
      let type: string | undefined;
      if (typeAnnotation) {
        const typeNode = typeAnnotation.children.find((c) => c.type !== ':');
        type = extractFullTypeName(typeNode);
      }

      params.push({
        name,
        type,
        annotations: [],
      });
    }
  }

  return params;
}

/**
 * Extract return type from a method.
 */
function extractReturnType(node: SyntaxNode): string | undefined {
  // Look for return type annotation after parameters
  const typeAnnotation = findChildByType(node, 'type_annotation');
  if (typeAnnotation) {
    const typeNode = typeAnnotation.children.find((c) => c.type !== ':');
    return extractFullTypeName(typeNode);
  }
  return undefined;
}
