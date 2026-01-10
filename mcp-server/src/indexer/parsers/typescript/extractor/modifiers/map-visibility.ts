/**
 * Map TypeScript visibility modifiers to Visibility type.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Map a TypeScript accessibility modifier string to Visibility.
 * TypeScript default is public (no explicit modifier means public).
 *
 * @param modifier - The accessibility modifier text ('public', 'private', 'protected')
 * @returns The corresponding Visibility value
 */
export function mapVisibility(modifier: string | undefined): Visibility {
  switch (modifier) {
    case 'public':
      return 'public';
    case 'private':
      return 'private';
    case 'protected':
      return 'protected';
    default:
      return 'public'; // TypeScript default is public
  }
}
