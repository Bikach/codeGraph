import type { ParsedFile, ResolvedFile } from '../../types.js';
import type { SymbolTable } from '../types.js';
import { buildSymbolTable } from '../symbol-table/index.js';
import { resolveFile } from './resolve-file.js';

/**
 * Resolve all symbols in a collection of parsed files.
 * Returns files with resolved call references.
 */
export function resolveSymbols(files: ParsedFile[], symbolTable?: SymbolTable): ResolvedFile[] {
  const table = symbolTable || buildSymbolTable(files);
  return files.map((file) => resolveFile(table, file));
}
