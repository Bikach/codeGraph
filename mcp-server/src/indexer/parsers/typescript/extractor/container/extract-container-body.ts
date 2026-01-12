/**
 * Shared utilities for extracting body contents from TypeScript containers
 * (namespaces, ambient modules, etc.).
 *
 * This module provides common extraction logic for container declarations
 * that share similar AST structures and member types.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedClass, ParsedFunction, ParsedProperty, ParsedTypeAlias } from '../../../../types.js';
import { extractClass } from '../class/extract-class.js';
import { extractInterface } from '../class/extract-interface.js';
import { extractEnum } from '../class/extract-enum.js';
import { extractFunction } from '../function/extract-function.js';
import { extractVariable } from '../property/extract-variable.js';
import { extractTypeAlias } from '../types/extract-type-alias.js';

/**
 * Result of extracting container body contents.
 * Used by namespaces, ambient modules, and similar container structures.
 */
export interface ContainerBodyResult {
  functions: ParsedFunction[];
  properties: ParsedProperty[];
  nestedClasses: ParsedClass[];
  typeAliases: ParsedTypeAlias[];
}

/**
 * Options for customizing container body extraction.
 */
export interface ContainerBodyOptions {
  /**
   * Handler for nested containers (e.g., nested namespaces or ambient modules).
   * If not provided, nested containers are ignored.
   */
  extractNestedContainer?: (node: SyntaxNode) => ParsedClass | undefined;

  /**
   * Whether to handle function_signature nodes (common in ambient modules).
   * If true, function signatures are extracted with isOverloadSignature=true.
   */
  handleFunctionSignatures?: boolean;

  /**
   * Additional node types to skip (e.g., ';' for ambient modules).
   */
  skipTypes?: string[];
}

/**
 * Extract contents from a container body (statement_block).
 *
 * @param body - The statement_block node containing container members
 * @param options - Customization options for extraction
 * @returns Extracted functions, properties, nested types, and type aliases
 */
export function extractContainerBody(
  body: SyntaxNode | undefined,
  options: ContainerBodyOptions = {}
): ContainerBodyResult {
  const result: ContainerBodyResult = {
    functions: [],
    properties: [],
    nestedClasses: [],
    typeAliases: [],
  };

  if (!body) return result;

  const skipTypes = new Set(['{', '}', ...(options.skipTypes ?? [])]);

  for (const child of body.children) {
    // Skip punctuation and configured skip types
    if (skipTypes.has(child.type)) continue;

    // Handle export statements - unwrap and extract inner declaration
    if (child.type === 'export_statement') {
      extractFromExportStatement(child, result, options);
      continue;
    }

    // Direct declarations
    extractContainerMember(child, result, options);
  }

  return result;
}

/**
 * Extract a member declaration from an export statement inside a container.
 */
function extractFromExportStatement(
  exportNode: SyntaxNode,
  result: ContainerBodyResult,
  options: ContainerBodyOptions
): void {
  for (const child of exportNode.children) {
    // Skip export keyword and other tokens
    if (
      child.type === 'export' ||
      child.type === 'default' ||
      child.type === 'type' ||
      child.type === '{' ||
      child.type === '}' ||
      child.type === 'export_clause' ||
      child.type === 'from' ||
      child.type === 'string' ||
      child.type === ';'
    ) {
      continue;
    }

    extractContainerMember(child, result, options);
  }
}

/**
 * Extract a single member declaration from a container.
 */
function extractContainerMember(
  node: SyntaxNode,
  result: ContainerBodyResult,
  options: ContainerBodyOptions
): void {
  switch (node.type) {
    // Classes
    case 'class_declaration':
    case 'abstract_class_declaration':
      result.nestedClasses.push(extractClass(node));
      break;

    // Interfaces
    case 'interface_declaration':
      result.nestedClasses.push(extractInterface(node));
      break;

    // Enums
    case 'enum_declaration':
      result.nestedClasses.push(extractEnum(node));
      break;

    // Functions
    case 'function_declaration':
    case 'generator_function_declaration':
      result.functions.push(extractFunction(node));
      break;

    // Function signatures (optional, enabled for ambient modules)
    case 'function_signature':
      if (options.handleFunctionSignatures) {
        const func = extractFunction(node);
        func.isOverloadSignature = true;
        result.functions.push(func);
      }
      break;

    // Variables
    case 'lexical_declaration':
    case 'variable_declaration':
      result.properties.push(...extractVariable(node));
      break;

    // Type aliases
    case 'type_alias_declaration':
      result.typeAliases.push(extractTypeAlias(node));
      break;

    // Nested containers (handled by the caller's custom extractor)
    default:
      if (options.extractNestedContainer) {
        const nested = options.extractNestedContainer(node);
        if (nested) {
          result.nestedClasses.push(nested);
        }
      }
      break;
  }
}
