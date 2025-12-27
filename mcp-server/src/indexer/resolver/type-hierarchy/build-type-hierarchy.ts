/**
 * Build the type hierarchy (extends/implements relationships).
 */

import type { SymbolTable } from '../types.js';
import type { ParsedFile } from '../../types.js';
import { buildClassHierarchy } from './build-class-hierarchy.js';

/**
 * Build the type hierarchy (extends/implements relationships) for all files.
 *
 * This function iterates through all parsed files and builds the inheritance
 * relationships (superclass, interfaces) for each class, storing them in the
 * symbol table's typeHierarchy map.
 *
 * @param table - The symbol table to update with hierarchy information
 * @param files - The parsed files to process
 */
export function buildTypeHierarchy(table: SymbolTable, files: ParsedFile[]): void {
  for (const file of files) {
    const packageName = file.packageName || '';
    for (const cls of file.classes) {
      buildClassHierarchy(table, cls, packageName);
    }
  }
}
