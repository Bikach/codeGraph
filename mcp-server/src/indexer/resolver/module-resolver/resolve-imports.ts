/**
 * Import Resolution
 *
 * Resolves imported symbols to their actual FQNs by combining:
 * - Module path resolution (relative paths → absolute paths)
 * - Export index (what each file exports)
 */

import type { ParsedFile, ParsedImport } from '../../types.js';
import { resolveModulePath, isRelativeImport, buildFilePathSet } from './resolve-module-path.js';
import { type ExportIndex, getExport, buildExportIndex } from './export-index.js';

/**
 * Map of imported symbol names to their resolved FQNs.
 * Map<simpleName, fqn>
 */
export type ImportResolutionMap = Map<string, string>;

/**
 * Resolve a single imported symbol to its FQN.
 *
 * @param imp - The parsed import
 * @param fromFilePath - The file containing the import
 * @param existingFiles - Set of existing file paths
 * @param exportIndex - Index of exports by file
 * @returns The resolved FQN, or undefined if not resolvable
 */
export function resolveImportedSymbol(
  imp: ParsedImport,
  fromFilePath: string,
  existingFiles: Set<string>,
  exportIndex: ExportIndex
): string | undefined {
  // Skip non-relative imports (node_modules, etc.)
  if (!isRelativeImport(imp.path)) {
    return undefined;
  }

  // Resolve the import path to an absolute file path
  const resolvedFilePath = resolveModulePath(imp.path, fromFilePath, existingFiles);
  if (!resolvedFilePath) {
    return undefined;
  }

  // Get the imported symbol name
  const symbolName = imp.name;
  if (!symbolName) {
    // Side-effect import or namespace import without specific symbol
    return undefined;
  }

  // Look up the export in the target file
  const exportEntry = getExport(exportIndex, resolvedFilePath, symbolName);
  if (!exportEntry) {
    // Symbol not found in target file exports
    return undefined;
  }

  // Handle re-exports by following the chain
  if (exportEntry.isReexport && exportEntry.sourceFilePath) {
    const sourceFilePath = resolveModulePath(
      exportEntry.sourceFilePath,
      resolvedFilePath,
      existingFiles
    );
    if (sourceFilePath) {
      const sourceExport = getExport(exportIndex, sourceFilePath, exportEntry.originalName);
      if (sourceExport && !sourceExport.isReexport) {
        return sourceExport.fqn;
      }
    }
  }

  return exportEntry.fqn;
}

/**
 * Build an import resolution map for a file.
 *
 * Maps imported symbol names to their resolved FQNs.
 * This enables accurate type resolution for USES relationships.
 *
 * @param file - The parsed file
 * @param allFiles - All parsed files in the project
 * @param exportIndex - Pre-built export index (optional, will be built if not provided)
 * @returns Map of symbol names to FQNs
 *
 * @example
 * ```ts
 * // File: /src/services/UserService.ts
 * // import { User } from '../models/User';
 * // import { Logger } from '../utils/Logger';
 *
 * const map = buildImportResolutionMap(file, allFiles, exportIndex);
 * // map.get('User') → 'models.User' (or file-based FQN)
 * // map.get('Logger') → 'utils.Logger'
 * ```
 */
export function buildImportResolutionMap(
  file: ParsedFile,
  allFiles: ParsedFile[],
  exportIndex?: ExportIndex
): ImportResolutionMap {
  const map: ImportResolutionMap = new Map();

  // Build export index if not provided
  const index = exportIndex || buildExportIndex(allFiles);

  // Build file path set for fast lookup
  const existingFiles = buildFilePathSet(allFiles.map((f) => f.filePath));

  // Process each import
  for (const imp of file.imports) {
    // Get the local name (alias if present, otherwise the original name)
    const localName = imp.alias || imp.name;
    if (!localName) {
      continue;
    }

    // Try to resolve the import
    const fqn = resolveImportedSymbol(imp, file.filePath, existingFiles, index);
    if (fqn) {
      map.set(localName, fqn);
    }
  }

  // Also add local symbols (classes, functions defined in this file)
  // This enables resolution of types used within the same file
  for (const cls of file.classes) {
    const fqn = file.packageName ? `${file.packageName}.${cls.name}` : cls.name;
    if (!map.has(cls.name)) {
      map.set(cls.name, fqn);
    }
  }

  for (const func of file.topLevelFunctions) {
    const fqn = file.packageName ? `${file.packageName}.${func.name}` : func.name;
    if (!map.has(func.name)) {
      map.set(func.name, fqn);
    }
  }

  for (const alias of file.typeAliases) {
    const fqn = file.packageName ? `${file.packageName}.${alias.name}` : alias.name;
    if (!map.has(alias.name)) {
      map.set(alias.name, fqn);
    }
  }

  return map;
}

/**
 * Build import resolution maps for all files.
 *
 * @param files - All parsed files
 * @returns Map of file paths to their import resolution maps
 */
export function buildAllImportResolutionMaps(
  files: ParsedFile[]
): Map<string, ImportResolutionMap> {
  const result = new Map<string, ImportResolutionMap>();

  // Build export index once for all files
  const exportIndex = buildExportIndex(files);

  for (const file of files) {
    const map = buildImportResolutionMap(file, files, exportIndex);
    result.set(file.filePath, map);
  }

  return result;
}
