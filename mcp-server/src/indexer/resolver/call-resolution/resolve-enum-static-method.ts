/**
 * Resolve synthetic static methods on enum types.
 * Kotlin/Java enums have compiler-generated methods: valueOf, values, entries.
 *
 * @param enumFqn - Fully qualified name of the enum (e.g., "com.example.Role")
 * @param methodName - Name of the method being called
 * @returns FQN of the synthetic method, or undefined if not a known enum method
 */
export function resolveEnumStaticMethod(enumFqn: string, methodName: string): string | undefined {
  // Kotlin/Java enum synthetic methods
  const enumStaticMethods: Record<string, boolean> = {
    valueOf: true, // Enum.valueOf(String): E
    values: true, // Enum.values(): Array<E>
    entries: true, // Kotlin 1.9+ Enum.entries: EnumEntries<E>
  };

  if (enumStaticMethods[methodName]) {
    return `${enumFqn}.${methodName}`;
  }

  return undefined;
}
