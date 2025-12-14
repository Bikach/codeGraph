/**
 * Compact output formatters for MCP tool responses
 *
 * Format convention:
 * - One line per result
 * - Pipe-separated fields
 * - Header line with count
 *
 * Optimized for LLM token efficiency (~70% reduction vs JSON).
 */

/**
 * Compact output formatters for token optimization
 *
 * Format convention:
 * - One line per result
 * - Pipe-separated fields
 * - Header line with count
 */
export const formatters = {
  /**
   * Format: "type | Name | visibility | filePath:line"
   */
  classInfo: (c: { name: string; type: string; visibility: string; filePath: string; lineNumber: number }) =>
    `${c.type} | ${c.name} | ${c.visibility} | ${c.filePath}:${c.lineNumber}`,

  /**
   * Format: "depth | Type | Name | filePath"
   */
  dependency: (d: { name: string; type: string; depth: number; filePath?: string }) =>
    `${d.depth} | ${d.type} | ${d.name}${d.filePath ? ` | ${d.filePath}` : ''}`,

  /**
   * Format: "direct/indirect | ClassName | filePath:line"
   */
  implementation: (i: { name: string; filePath: string; lineNumber: number; isDirect: boolean }) =>
    `${i.isDirect ? 'direct' : 'indirect'} | ${i.name} | ${i.filePath}:${i.lineNumber}`,

  /**
   * Format: "direction:depth | Class.function() | filePath:line"
   */
  callTrace: (t: { functionName: string; className?: string; filePath: string; lineNumber: number; direction: string; depth: number }) =>
    `${t.direction}:${t.depth} | ${t.className ? `${t.className}.` : ''}${t.functionName}() | ${t.filePath}:${t.lineNumber}`,

  /**
   * Format: "type | name | filePath:line"
   */
  searchResult: (r: { name: string; type: string; filePath: string; lineNumber: number }) =>
    `${r.type} | ${r.name} | ${r.filePath}:${r.lineNumber}`,
};

/**
 * Build compact text output for MCP responses
 */
export function buildCompactOutput<T>(
  header: string,
  items: T[],
  formatter: (item: T) => string
): string {
  if (items.length === 0) {
    return `${header}: No results found.`;
  }
  return `${header} (${items.length}):\n${items.map(formatter).join('\n')}`;
}
