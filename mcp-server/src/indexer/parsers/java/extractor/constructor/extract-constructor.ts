/**
 * Extract constructor declarations from Java AST.
 *
 * Java constructors can:
 * - Delegate to this() (another constructor in same class)
 * - Delegate to super() (parent class constructor)
 * - Have visibility modifiers
 * - Have annotations
 * - Have type parameters (generic constructors)
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedConstructor } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers, extractAnnotations } from '../modifiers/index.js';
import { extractParameters } from '../function/extract-parameters.js';

/**
 * Extract a constructor declaration from an AST node.
 *
 * Java AST structure:
 * constructor_declaration:
 *   modifiers?
 *   type_parameters?  (rare: generic constructors)
 *   identifier        (class name)
 *   formal_parameters
 *   throws?
 *   constructor_body:
 *     explicit_constructor_invocation?  (this() or super())
 *     statement*
 *
 * @param node - The constructor_declaration AST node
 * @returns ParsedConstructor representing the constructor
 */
export function extractConstructor(node: SyntaxNode): ParsedConstructor {
  const modifiers = extractModifiers(node);
  const annotations = extractAnnotations(node);
  const parameters = extractParameters(node);

  // Check for delegation (this() or super())
  const delegatesTo = extractDelegation(node);

  return {
    parameters,
    visibility: modifiers.visibility,
    delegatesTo,
    annotations,
    location: nodeLocation(node),
  };
}

/**
 * Extract delegation call from constructor body.
 *
 * Java constructors can start with:
 * - this(args) - delegates to another constructor in same class
 * - super(args) - delegates to parent constructor
 *
 * AST structure:
 * constructor_body > explicit_constructor_invocation > this/super
 */
function extractDelegation(node: SyntaxNode): 'this' | 'super' | undefined {
  const body = findChildByType(node, 'constructor_body');
  if (!body) return undefined;

  const explicitInvocation = findChildByType(body, 'explicit_constructor_invocation');
  if (!explicitInvocation) return undefined;

  // Look for 'this' or 'super' keyword in the invocation
  for (const child of explicitInvocation.children) {
    if (child.type === 'this') return 'this';
    if (child.type === 'super') return 'super';
  }

  return undefined;
}
