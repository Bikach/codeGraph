/**
 * Extract type guard information from TypeScript function AST nodes.
 *
 * TypeScript type guards narrow types at runtime:
 * - Type predicate: `function isString(x): x is string`
 * - Assertion function: `function assertDefined(x): asserts x is T`
 * - This type guard: `function isValid(): this is ValidType`
 *
 * AST structure for type predicate:
 * type_predicate_annotation > type_predicate > identifier/this, is, type
 *
 * AST structure for assertion:
 * asserts_annotation > asserts > asserts, type_predicate?
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedTypeGuard } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';

/**
 * Default narrowed type for simple assertion functions without explicit type predicate.
 * Used for patterns like `asserts value` (without `is Type`).
 */
const DEFAULT_ASSERTION_NARROWED_TYPE = 'NonNullable' as const;

/**
 * Extract type guard information from a function or method declaration.
 *
 * Returns undefined if the function is not a type guard.
 */
export function extractTypeGuard(node: SyntaxNode): ParsedTypeGuard | undefined {
  let foundParams = false;

  for (const child of node.children) {
    if (child.type === 'formal_parameters') {
      foundParams = true;
      continue;
    }

    if (!foundParams) continue;

    // Type predicate: `x is Type`
    if (child.type === 'type_predicate_annotation') {
      return extractFromTypePredicate(child, false);
    }

    // Assertion function: `asserts x` or `asserts x is Type`
    if (child.type === 'asserts_annotation') {
      return extractFromAssertsAnnotation(child);
    }

    // Stop if we hit the body or other non-type nodes
    if (child.type === 'statement_block' || child.type === '=>') {
      break;
    }
  }

  return undefined;
}

/**
 * Extract type guard from type_predicate_annotation node.
 *
 * Structure: type_predicate_annotation > ':' > type_predicate
 * type_predicate > identifier/this > 'is' > type
 */
function extractFromTypePredicate(
  node: SyntaxNode,
  isAssertion: boolean
): ParsedTypeGuard | undefined {
  const typePredicate = findChildByType(node, 'type_predicate');
  if (!typePredicate) return undefined;

  return parseTypePredicate(typePredicate, isAssertion);
}

/**
 * Extract type guard from asserts_annotation node.
 *
 * Structure: asserts_annotation > ':' > asserts
 * asserts > 'asserts' > type_predicate? OR asserts > 'asserts' > identifier
 */
function extractFromAssertsAnnotation(node: SyntaxNode): ParsedTypeGuard | undefined {
  const assertsNode = findChildByType(node, 'asserts');
  if (!assertsNode) return undefined;

  // Check for type_predicate inside asserts (e.g., `asserts x is Type`)
  const typePredicate = findChildByType(assertsNode, 'type_predicate');
  if (typePredicate) {
    return parseTypePredicate(typePredicate, true);
  }

  // Simple asserts without type predicate (e.g., `asserts x`)
  // Find the identifier being asserted
  const identifier = assertsNode.children.find(
    (c) => c.type === 'identifier' || c.type === 'this'
  );
  if (!identifier) return undefined;

  return {
    parameter: identifier.text,
    narrowedType: DEFAULT_ASSERTION_NARROWED_TYPE,
    isAssertion: true,
  };
}

/**
 * Parse a type_predicate node.
 *
 * Structure: type_predicate > identifier/this > 'is' > type
 */
function parseTypePredicate(
  typePredicate: SyntaxNode,
  isAssertion: boolean
): ParsedTypeGuard | undefined {
  // Find the parameter (identifier or 'this')
  const paramNode = typePredicate.children.find(
    (c) => c.type === 'identifier' || c.type === 'this'
  );
  if (!paramNode) return undefined;

  // Find the narrowed type (comes after 'is')
  let foundIs = false;
  let typeNode: SyntaxNode | undefined;

  for (const child of typePredicate.children) {
    if (child.type === 'is') {
      foundIs = true;
      continue;
    }
    if (foundIs && child.type !== 'is') {
      typeNode = child;
      break;
    }
  }

  if (!typeNode) return undefined;

  const narrowedType = extractFullTypeName(typeNode);
  if (!narrowedType) return undefined;

  return {
    parameter: paramNode.text,
    narrowedType,
    isAssertion,
  };
}
