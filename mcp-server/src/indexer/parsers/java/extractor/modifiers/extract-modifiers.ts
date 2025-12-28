/**
 * Extract modifiers from a Java declaration node.
 *
 * Java AST structure:
 * - modifiers (contains multiple modifier nodes)
 *   - public/private/protected/abstract/static/final/etc.
 *   - marker_annotation / annotation
 */
import type { SyntaxNode } from 'tree-sitter';
import { findChildByType } from '../ast-utils/index.js';
import { mapVisibility } from './map-visibility.js';
import type { JavaModifiers } from './types.js';
import { DEFAULT_JAVA_MODIFIERS } from './types.js';

/**
 * Extract all modifiers from a Java declaration node.
 * Returns default values (package-private visibility, no flags) if no modifiers found.
 */
export function extractModifiers(node: SyntaxNode): JavaModifiers {
  const result: JavaModifiers = { ...DEFAULT_JAVA_MODIFIERS };

  const modifiersNode = findChildByType(node, 'modifiers');
  if (!modifiersNode) return result;

  for (const child of modifiersNode.children) {
    // In tree-sitter-java, modifiers are direct text nodes
    const text = child.text;

    switch (text) {
      // Visibility
      case 'public':
      case 'private':
      case 'protected':
        result.visibility = mapVisibility(text);
        break;

      // Class/method modifiers
      case 'abstract':
        result.isAbstract = true;
        break;
      case 'final':
        result.isFinal = true;
        break;
      case 'static':
        result.isStatic = true;
        break;
      case 'sealed':
        result.isSealed = true;
        break;
      case 'non-sealed':
        result.isNonSealed = true;
        break;

      // Method-specific modifiers
      case 'default':
        result.isDefault = true;
        break;
      case 'synchronized':
        result.isSynchronized = true;
        break;
      case 'native':
        result.isNative = true;
        break;
      case 'strictfp':
        result.isStrictfp = true;
        break;

      // Field-specific modifiers
      case 'transient':
        result.isTransient = true;
        break;
      case 'volatile':
        result.isVolatile = true;
        break;
    }
  }

  return result;
}
