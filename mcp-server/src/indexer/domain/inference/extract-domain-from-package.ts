/**
 * Extract domain name from a package path.
 */
export function extractDomainFromPackage(pkg: string, segmentIndex: number): string | null {
  // Handle both dot-separated (Java/Kotlin) and slash-separated (TS/JS) paths
  const separator = pkg.includes('/') ? '/' : '.';
  const segments = pkg.split(separator);

  if (segments.length > segmentIndex) {
    const domainSegment = segments[segmentIndex];
    // Skip common non-domain segments
    const skipSegments = ['domain', 'application', 'infrastructure', 'presentation', 'api', 'impl', 'internal'];
    if (domainSegment && !skipSegments.includes(domainSegment.toLowerCase())) {
      return domainSegment.toLowerCase();
    }
    // If skipped, try next segment
    if (segments.length > segmentIndex + 1) {
      return segments[segmentIndex + 1]?.toLowerCase() || null;
    }
  }

  return null;
}
