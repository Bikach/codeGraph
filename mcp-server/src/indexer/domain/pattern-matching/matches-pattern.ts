/**
 * Match a package against a glob-style pattern.
 * Supports both dot-separated (Kotlin/Java) and slash-separated (TypeScript/JS) patterns.
 *
 * Patterns:
 * - '*' matches any single segment
 * - '**' matches any number of segments
 *
 * Examples:
 * - '*.payment.*' matches 'com.example.payment.service'
 * - '** /payment/**' (no space) matches 'src/payment/service'
 */
export function matchesPattern(pkg: string, pattern: string): boolean {
  // Detect separator from the pattern (slash = file path, dot = package)
  const separator = pattern.includes('/') ? '/' : '.';
  const escapedSeparator = separator === '/' ? '\\/' : '\\.';

  // Convert glob pattern to regex
  // * matches any single segment
  // ** matches any number of segments
  const regexPattern = pattern
    .replace(/[./]/g, (char) => (char === separator ? escapedSeparator : `\\${char}`)) // Escape separators
    .replace(/\*\*/g, '{{DOUBLE_STAR}}') // Temp placeholder
    .replace(/\*/g, `[^${separator === '/' ? '/' : '.'}]+`) // * = one segment
    .replace(/\{\{DOUBLE_STAR}}/g, '.*'); // ** = any segments

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pkg);
}
