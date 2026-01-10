/**
 * Extract modifiers from a TypeScript/JavaScript declaration node.
 *
 * TypeScript AST structure for modifiers:
 * Modifiers appear as direct children before the declaration keyword.
 * Examples:
 * - export class Foo {}
 * - public abstract class Bar {}
 * - private readonly prop: string;
 *
 * Accessibility modifiers: public, private, protected
 * Other modifiers: abstract, static, readonly, async, override, accessor, export, default, declare
 */
import type { SyntaxNode } from 'tree-sitter';
import { mapVisibility } from './map-visibility.js';
import type { TypeScriptModifiers } from './types.js';
import { DEFAULT_TYPESCRIPT_MODIFIERS } from './types.js';

/**
 * Extract all modifiers from a TypeScript declaration node.
 * Returns default values (public visibility, no flags) if no modifiers found.
 */
export function extractModifiers(node: SyntaxNode): TypeScriptModifiers {
  const result: TypeScriptModifiers = { ...DEFAULT_TYPESCRIPT_MODIFIERS };

  // TypeScript modifiers appear as direct children of the declaration
  for (const child of node.children) {
    // In tree-sitter-typescript, modifiers have specific types
    switch (child.type) {
      // Accessibility modifiers
      case 'accessibility_modifier':
        result.visibility = mapVisibility(child.text);
        break;

      case 'public':
        result.visibility = 'public';
        break;

      case 'private':
        result.visibility = 'private';
        break;

      case 'protected':
        result.visibility = 'protected';
        break;

      // Other modifiers
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

      case 'override':
        result.isOverride = true;
        break;

      case 'accessor':
        result.isAccessor = true;
        break;

      case 'export':
        result.isExport = true;
        break;

      case 'default':
        result.isDefault = true;
        break;

      case 'declare':
        result.isDeclare = true;
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

/**
 * Check if a node has the abstract modifier.
 */
export function isAbstract(node: SyntaxNode): boolean {
  return node.children.some((c) => c.type === 'abstract');
}

/**
 * Check if a node has the export modifier.
 */
export function isExported(node: SyntaxNode): boolean {
  return node.children.some((c) => c.type === 'export');
}
