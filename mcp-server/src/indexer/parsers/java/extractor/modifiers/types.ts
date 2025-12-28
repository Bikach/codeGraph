/**
 * Types for Java modifier extraction.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Extracted modifiers from a Java declaration.
 *
 * Java-specific modifiers:
 * - isFinal: final classes/methods/fields (maps to isVal for fields)
 * - isStatic: static members
 * - isDefault: default interface methods
 * - isSynchronized: synchronized methods
 * - isNative: native methods
 * - isStrictfp: strictfp classes/methods
 * - isNonSealed: non-sealed classes (Java 17+)
 */
export interface JavaModifiers {
  visibility: Visibility;
  isAbstract: boolean;
  isFinal: boolean;
  isStatic: boolean;
  isSealed: boolean;
  isNonSealed: boolean;
  isDefault: boolean;
  isSynchronized: boolean;
  isNative: boolean;
  isStrictfp: boolean;
  isTransient: boolean;
  isVolatile: boolean;
}

/**
 * Default modifiers for Java declarations.
 * Note: Java defaults to package-private visibility (mapped to 'internal').
 */
export const DEFAULT_JAVA_MODIFIERS: JavaModifiers = {
  visibility: 'internal', // package-private by default
  isAbstract: false,
  isFinal: false,
  isStatic: false,
  isSealed: false,
  isNonSealed: false,
  isDefault: false,
  isSynchronized: false,
  isNative: false,
  isStrictfp: false,
  isTransient: false,
  isVolatile: false,
};
