/**
 * Companion object detection for Kotlin parsing.
 */

import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';

/**
 * Check if an object declaration is a companion object.
 *
 * Companion objects are singleton objects declared inside a class
 * using the `companion` modifier.
 */
export function isCompanionObject(node: SyntaxNode): boolean {
  // Check if the object declaration has 'companion' modifier
  const modifiers = findChildByType(node, 'modifiers');
  if (modifiers) {
    for (const child of modifiers.children) {
      if (child.type === 'class_modifier' && child.text === 'companion') {
        return true;
      }
    }
  }

  // Also check for 'companion' keyword as direct child
  return node.children.some((c) => c.type === 'companion');
}
