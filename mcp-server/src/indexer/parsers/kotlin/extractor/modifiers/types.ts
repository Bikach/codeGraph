/**
 * Types for modifier extraction.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Extracted modifiers from a Kotlin declaration.
 */
export interface Modifiers {
  visibility: Visibility;
  isAbstract: boolean;
  isData: boolean;
  isSealed: boolean;
  isSuspend: boolean;
  isInline: boolean;
  isInfix: boolean;
  isOperator: boolean;
}
