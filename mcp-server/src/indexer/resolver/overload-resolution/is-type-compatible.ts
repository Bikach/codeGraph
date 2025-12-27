/**
 * Check if a source type is compatible with a target type.
 */

/**
 * Check if a source type is compatible with a target type.
 * This is a simplified check - full type compatibility requires more analysis.
 */
export function isTypeCompatible(sourceType: string, targetType: string): boolean {
  // Same type
  if (sourceType === targetType) return true;

  // Nothing? is compatible with any nullable type
  if (sourceType === 'Nothing') return true;

  // Numeric type hierarchy
  const numericHierarchy: Record<string, string[]> = {
    Byte: ['Short', 'Int', 'Long', 'Float', 'Double', 'Number'],
    Short: ['Int', 'Long', 'Float', 'Double', 'Number'],
    Int: ['Long', 'Float', 'Double', 'Number'],
    Long: ['Float', 'Double', 'Number'],
    Float: ['Double', 'Number'],
    Double: ['Number'],
  };

  // Check numeric compatibility
  const compatibleWith = numericHierarchy[sourceType];
  if (compatibleWith?.includes(targetType)) {
    return true;
  }

  // Any accepts all types
  if (targetType === 'Any') return true;

  // CharSequence accepts String
  if (sourceType === 'String' && targetType === 'CharSequence') return true;

  // Collection hierarchy
  if (sourceType === 'Collection' && ['Iterable', 'Any'].includes(targetType)) return true;

  return false;
}
