/**
 * Extract conditional types from TypeScript conditional_type nodes.
 *
 * TypeScript conditional types:
 * - T extends U ? X : Y (basic conditional)
 * - T extends Promise<infer U> ? U : T (with infer)
 * - T extends any[] ? T[0] : T extends object ? keyof T : T (nested)
 *
 * AST structure (tree-sitter):
 * conditional_type >
 *   check_type (e.g., type_identifier)
 *   "extends"
 *   extends_type (e.g., array_type, generic_type)
 *   "?"
 *   true_type
 *   ":"
 *   false_type
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedConditionalType } from '../../../../types.js';

/**
 * Extract a conditional type from a conditional_type node.
 *
 * @param node - The conditional_type AST node
 * @returns Parsed conditional type structure, or undefined if parsing fails
 */
export function extractConditionalType(
  node: SyntaxNode,
): ParsedConditionalType | undefined {
  if (node.type !== 'conditional_type') {
    return undefined;
  }

  // Named children in order: checkType, extendsType, trueType, falseType
  // We need to find them by position since named children may vary
  let checkType: string | undefined;
  let extendsType: string | undefined;
  let trueType: string | undefined;
  let falseType: string | undefined;

  let foundExtends = false;
  let foundQuestion = false;
  let foundColon = false;

  for (const child of node.children) {
    if (child.type === 'extends') {
      foundExtends = true;
      continue;
    }
    if (child.type === '?') {
      foundQuestion = true;
      continue;
    }
    if (child.type === ':') {
      foundColon = true;
      continue;
    }

    // Skip whitespace and comment nodes
    if (child.type === 'comment') {
      continue;
    }

    if (!foundExtends) {
      // Before "extends" - this is the check type
      checkType = child.text;
    } else if (!foundQuestion) {
      // After "extends", before "?" - this is the extends type
      extendsType = child.text;
    } else if (!foundColon) {
      // After "?", before ":" - this is the true type
      trueType = child.text;
    } else {
      // After ":" - this is the false type
      falseType = child.text;
    }
  }

  if (!checkType || !extendsType || !trueType || !falseType) {
    return undefined;
  }

  // Extract infer types from the extends clause
  const inferTypes = extractInferTypes(node);

  // Check for nested conditional types
  const nestedTrueConditional = findNestedConditional(node, 'true');
  const nestedFalseConditional = findNestedConditional(node, 'false');

  return {
    checkType,
    extendsType,
    trueType,
    falseType,
    inferTypes: inferTypes.length > 0 ? inferTypes : undefined,
    nestedTrueConditional,
    nestedFalseConditional,
  };
}

/**
 * Extract all infer type declarations from a conditional type.
 * Searches the extends clause for `infer X` patterns.
 *
 * @param node - The conditional_type AST node
 * @returns Array of inferred type variable names
 */
function extractInferTypes(node: SyntaxNode): string[] {
  const inferTypes: string[] = [];

  function traverse(n: SyntaxNode): void {
    if (n.type === 'infer_type') {
      // infer_type contains: "infer" keyword + type_identifier
      const typeIdNode = n.children.find(
        (child) => child.type === 'type_identifier',
      );
      if (typeIdNode) {
        inferTypes.push(typeIdNode.text);
      }
    }
    for (const child of n.children) {
      traverse(child);
    }
  }

  // Only search in the extends clause part (between 'extends' and '?')
  let inExtendsClause = false;
  for (const child of node.children) {
    if (child.type === 'extends') {
      inExtendsClause = true;
      continue;
    }
    if (child.type === '?') {
      break;
    }
    if (inExtendsClause) {
      traverse(child);
    }
  }

  return inferTypes;
}

/**
 * Find nested conditional type in the true or false branch.
 *
 * @param node - The conditional_type AST node
 * @param branch - Which branch to search ('true' or 'false')
 * @returns Parsed nested conditional type, or undefined
 */
function findNestedConditional(
  node: SyntaxNode,
  branch: 'true' | 'false',
): ParsedConditionalType | undefined {
  let foundQuestion = false;
  let foundColon = false;

  for (const child of node.children) {
    if (child.type === '?') {
      foundQuestion = true;
      continue;
    }
    if (child.type === ':') {
      foundColon = true;
      continue;
    }

    // Look for conditional_type in the appropriate branch
    if (branch === 'true' && foundQuestion && !foundColon) {
      if (child.type === 'conditional_type') {
        return extractConditionalType(child);
      }
    } else if (branch === 'false' && foundColon) {
      if (child.type === 'conditional_type') {
        return extractConditionalType(child);
      }
    }
  }

  return undefined;
}

/**
 * Check if a node contains a conditional type.
 *
 * @param node - AST node to check
 * @returns true if the node is or contains a conditional_type
 */
export function isConditionalType(node: SyntaxNode): boolean {
  return node.type === 'conditional_type';
}

/**
 * Find the first conditional_type node within a type expression.
 *
 * @param node - AST node to search within
 * @returns The conditional_type node if found, undefined otherwise
 */
export function findConditionalTypeNode(
  node: SyntaxNode,
): SyntaxNode | undefined {
  if (node.type === 'conditional_type') {
    return node;
  }

  for (const child of node.children) {
    const found = findConditionalTypeNode(child);
    if (found) {
      return found;
    }
  }

  return undefined;
}
