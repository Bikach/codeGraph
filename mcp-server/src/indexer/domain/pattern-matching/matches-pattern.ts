/**
 * Match a package against a glob-style pattern.
 */
export function matchesPattern(pkg: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // * matches any single segment
  // ** matches any number of segments
  const regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '{{DOUBLE_STAR}}') // Temp placeholder
    .replace(/\*/g, '[^.]+') // * = one segment
    .replace(/\{\{DOUBLE_STAR}}/g, '.*'); // ** = any segments

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pkg);
}
