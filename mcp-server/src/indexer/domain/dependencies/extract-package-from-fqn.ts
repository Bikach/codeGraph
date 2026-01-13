/**
 * Detect the path separator used in a string.
 * Returns '/' for slash-separated paths, '.' for dot-separated.
 */
function detectSeparator(path: string): '/' | '.' {
  // If it contains slashes, it's a file path (TypeScript/JavaScript)
  // If it only contains dots, it's a package name (Kotlin/Java)
  return path.includes('/') ? '/' : '.';
}

/**
 * Extract package/module name from a fully qualified name.
 * Supports both dot-separated (Kotlin/Java) and slash-separated (TypeScript/JS) paths.
 *
 * Examples:
 * - "com.example.user.UserService" -> "com.example.user"
 * - "src/payment/PaymentService" -> "src/payment"
 * - "@company/package/Service" -> "@company/package"
 */
export function extractPackageFromFqn(fqn: string): string | null {
  const separator = detectSeparator(fqn);
  const lastSep = fqn.lastIndexOf(separator);
  if (lastSep === -1) return null;

  // Keep removing last segment until we find a lowercase segment (likely package)
  let current = fqn.substring(0, lastSep);
  while (current.includes(separator)) {
    const lastSegment = current.substring(current.lastIndexOf(separator) + 1);
    // If segment starts with uppercase, it's a class name, continue
    if (lastSegment[0] === lastSegment[0]?.toUpperCase() && lastSegment[0] !== lastSegment[0]?.toLowerCase()) {
      current = current.substring(0, current.lastIndexOf(separator));
    } else {
      return current;
    }
  }

  return current || null;
}
