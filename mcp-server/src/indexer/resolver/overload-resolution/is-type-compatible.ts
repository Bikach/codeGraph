/**
 * Check if a source type is compatible with a target type.
 * Supports both Kotlin and TypeScript type systems.
 */

/**
 * Kotlin numeric type hierarchy.
 * Maps a type to all types it can be widened to.
 */
const KOTLIN_NUMERIC_HIERARCHY: Record<string, string[]> = {
  Byte: ['Short', 'Int', 'Long', 'Float', 'Double', 'Number'],
  Short: ['Int', 'Long', 'Float', 'Double', 'Number'],
  Int: ['Long', 'Float', 'Double', 'Number'],
  Long: ['Float', 'Double', 'Number'],
  Float: ['Double', 'Number'],
  Double: ['Number'],
};

/**
 * TypeScript type compatibility rules.
 * Maps a type to all types it is assignable to.
 */
const TYPESCRIPT_COMPATIBILITY: Record<string, string[]> = {
  // 'never' is assignable to everything
  never: ['*'],

  // Primitive types
  number: ['number', 'any', 'unknown'],
  string: ['string', 'any', 'unknown'],
  boolean: ['boolean', 'any', 'unknown'],
  bigint: ['bigint', 'any', 'unknown'],
  symbol: ['symbol', 'any', 'unknown'],
  object: ['object', 'any', 'unknown'],

  // Special types
  void: ['void', 'undefined', 'any', 'unknown'],
  undefined: ['undefined', 'void', 'any', 'unknown'],
  null: ['null', 'any', 'unknown'],

  // Arrays
  Array: ['Array', 'ReadonlyArray', 'any', 'unknown'],
  ReadonlyArray: ['ReadonlyArray', 'any', 'unknown'],
};

/**
 * Check if a type is a TypeScript type (lowercase or known TS type).
 */
function isTypeScriptType(type: string): boolean {
  const tsTypes = new Set([
    'any',
    'unknown',
    'never',
    'void',
    'undefined',
    'null',
    'number',
    'string',
    'boolean',
    'bigint',
    'symbol',
    'object',
  ]);
  return tsTypes.has(type) || type[0] === type[0]?.toLowerCase();
}

/**
 * Check if a source type is compatible with a target type.
 * This is a simplified check - full type compatibility requires more analysis.
 */
export function isTypeCompatible(sourceType: string, targetType: string): boolean {
  // Same type
  if (sourceType === targetType) return true;

  // TypeScript: 'any' accepts all types and is assignable to all types
  if (sourceType === 'any' || targetType === 'any') return true;

  // TypeScript: 'unknown' accepts all types (but not assignable to others except any/unknown)
  if (targetType === 'unknown') return true;

  // TypeScript: 'never' is assignable to everything
  if (sourceType === 'never') return true;

  // Kotlin: 'Nothing' is compatible with any type
  if (sourceType === 'Nothing') return true;

  // Kotlin: 'Any' accepts all types
  if (targetType === 'Any') return true;

  // Check TypeScript compatibility rules
  if (isTypeScriptType(sourceType) || isTypeScriptType(targetType)) {
    const compatibleWith = TYPESCRIPT_COMPATIBILITY[sourceType];
    if (compatibleWith) {
      if (compatibleWith.includes('*') || compatibleWith.includes(targetType)) {
        return true;
      }
    }
    return false;
  }

  // Check Kotlin numeric compatibility
  const kotlinCompatibleWith = KOTLIN_NUMERIC_HIERARCHY[sourceType];
  if (kotlinCompatibleWith?.includes(targetType)) {
    return true;
  }

  // Kotlin: CharSequence accepts String
  if (sourceType === 'String' && targetType === 'CharSequence') return true;

  // Kotlin: Collection hierarchy
  if (sourceType === 'Collection' && ['Iterable', 'Any'].includes(targetType)) return true;

  return false;
}
