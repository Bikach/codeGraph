/**
 * Types for TypeScript/JavaScript modifier extraction.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Extracted modifiers from a TypeScript/JavaScript declaration.
 */
export interface TypeScriptModifiers {
  visibility: Visibility;
  isAbstract: boolean;
  isStatic: boolean;
  isReadonly: boolean;
  isAsync: boolean;
  isExport: boolean;
  isDefault: boolean;
}
