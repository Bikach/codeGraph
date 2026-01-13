/**
 * Module Path Resolution
 *
 * Resolves relative import paths to absolute file paths.
 * Handles: ./relative, ../parent, and absolute paths.
 */

import * as path from 'path';

/**
 * TypeScript/JavaScript file extensions to try when resolving imports.
 */
const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Check if an import path is a relative import.
 */
export function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith('./') || importPath.startsWith('../');
}

/**
 * Check if an import path is a package import (node_modules).
 */
export function isPackageImport(importPath: string): boolean {
  return !isRelativeImport(importPath) && !path.isAbsolute(importPath);
}

/**
 * Resolve a relative import path to an absolute file path.
 *
 * @param importPath - The import path (e.g., './User', '../models/User')
 * @param fromFilePath - The absolute path of the file containing the import
 * @param existingFiles - Set of existing file paths in the project (for validation)
 * @returns The resolved absolute file path, or undefined if not found
 *
 * @example
 * ```ts
 * // From /project/src/services/UserService.ts
 * // import { User } from '../models/User'
 * resolveModulePath('../models/User', '/project/src/services/UserService.ts', files)
 * // Returns: '/project/src/models/User.ts'
 * ```
 */
export function resolveModulePath(
  importPath: string,
  fromFilePath: string,
  existingFiles: Set<string>
): string | undefined {
  // Skip package imports (node_modules)
  if (isPackageImport(importPath)) {
    return undefined;
  }

  // Get the directory of the importing file
  const fromDir = path.dirname(fromFilePath);

  // Resolve the relative path
  let resolvedBase = path.resolve(fromDir, importPath);

  // Normalize the path
  resolvedBase = path.normalize(resolvedBase);

  // Try exact match first (for paths with extensions)
  if (existingFiles.has(resolvedBase)) {
    return resolvedBase;
  }

  // Try adding extensions
  for (const ext of TS_EXTENSIONS) {
    const withExt = resolvedBase + ext;
    if (existingFiles.has(withExt)) {
      return withExt;
    }
  }

  // Try index file in directory
  for (const ext of TS_EXTENSIONS) {
    const indexFile = path.join(resolvedBase, `index${ext}`);
    if (existingFiles.has(indexFile)) {
      return indexFile;
    }
  }

  return undefined;
}

/**
 * Build a set of file paths from parsed files for fast lookup.
 */
export function buildFilePathSet(filePaths: string[]): Set<string> {
  return new Set(filePaths.map((p) => path.normalize(p)));
}
