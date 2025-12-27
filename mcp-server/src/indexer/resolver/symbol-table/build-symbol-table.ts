/**
 * Build a global symbol table from a collection of parsed files.
 */

import type { ParsedFile } from '../../types.js';
import type { SymbolTable } from '../types.js';
import { buildTypeHierarchy } from '../type-hierarchy/index.js';
import { indexFile } from './index-file.js';

/**
 * Build a global symbol table from a collection of parsed files.
 */
export function buildSymbolTable(files: ParsedFile[]): SymbolTable {
  const table: SymbolTable = {
    byFqn: new Map(),
    byName: new Map(),
    functionsByName: new Map(),
    byPackage: new Map(),
    typeHierarchy: new Map(),
  };

  for (const file of files) {
    indexFile(table, file);
  }

  // Build type hierarchy after all symbols are indexed
  buildTypeHierarchy(table, files);

  return table;
}
