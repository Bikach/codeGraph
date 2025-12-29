/**
 * Extract method declaration from Java AST.
 *
 * Handles all method types including:
 * - Regular instance methods
 * - Static methods
 * - Abstract methods
 * - Default interface methods
 * - Native methods
 * - Synchronized methods
 * - Generic methods
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractParameters } from './extract-parameters.js';
import { extractReturnType } from './extract-return-type.js';
import { extractCalls } from '../calls/index.js';

/**
 * Extract a method declaration from an AST node.
 *
 * Java AST structure:
 * method_declaration:
 *   modifiers?
 *   type_parameters?  (generics)
 *   type              (return type)
 *   identifier        (method name)
 *   formal_parameters
 *   dimensions?       (for array return types like String[] foo())
 *   throws?           (throws clause)
 *   block | ;         (body or abstract)
 *
 * @param node - The method_declaration AST node
 * @returns ParsedFunction representing the method
 */
export function extractMethod(node: SyntaxNode): ParsedFunction {
  const nameNode = findChildByType(node, 'identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);
  const parameters = extractParameters(node);
  const returnType = extractReturnType(node);

  // Handle array return type dimensions: String[] foo() or String foo()[]
  const dimensions = findDimensionsAfterName(node, nameNode);
  const finalReturnType = dimensions > 0 && returnType
    ? returnType + '[]'.repeat(dimensions)
    : returnType;

  // Extract type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Check if method has a body (non-abstract)
  const body = findChildByType(node, 'block');

  // Extract function calls from body
  const calls = body ? extractCalls(body) : [];

  return {
    name,
    visibility: modifiers.visibility,
    parameters,
    returnType: finalReturnType,
    isAbstract: modifiers.isAbstract || !body,
    isSuspend: false, // Java doesn't have suspend
    isExtension: false, // Java doesn't have extension functions
    receiverType: undefined,
    isInline: false, // Java doesn't have inline
    isInfix: false, // Java doesn't have infix
    isOperator: false, // Java doesn't have operator overloading via modifier
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations,
    location: nodeLocation(node),
    calls,
  };
}

/**
 * Find array dimensions that appear after the method name.
 *
 * Java allows: String foo()[] which is equivalent to String[] foo()
 * This is a legacy syntax but still valid.
 */
function findDimensionsAfterName(node: SyntaxNode, nameNode: SyntaxNode | undefined): number {
  if (!nameNode) return 0;

  let count = 0;
  let foundName = false;

  for (const child of node.children) {
    if (child === nameNode) {
      foundName = true;
      continue;
    }
    if (foundName && child.type === 'dimensions') {
      // Count pairs of brackets
      count += (child.text.match(/\[\]/g) || []).length;
    }
  }

  return count;
}
