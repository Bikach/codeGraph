/**
 * Map visibility modifier text to Visibility type.
 *
 * Java visibility mapping:
 * - public -> 'public'
 * - private -> 'private'
 * - protected -> 'protected'
 * - (none) -> 'internal' (package-private)
 */
import type { Visibility } from '../../../../types.js';

/**
 * Map a Java visibility modifier string to the Visibility type.
 * Returns 'internal' for package-private (no modifier).
 */
export function mapVisibility(text: string): Visibility {
  switch (text) {
    case 'public':
      return 'public';
    case 'private':
      return 'private';
    case 'protected':
      return 'protected';
    default:
      return 'internal'; // package-private
  }
}
