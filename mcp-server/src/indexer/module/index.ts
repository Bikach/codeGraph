/**
 * Module Path Inference
 *
 * This module provides utilities for inferring module paths from file paths.
 * This is primarily used for TypeScript/JavaScript projects where there is no
 * explicit package declaration like in Kotlin/Java.
 *
 * The module path is derived from the relative path of the file within the project,
 * providing a hierarchical structure similar to packages.
 */

import path from 'path';

/**
 * Configuration for module path inference.
 */
export interface ModuleInferenceOptions {
  /** The project root path (absolute path) */
  projectPath: string;
  /**
   * Source directories to strip from module paths.
   * Common values: ['src', 'lib', 'app', 'source']
   * Default: ['src', 'lib', 'app']
   */
  sourceRoots?: string[];
  /**
   * Whether to include the file name (without extension) in the module path.
   * If false, only the directory structure is used.
   * Default: false (directory-based modules)
   */
  includeFileName?: boolean;
  /**
   * Separator to use in module paths.
   * Default: '/' (e.g., 'components/user/profile')
   */
  separator?: string;
}

/**
 * Default source roots to strip from module paths.
 */
const DEFAULT_SOURCE_ROOTS = ['src', 'lib', 'app', 'source', 'sources'];

/**
 * Infer a module path from a file path.
 *
 * Examples:
 * - `/project/src/components/User.ts` → `components/User` or `components`
 * - `/project/src/services/auth/AuthService.ts` → `services/auth` or `services/auth/AuthService`
 * - `/project/lib/utils/helpers.ts` → `utils` or `utils/helpers`
 *
 * @param filePath - Absolute path to the source file
 * @param options - Module inference options
 * @returns The inferred module path, or undefined if the file is not within the project
 */
export function inferModulePath(
  filePath: string,
  options: ModuleInferenceOptions
): string | undefined {
  const { projectPath, sourceRoots = DEFAULT_SOURCE_ROOTS, includeFileName = false, separator = '/' } = options;

  // Get the relative path from the project root
  const normalizedProjectPath = path.normalize(projectPath);
  const normalizedFilePath = path.normalize(filePath);

  if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
    // File is not within the project
    return undefined;
  }

  let relativePath = path.relative(normalizedProjectPath, normalizedFilePath);

  // Split into parts
  let parts = relativePath.split(path.sep);

  // Remove the file extension from the last part if it's a file
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1]!;
    const ext = path.extname(lastPart);
    if (ext) {
      if (includeFileName) {
        // Keep the file name but remove extension
        parts[parts.length - 1] = path.basename(lastPart, ext);
      } else {
        // Remove the file entirely, use only directory
        parts = parts.slice(0, -1);
      }
    }
  }

  // Strip source root directories from the beginning
  while (parts.length > 0 && sourceRoots.includes(parts[0]!)) {
    parts = parts.slice(1);
  }

  // Handle empty result (file is directly in source root)
  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(separator);
}

/**
 * Get all unique module paths from a list of file paths.
 *
 * @param filePaths - List of absolute file paths
 * @param options - Module inference options
 * @returns Set of unique module paths
 */
export function collectModulePaths(
  filePaths: string[],
  options: ModuleInferenceOptions
): Set<string> {
  const modules = new Set<string>();

  for (const filePath of filePaths) {
    const modulePath = inferModulePath(filePath, options);
    if (modulePath) {
      modules.add(modulePath);

      // Also add parent modules to create the hierarchy
      const parts = modulePath.split(options.separator || '/');
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join(options.separator || '/');
        if (parentPath) {
          modules.add(parentPath);
        }
      }
    }
  }

  return modules;
}

/**
 * Build a module hierarchy from a set of module paths.
 * Returns a map of parent module to child modules.
 *
 * @param modulePaths - Set of module paths
 * @param separator - Separator used in module paths
 * @returns Map of parent module path to array of direct child module paths
 */
export function buildModuleHierarchy(
  modulePaths: Set<string>,
  separator: string = '/'
): Map<string | null, string[]> {
  const hierarchy = new Map<string | null, string[]>();

  for (const modulePath of modulePaths) {
    const parts = modulePath.split(separator);

    if (parts.length === 1) {
      // Top-level module, parent is null (root/project)
      const children = hierarchy.get(null) || [];
      if (!children.includes(modulePath)) {
        children.push(modulePath);
        hierarchy.set(null, children);
      }
    } else {
      // Nested module, find parent
      const parentPath = parts.slice(0, -1).join(separator);
      const children = hierarchy.get(parentPath) || [];
      if (!children.includes(modulePath)) {
        children.push(modulePath);
        hierarchy.set(parentPath, children);
      }
    }
  }

  return hierarchy;
}

/**
 * Get the parent module path for a given module path.
 *
 * @param modulePath - The module path
 * @param separator - Separator used in module paths
 * @returns The parent module path, or null if this is a top-level module
 */
export function getParentModulePath(
  modulePath: string,
  separator: string = '/'
): string | null {
  const parts = modulePath.split(separator);
  if (parts.length <= 1) {
    return null;
  }
  return parts.slice(0, -1).join(separator);
}

/**
 * Get the module name (last segment) from a module path.
 *
 * @param modulePath - The full module path (e.g., 'components/user/profile')
 * @param separator - Separator used in module paths
 * @returns The module name (e.g., 'profile')
 */
export function getModuleName(modulePath: string, separator: string = '/'): string {
  const parts = modulePath.split(separator);
  return parts[parts.length - 1] || modulePath;
}

