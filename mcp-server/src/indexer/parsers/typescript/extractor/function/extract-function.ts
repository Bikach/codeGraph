/**
 * Function declaration extraction for TypeScript parsing.
 *
 * Extracts complete function information including parameters,
 * return type, modifiers, generics, and function calls.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedFunction, ParsedOverloadSignature } from '../../../../types.js';
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

/**
 * Extract a function overload signature from an AST node.
 *
 * Handles:
 * - function_signature: function overload declaration without body
 *
 * TypeScript function_signature structure:
 * function_signature > async?, function, identifier, type_parameters?, formal_parameters, type_annotation?, ;
 *
 * Example:
 *   function parse(input: string): Document;
 *   function parse(input: Buffer): Document;
 */
export function extractFunctionSignature(node: SyntaxNode): ParsedFunction {
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

  // Check for async - it appears as a direct child with type 'async'
  const isAsync = node.children.some((c) => c.type === 'async');

  return {
    name,
    visibility: modifiers.visibility,
    parameters,
    returnType,
    isAbstract: false,
    isSuspend: isAsync,
    isExtension: false,
    receiverType: undefined,
    isInline: undefined,
    isInfix: undefined,
    isOperator: undefined,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: decorators,
    location: nodeLocation(node),
    calls: [], // Signatures have no body, so no calls
    isOverloadSignature: true,
  };
}

/**
 * Extract a method overload signature from a class body.
 *
 * Handles:
 * - method_signature: method overload declaration without body
 *
 * TypeScript method_signature structure:
 * method_signature > accessibility_modifier?, async?, property_identifier, type_parameters?, formal_parameters, type_annotation?
 *
 * Example:
 *   class Parser {
 *     parse(input: string): Document;
 *     parse(input: Buffer): Document;
 *     parse(input: string | Buffer): Document { ... }
 *   }
 */
export function extractMethodSignature(node: SyntaxNode): ParsedFunction {
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

  // Check for async
  const isAsync = node.children.some((c) => c.type === 'async');

  // Handle private field name (#methodName)
  const isPrivateField = nameNode?.type === 'private_property_identifier';
  const visibility = isPrivateField ? 'private' : modifiers.visibility;

  return {
    name,
    visibility,
    parameters,
    returnType,
    isAbstract: false,
    isSuspend: isAsync,
    isExtension: false,
    receiverType: undefined,
    isInline: undefined,
    isInfix: undefined,
    isOperator: undefined,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    annotations: decorators,
    location: nodeLocation(node),
    calls: [], // Signatures have no body, so no calls
    isOverloadSignature: true,
  };
}

/**
 * Convert a ParsedFunction (overload signature) to a ParsedOverloadSignature.
 */
export function toOverloadSignature(func: ParsedFunction): ParsedOverloadSignature {
  return {
    parameters: func.parameters,
    returnType: func.returnType,
    typeParameters: func.typeParameters,
    location: func.location,
  };
}

/**
 * Link overload signatures to their implementation function.
 *
 * Given a list of functions where some are overload signatures and one is the implementation,
 * this function merges the overload signatures into the implementation.
 *
 * @param functions - List of functions that may include overloads
 * @returns List of functions with overloads merged into implementations
 */
export function linkOverloadsToImplementations(functions: ParsedFunction[]): ParsedFunction[] {
  // Group functions by name
  const byName = new Map<string, ParsedFunction[]>();
  for (const func of functions) {
    const existing = byName.get(func.name) ?? [];
    existing.push(func);
    byName.set(func.name, existing);
  }

  const result: ParsedFunction[] = [];

  for (const [, funcs] of byName) {
    if (funcs.length === 1) {
      // Single function, no overloads
      result.push(funcs[0]!);
      continue;
    }

    // Multiple functions with same name - find implementation and signatures
    const signatures = funcs.filter((f) => f.isOverloadSignature);
    const implementations = funcs.filter((f) => !f.isOverloadSignature);

    if (implementations.length === 1 && signatures.length > 0) {
      // Standard case: one implementation with multiple overload signatures
      const impl = implementations[0]!;
      impl.overloads = signatures.map(toOverloadSignature);
      result.push(impl);
    } else if (implementations.length === 0 && signatures.length > 0) {
      // All signatures, no implementation (e.g., ambient declarations)
      // Keep all as separate signature functions
      result.push(...signatures);
    } else {
      // Unexpected case: multiple implementations or other edge cases
      // Keep all functions as-is
      result.push(...funcs);
    }
  }

  return result;
}
