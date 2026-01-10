/**
 * Types for TypeScript/JavaScript modifier extraction.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Extracted modifiers from a TypeScript/JavaScript declaration.
 *
 * TypeScript-specific modifiers:
 * - isAbstract: abstract classes/methods
 * - isStatic: static members
 * - isReadonly: readonly properties
 * - isAsync: async functions
 * - isOverride: override methods (TypeScript 4.3+)
 * - isAccessor: accessor keyword (TypeScript 5.0+)
 */
export interface TypeScriptModifiers {
  visibility: Visibility;
  isAbstract: boolean;
  isStatic: boolean;
  isReadonly: boolean;
  isAsync: boolean;
  isOverride: boolean;
  isAccessor: boolean;
  isExport: boolean;
  isDefault: boolean;
  isDeclare: boolean;
}

/**
 * Default modifiers for TypeScript declarations.
 * Note: TypeScript defaults to public visibility for class members.
 */
export const DEFAULT_TYPESCRIPT_MODIFIERS: TypeScriptModifiers = {
  visibility: 'public', // public by default in TypeScript
  isAbstract: false,
  isStatic: false,
  isReadonly: false,
  isAsync: false,
  isOverride: false,
  isAccessor: false,
  isExport: false,
  isDefault: false,
  isDeclare: false,
};
