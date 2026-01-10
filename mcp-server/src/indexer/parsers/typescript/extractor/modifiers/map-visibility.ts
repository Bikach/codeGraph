/**
 * Map visibility modifier text to Visibility type for TypeScript.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Map a TypeScript visibility modifier string to the Visibility type.
 * TypeScript default is public (no explicit modifier means public).
 */
export function mapVisibility(modifier: string | undefined): Visibility {
  switch (modifier) {
    case 'private':
      return 'private';
    case 'protected':
      return 'protected';
    case 'public':
    default:
      return 'public'; // TypeScript default is public
  }
}
