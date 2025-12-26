/**
 * Map visibility modifier text to Visibility type.
 */
import type { Visibility } from '../../../../types.js';

/**
 * Map a visibility modifier string to the Visibility type.
 */
export function mapVisibility(text: string): Visibility {
  switch (text) {
    case 'private':
      return 'private';
    case 'protected':
      return 'protected';
    case 'internal':
      return 'internal';
    default:
      return 'public';
  }
}
