/**
 * Get the FQN of the current class from resolution context.
 */

import type { ResolutionContext } from '../types.js';

/**
 * Get the FQN of the current class from context.
 */
export function getClassFqn(context: ResolutionContext): string {
  if (!context.currentClass) return '';
  const packageName = context.currentFile.packageName || '';
  return packageName ? `${packageName}.${context.currentClass.name}` : context.currentClass.name;
}
