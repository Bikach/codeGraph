/**
 * Extract function parameters from Kotlin AST.
 */
import type { SyntaxNode } from 'tree-sitter';
import type { ParsedParameter, ParsedFunctionType } from '../../../../types.js';
import { findChildByType } from '../ast-utils/index.js';
import { extractAnnotations } from '../modifiers/index.js';
import { extractFunctionType } from './extract-function-type.js';

export function extractParameters(node: SyntaxNode): ParsedParameter[] {
  const params: ParsedParameter[] = [];
  const paramList = findChildByType(node, 'function_value_parameters');

  if (!paramList) return params;

  // Track pending modifiers (they appear as siblings before each parameter)
  let pendingModifiers: SyntaxNode | null = null;

  for (const child of paramList.children) {
    if (child.type === 'parameter_modifiers') {
      pendingModifiers = child;
      continue;
    }

    if (child.type === 'parameter') {
      const nameNode = findChildByType(child, 'simple_identifier');
      // Type can be: user_type (String), nullable_type (User?), function_type, or other type nodes
      const functionTypeNode = findChildByType(child, 'function_type');
      const typeNode =
        functionTypeNode ??
        findChildByType(child, 'nullable_type') ??
        findChildByType(child, 'user_type') ??
        findChildByType(child, 'type');
      const defaultValue = findChildByType(child, 'default_value');

      // Extract function type for lambda parameters
      let functionType: ParsedFunctionType | undefined;
      if (functionTypeNode) {
        functionType = extractFunctionType(functionTypeNode, child);
      }

      // Check for crossinline/noinline modifiers
      let isCrossinline = false;
      let isNoinline = false;
      if (pendingModifiers) {
        for (const mod of pendingModifiers.children) {
          if (mod.type === 'parameter_modifier') {
            if (mod.text === 'crossinline') isCrossinline = true;
            if (mod.text === 'noinline') isNoinline = true;
          }
        }
        pendingModifiers = null; // Reset after processing
      }

      params.push({
        name: nameNode?.text ?? '<unnamed>',
        type: typeNode?.text,
        functionType,
        defaultValue: defaultValue?.text,
        annotations: extractAnnotations(child),
        isCrossinline: isCrossinline || undefined,
        isNoinline: isNoinline || undefined,
      });
    }
  }

  return params;
}
