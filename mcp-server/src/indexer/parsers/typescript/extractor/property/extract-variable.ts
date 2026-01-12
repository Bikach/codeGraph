/**
 * Extract variable declarations from TypeScript AST.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedProperty } from '../../../../types.js';
import { findChildByType, nodeLocation, findInitializer } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';

/**
 * Extract variables from a lexical_declaration or variable_declaration.
 *
 * lexical_declaration structure:
 * lexical_declaration > const/let > variable_declarator+
 *
 * variable_declaration structure:
 * variable_declaration > var > variable_declarator+
 *
 * variable_declarator structure:
 * variable_declarator > identifier, type_annotation?, =?, initializer?
 */
export function extractVariable(node: SyntaxNode): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // Check if const, let, or var
  const isConst = node.children.some((c) => c.text === 'const');

  for (const declarator of node.children) {
    if (declarator.type === 'variable_declarator') {
      const property = extractSingleVariable(declarator, isConst);
      if (property) {
        properties.push(property);
      }
    }
  }

  return properties;
}

/**
 * Extract a single variable from a variable_declarator.
 */
function extractSingleVariable(declarator: SyntaxNode, isConst: boolean): ParsedProperty | undefined {
  const nameNode = findChildByType(declarator, 'identifier');
  if (!nameNode) return undefined;

  const typeAnnotation = findChildByType(declarator, 'type_annotation');
  const initializer = findInitializer(declarator);

  return {
    name: nameNode.text,
    type: extractFullTypeName(typeAnnotation),
    visibility: 'public', // Top-level variables are effectively public
    isVal: isConst, // const = immutable, let/var = mutable
    initializer: initializer?.text,
    annotations: [],
    location: nodeLocation(declarator),
  };
}

/**
 * Check if a variable declarator should be treated as a function.
 * This is used to filter out arrow function assignments from variable extraction.
 */
export function isVariableFunction(declarator: SyntaxNode): boolean {
  const initializer = findInitializer(declarator);
  if (!initializer) return false;

  return (
    initializer.type === 'arrow_function' ||
    initializer.type === 'function_expression' ||
    initializer.type === 'generator_function'
  );
}
