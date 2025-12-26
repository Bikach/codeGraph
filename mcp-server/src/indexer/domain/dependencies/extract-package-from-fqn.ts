/**
 * Extract package name from a fully qualified name.
 */
export function extractPackageFromFqn(fqn: string): string | null {
  const lastDot = fqn.lastIndexOf('.');
  if (lastDot === -1) return null;

  // Keep removing last segment until we find a lowercase segment (likely package)
  let current = fqn.substring(0, lastDot);
  while (current.includes('.')) {
    const lastSegment = current.substring(current.lastIndexOf('.') + 1);
    // If segment starts with uppercase, it's a class name, continue
    if (lastSegment[0] === lastSegment[0]?.toUpperCase() && lastSegment[0] !== lastSegment[0]?.toLowerCase()) {
      current = current.substring(0, current.lastIndexOf('.'));
    } else {
      return current;
    }
  }

  return current || null;
}
