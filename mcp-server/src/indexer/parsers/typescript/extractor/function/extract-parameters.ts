/**
 * Extract function parameters from TypeScript AST.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedParameter } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractFullTypeName } from '../ast-utils/extract-type-name.js';
import { extractDecorators } from '../decorators/index.js';

/**
 * Extract parameters from a formal_parameters node.
 *
 * TypeScript formal_parameters structure:
 * formal_parameters > ( > required_parameter | optional_parameter | rest_parameter > )
 *
 * Parameter structures:
 * - required_parameter: identifier, type_annotation?
 * - optional_parameter: identifier, ?, type_annotation?, initializer?
 * - rest_parameter: ..., identifier, type_annotation?
 */
export function extractParameters(params: SyntaxNode): ParsedParameter[] {
  const result: ParsedParameter[] = [];

  for (const child of params.children) {
    switch (child.type) {
      case 'required_parameter':
        result.push(extractRequiredParameter(child));
        break;
      case 'optional_parameter':
        result.push(extractOptionalParameter(child));
        break;
      case 'rest_parameter':
        result.push(extractRestParameter(child));
        break;
    }
  }

  return result;
}

/**
 * Extract a required parameter.
 * Note: Rest parameters (...args) also come as required_parameter with rest_pattern child.
 */
function extractRequiredParameter(node: SyntaxNode): ParsedParameter {
  // Check for rest pattern (...args)
  const restPattern = findChildByType(node, 'rest_pattern');
  if (restPattern) {
    return extractRestPatternParameter(restPattern, node);
  }

  const nameNode =
    findChildByType(node, 'identifier') ?? findChildByType(node, 'shorthand_property_identifier_pattern');
  const typeAnnotation = findChildByType(node, 'type_annotation');
  const initializer = findInitializer(node);
  const decorators = extractDecorators(node);

  return {
    name: nameNode?.text ?? 'unknown',
    type: extractFullTypeName(typeAnnotation),
    // A required parameter with an initializer becomes optional
    defaultValue: initializer?.text,
    annotations: decorators,
  };
}

/**
 * Extract a rest pattern parameter (...args).
 * In tree-sitter TypeScript, rest parameters appear as required_parameter > rest_pattern > identifier.
 */
function extractRestPatternParameter(restPattern: SyntaxNode, parentNode: SyntaxNode): ParsedParameter {
  const nameNode = findChildByType(restPattern, 'identifier');
  const typeAnnotation = findChildByType(parentNode, 'type_annotation');
  const decorators = extractDecorators(parentNode);

  return {
    name: nameNode?.text ?? 'rest',
    type: extractFullTypeName(typeAnnotation),
    defaultValue: undefined,
    annotations: decorators,
  };
}

/**
 * Extract an optional parameter (marked with ?).
 */
function extractOptionalParameter(node: SyntaxNode): ParsedParameter {
  const nameNode =
    findChildByType(node, 'identifier') ?? findChildByType(node, 'shorthand_property_identifier_pattern');
  const typeAnnotation = findChildByType(node, 'type_annotation');
  const initializer = findInitializer(node);
  const decorators = extractDecorators(node);

  return {
    name: nameNode?.text ?? 'unknown',
    type: extractFullTypeName(typeAnnotation),
    defaultValue: initializer?.text,
    annotations: decorators,
  };
}

/**
 * Extract a rest parameter (...rest).
 */
function extractRestParameter(node: SyntaxNode): ParsedParameter {
  const nameNode = findChildByType(node, 'identifier');
  const typeAnnotation = findChildByType(node, 'type_annotation');
  const decorators = extractDecorators(node);

  return {
    name: nameNode?.text ?? 'rest',
    type: extractFullTypeName(typeAnnotation),
    defaultValue: undefined,
    annotations: decorators,
  };
}

/**
 * Find the initializer value in a parameter.
 * The initializer follows the = sign.
 */
function findInitializer(node: SyntaxNode): SyntaxNode | undefined {
  let foundEquals = false;
  for (const child of node.children) {
    if (foundEquals) {
      return child;
    }
    if (child.type === '=') {
      foundEquals = true;
    }
  }
  return undefined;
}
