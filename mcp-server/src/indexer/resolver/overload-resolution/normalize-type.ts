/**
 * Normalize a type for comparison (strip generics, nullability).
 */

/**
 * Normalize a type for comparison (strip generics, nullability).
 */
export function normalizeType(typeName: string): string {
  return typeName
    .split('<')[0] // Remove generics
    ?.replace(/\?$/, '') // Remove nullability
    ?.trim() ?? typeName;
}
