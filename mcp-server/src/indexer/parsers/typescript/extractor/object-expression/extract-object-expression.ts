/**
 * Extract object expressions from TypeScript/JavaScript AST.
 *
 * Object expressions (object literals) in TypeScript/JavaScript:
 * - Standard properties: { key: value }
 * - Shorthand properties: { key } (equivalent to { key: key })
 * - Method definitions: { method() {} }
 * - Arrow function properties: { handler: () => {} }
 * - Computed properties: { [key]: value }
 * - Getters/setters: { get prop() {}, set prop(v) {} }
 *
 * AST structure (tree-sitter-typescript):
 * - object > pair | method_definition | shorthand_property_identifier | spread_element
 * - pair > property_identifier | string | computed_property_name, :, expression
 * - method_definition > property_identifier, formal_parameters, statement_block
 */

import type { SyntaxNode } from 'tree-sitter';
import type {
  ParsedObjectExpression,
  ParsedFunction,
  ParsedProperty,
  ParsedParameter,
} from '../../../../types.js';
import { findChildByType, nodeLocation, extractFullTypeName } from '../ast-utils/index.js';
import { extractCalls } from '../calls/index.js';
import { extractParameters } from '../function/extract-parameters.js';
import { extractArrowReturnType } from '../function/extract-return-type.js';

/**
 * Extract an object expression from an `object` AST node.
 *
 * @param node - The `object` AST node
 * @returns ParsedObjectExpression with properties and functions
 */
export function extractObjectExpression(node: SyntaxNode): ParsedObjectExpression {
  const properties: ParsedProperty[] = [];
  const functions: ParsedFunction[] = [];

  for (const child of node.children) {
    switch (child.type) {
      case 'pair':
        extractPair(child, properties, functions);
        break;

      case 'method_definition':
        functions.push(extractObjectMethod(child));
        break;

      case 'shorthand_property_identifier':
        properties.push(extractShorthandProperty(child));
        break;

      // Skip structural tokens and unsupported constructs
      case '{':
      case '}':
      case ',':
      case 'spread_element':
        break;
    }
  }

  return {
    superTypes: [], // TypeScript object literals don't implement interfaces
    properties,
    functions,
    location: nodeLocation(node),
  };
}

/**
 * Extract a key-value pair from the object literal.
 * Determines if the value is a function (method) or a regular property.
 *
 * pair structure:
 * - property_identifier | string | computed_property_name
 * - :
 * - value expression
 */
function extractPair(
  node: SyntaxNode,
  properties: ParsedProperty[],
  functions: ParsedFunction[],
): void {
  const keyNode = findPropertyKey(node);
  if (!keyNode) return;

  const name = extractKeyName(keyNode);
  const valueNode = findPairValue(node);

  if (!valueNode) {
    // No value, treat as property with undefined initializer
    properties.push(createProperty(name, undefined, node));
    return;
  }

  // Check if value is a function (arrow function, function expression, or generator)
  if (valueNode.type === 'arrow_function') {
    functions.push(extractArrowFunctionValue(name, valueNode));
  } else if (
    valueNode.type === 'function_expression' ||
    valueNode.type === 'function' ||
    valueNode.type === 'generator_function' ||
    valueNode.type === 'generator_function_declaration'
  ) {
    functions.push(extractFunctionExpressionValue(name, valueNode));
  } else {
    // Regular property
    properties.push(createProperty(name, valueNode.text, node));
  }
}

/**
 * Find the key node in a pair (can be property_identifier, string, or computed_property_name)
 */
function findPropertyKey(pairNode: SyntaxNode): SyntaxNode | undefined {
  for (const child of pairNode.children) {
    if (
      child.type === 'property_identifier' ||
      child.type === 'string' ||
      child.type === 'computed_property_name'
    ) {
      return child;
    }
  }
  return undefined;
}

/**
 * Extract the key name from various key node types
 */
function extractKeyName(keyNode: SyntaxNode): string {
  if (keyNode.type === 'string') {
    // Remove quotes from string keys: "key" -> key
    return keyNode.text.slice(1, -1);
  }
  if (keyNode.type === 'computed_property_name') {
    // For computed properties, return the full expression: [expr] -> [expr]
    return keyNode.text;
  }
  return keyNode.text;
}

/**
 * Find the value expression in a pair (after the colon)
 */
function findPairValue(pairNode: SyntaxNode): SyntaxNode | undefined {
  let foundColon = false;
  for (const child of pairNode.children) {
    if (foundColon) {
      return child;
    }
    if (child.type === ':') {
      foundColon = true;
    }
  }
  return undefined;
}

/**
 * Create a ParsedProperty for a regular object property
 */
function createProperty(name: string, initializer: string | undefined, node: SyntaxNode): ParsedProperty {
  return {
    name,
    type: undefined, // Object literal properties don't have explicit type annotations
    visibility: 'public',
    isVal: true, // Object properties are effectively const within the object
    initializer,
    annotations: [],
    location: nodeLocation(node),
  };
}

/**
 * Extract an arrow function value as a ParsedFunction
 *
 * Arrow function structure:
 * arrow_function > async?, type_parameters?, formal_parameters | identifier, =>, type_annotation?, body
 */
function extractArrowFunctionValue(name: string, arrowFunc: SyntaxNode): ParsedFunction {
  const isAsync = arrowFunc.children.some((c) => c.type === 'async');

  // Parameters
  const paramsNode = findChildByType(arrowFunc, 'formal_parameters');
  let parameters: ParsedParameter[];

  if (paramsNode) {
    parameters = extractParameters(paramsNode);
  } else {
    // Single parameter without parens: x => x + 1
    const singleParam = arrowFunc.children.find(
      (c) => c.type === 'identifier' && c.nextSibling?.type === '=>'
    );
    if (singleParam) {
      parameters = [
        {
          name: singleParam.text,
          type: undefined,
          defaultValue: undefined,
          annotations: [],
        },
      ];
    } else {
      parameters = [];
    }
  }

  // Return type
  const returnType = extractArrowReturnType(arrowFunc);

  // Body calls
  const body =
    findChildByType(arrowFunc, 'statement_block') ??
    arrowFunc.children.find(
      (c) =>
        c.type !== 'formal_parameters' &&
        c.type !== '=>' &&
        c.type !== 'type_annotation' &&
        c.type !== 'type_parameters' &&
        c.type !== 'async' &&
        c.type !== 'identifier'
    );
  const calls = body ? extractCalls(body) : [];

  return {
    name,
    visibility: 'public',
    parameters,
    returnType,
    isAbstract: false,
    isSuspend: isAsync,
    isExtension: false,
    annotations: [],
    location: nodeLocation(arrowFunc),
    calls,
  };
}

/**
 * Extract a function expression value as a ParsedFunction
 *
 * Function expression structure:
 * function_expression > async?, function?, identifier?, type_parameters?, formal_parameters, type_annotation?, statement_block
 */
function extractFunctionExpressionValue(name: string, funcExpr: SyntaxNode): ParsedFunction {
  const isAsync = funcExpr.children.some((c) => c.type === 'async');

  // Parameters
  const paramsNode = findChildByType(funcExpr, 'formal_parameters');
  const parameters = paramsNode ? extractParameters(paramsNode) : [];

  // Return type
  const typeAnnotation = findChildByType(funcExpr, 'type_annotation');
  const returnType = typeAnnotation ? extractFullTypeName(typeAnnotation) : undefined;

  // Body calls
  const body = findChildByType(funcExpr, 'statement_block');
  const calls = body ? extractCalls(body) : [];

  return {
    name,
    visibility: 'public',
    parameters,
    returnType,
    isAbstract: false,
    isSuspend: isAsync,
    isExtension: false,
    annotations: [],
    location: nodeLocation(funcExpr),
    calls,
  };
}

/**
 * Extract a method definition from an object literal
 *
 * method_definition structure:
 * method_definition > async?, get|set?, property_identifier, type_parameters?, formal_parameters, type_annotation?, statement_block
 */
function extractObjectMethod(node: SyntaxNode): ParsedFunction {
  const nameNode = findChildByType(node, 'property_identifier');
  const name = nameNode?.text ?? '<unknown>';

  const isAsync = node.children.some((c) => c.type === 'async');
  const isGetter = node.children.some((c) => c.text === 'get');
  const isSetter = node.children.some((c) => c.text === 'set');

  // Prepend get/set to name for accessor methods
  const methodName = isGetter ? `get ${name}` : isSetter ? `set ${name}` : name;

  // Parameters
  const paramsNode = findChildByType(node, 'formal_parameters');
  const parameters = paramsNode ? extractParameters(paramsNode) : [];

  // Return type
  const typeAnnotation = findChildByType(node, 'type_annotation');
  const returnType = typeAnnotation ? extractFullTypeName(typeAnnotation) : undefined;

  // Body calls
  const body = findChildByType(node, 'statement_block');
  const calls = body ? extractCalls(body) : [];

  return {
    name: methodName,
    visibility: 'public',
    parameters,
    returnType,
    isAbstract: false,
    isSuspend: isAsync,
    isExtension: false,
    annotations: [],
    location: nodeLocation(node),
    calls,
  };
}

/**
 * Extract a shorthand property identifier
 *
 * Shorthand properties: { foo } is equivalent to { foo: foo }
 */
function extractShorthandProperty(node: SyntaxNode): ParsedProperty {
  return {
    name: node.text,
    type: undefined,
    visibility: 'public',
    isVal: true,
    initializer: node.text, // Shorthand property value equals the key
    annotations: [],
    location: nodeLocation(node),
  };
}

/**
 * Check if a node is an object expression
 */
export function isObjectExpression(node: SyntaxNode): boolean {
  return node.type === 'object';
}

/**
 * Find all object expressions in a subtree
 */
export function findObjectExpressions(node: SyntaxNode): SyntaxNode[] {
  const objects: SyntaxNode[] = [];

  function traverse(n: SyntaxNode): void {
    if (n.type === 'object') {
      objects.push(n);
    }
    for (const child of n.children) {
      traverse(child);
    }
  }

  traverse(node);
  return objects;
}
