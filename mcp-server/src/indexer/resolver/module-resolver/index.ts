/**
 * Module Resolver for TypeScript/JavaScript
 *
 * Resolves import paths to actual file paths and tracks exports.
 * This enables accurate USES relationship creation by mapping
 * imported symbols to their defining files.
 */

export { resolveModulePath, isRelativeImport } from './resolve-module-path.js';
export { buildExportIndex, type ExportIndex, type ExportEntry } from './export-index.js';
export {
  resolveImportedSymbol,
  buildImportResolutionMap,
  buildAllImportResolutionMaps,
  type ImportResolutionMap,
} from './resolve-imports.js';
