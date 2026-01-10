/**
 * Function declaration extraction for TypeScript parsing.
 *
 * Extracts complete function information including parameters,
 * return type, modifiers, generics, and function calls.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction } from '../../../../types.js';
import { findChildByType, nodeLocation } from '../ast-utils/index.js';
import { extractModifiers } from '../modifiers/index.js';
import { extractDecorators } from '../decorators/index.js';
import { extractTypeParameters } from '../generics/index.js';
import { extractCalls } from '../calls/index.js';
import { extractParameters } from './extract-parameters.js';
import { extractReturnType } from './extract-return-type.js';

/**
 * Extract a function declaration from an AST node.
 *
 * Handles:
 * - function_declaration: function foo() {}
 * - generator_function_declaration: function* foo() {}
 *
 * TypeScript function_declaration structure:
 * function_declaration > async?, function, identifier, type_parameters?, formal_parameters, type_annotation?, statement_block
 */
export function extractFunction(node: SyntaxNode): ParsedFunction {
  const nameNode = findChildByType(node, 'identifier');
  const name = nameNode?.text ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const decorators = extractDecorators(node);

  // Type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Parameters
  const params = findChildByType(node, 'formal_parameters');
  const parameters = params ? extractParameters(params) : [];

  // Return type
  const returnType = extractReturnType(node);

  // Function body calls
  const body = findChildByType(node, 'statement_block');
  const calls = body ? extractCalls(body) : [];

  // Check for async - it appears as a direct child with type 'async'
  const isAsync = node.children.some((c) => c.type === 'async');

  return {
    name,
    visibility: modifiers.visibility,
    parameters,
    returnType,
    isAbstract: modifiers.isAbstract,
    isSuspend: isAsync, // Map async to isSuspend for consistency with Kotlin
    isExtension: false, // TypeScript doesn't have extension functions
    receiverType: undefined,
    isInline: undefined, // TypeScript doesn't have inline functions
    isInfix: undefined, // TypeScript doesn't have infix functions
    isOperator: undefined, // TypeScript doesn't have operator functions
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: decorators,
    location: nodeLocation(node),
    calls,
  };
}

/**
 * Extract a method definition from a class body.
 *
 * Handles:
 * - method_definition: regular methods
 * - abstract_method_signature: abstract methods in abstract classes
 *
 * method_definition structure:
 * method_definition > decorator*, accessibility_modifier?, static?, async?, get/set?, property_identifier, type_parameters?, formal_parameters, type_annotation?, statement_block
 *
 * abstract_method_signature structure:
 * abstract_method_signature > abstract, property_identifier, type_parameters?, formal_parameters, type_annotation?
 */
export function extractMethod(node: SyntaxNode): ParsedFunction {
  const nameNode =
    findChildByType(node, 'property_identifier') ?? findChildByType(node, 'private_property_identifier');
  const name = nameNode?.text?.replace(/^#/, '') ?? '<anonymous>';

  const modifiers = extractModifiers(node);
  const decorators = extractDecorators(node);

  // Type parameters (generics)
  const typeParameters = extractTypeParameters(node);

  // Parameters
  const params = findChildByType(node, 'formal_parameters');
  const parameters = params ? extractParameters(params) : [];

  // Return type
  const returnType = extractReturnType(node);

  // Method body calls
  const body = findChildByType(node, 'statement_block');
  const calls = body ? extractCalls(body) : [];

  // Check for async
  const isAsync = node.children.some((c) => c.type === 'async');

  // Check for abstract - either through modifier or node type (abstract_method_signature)
  const isAbstractNode = node.type === 'abstract_method_signature';
  const hasAbstractKeyword = node.children.some((c) => c.type === 'abstract');
  const isAbstract = modifiers.isAbstract || isAbstractNode || hasAbstractKeyword;

  // Handle private field name (#methodName)
  const isPrivateField = nameNode?.type === 'private_property_identifier';
  const visibility = isPrivateField ? 'private' : modifiers.visibility;

  return {
    name,
    visibility,
    parameters,
    returnType,
    isAbstract,
    isSuspend: isAsync,
    isExtension: false,
    receiverType: undefined,
    isInline: undefined,
    isInfix: undefined,
    isOperator: undefined,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: decorators,
    location: nodeLocation(node),
    calls,
  };
}
