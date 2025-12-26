/**
 * Extract modifiers from a Kotlin declaration node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';
import { mapVisibility } from './map-visibility.js';
import type { Modifiers } from './types.js';

/**
 * Extract all modifiers from a declaration node.
 * Returns default values (public visibility, no flags) if no modifiers found.
 */
export function extractModifiers(node: SyntaxNode): Modifiers {
  const result: Modifiers = {
    visibility: 'public',
    isAbstract: false,
    isData: false,
    isSealed: false,
    isSuspend: false,
    isInline: false,
    isInfix: false,
    isOperator: false,
  };

  const modifiersList = findChildByType(node, 'modifiers');
  if (!modifiersList) return result;

  for (const child of modifiersList.children) {
    switch (child.type) {
      case 'visibility_modifier':
        result.visibility = mapVisibility(child.text);
        break;
      case 'inheritance_modifier':
        if (child.text === 'abstract') result.isAbstract = true;
        if (child.text === 'sealed') result.isSealed = true;
        break;
      case 'class_modifier':
        if (child.text === 'data') result.isData = true;
        if (child.text === 'sealed') result.isSealed = true;
        break;
      case 'function_modifier':
        if (child.text === 'suspend') result.isSuspend = true;
        if (child.text === 'inline') result.isInline = true;
        if (child.text === 'infix') result.isInfix = true;
        if (child.text === 'operator') result.isOperator = true;
        break;
    }
  }

  return result;
}
