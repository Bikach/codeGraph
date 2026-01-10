/**
 * Extract modifiers from a TypeScript/JavaScript declaration node.
 */
import type { SyntaxNode } from 'tree-sitter';
import { mapVisibility } from './map-visibility.js';
import type { TypeScriptModifiers } from './types.js';

/**
 * Extract all modifiers from a TypeScript/JavaScript declaration node.
 * Returns default values (public visibility, no flags) if no modifiers found.
 *
 * TypeScript stores modifiers differently from Kotlin:
 * - accessibility_modifier: public, private, protected
 * - abstract, static, readonly, async: direct children of the declaration
 */
export function extractModifiers(node: SyntaxNode): TypeScriptModifiers {
  const result: TypeScriptModifiers = {
    visibility: 'public',
    isAbstract: false,
    isStatic: false,
    isReadonly: false,
    isAsync: false,
    isExport: false,
    isDefault: false,
  };

  // Check direct children for modifiers
  for (const child of node.children) {
    switch (child.type) {
      case 'accessibility_modifier': // public, private, protected
        result.visibility = mapVisibility(child.text);
        break;
      case 'abstract':
        result.isAbstract = true;
        break;
      case 'static':
        result.isStatic = true;
        break;
      case 'readonly':
        result.isReadonly = true;
        break;
      case 'async':
        result.isAsync = true;
        break;
    }
  }

  // Check if the parent is an export_statement
  if (node.parent?.type === 'export_statement') {
    result.isExport = true;
    // Check for 'default' in the parent
    for (const sibling of node.parent.children) {
      if (sibling.type === 'default') {
        result.isDefault = true;
        break;
      }
    }
  }

  return result;
}
