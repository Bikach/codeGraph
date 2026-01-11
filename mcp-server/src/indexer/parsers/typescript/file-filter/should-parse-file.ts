/**
 * File Filtering for TypeScript/JavaScript Parser
 *
 * Determines which files should be parsed and indexed based on configurable
 * exclusion patterns. This prevents indexing of:
 * - Dependencies (node_modules)
 * - Build outputs (dist, build)
 * - Configuration files (*.config.ts, *.config.js)
 * - Generated files (*.d.ts, *.min.js)
 * - Framework-specific build directories (.next, .nuxt)
 */

import * as path from 'path';

// =============================================================================
// Excluded Directory Patterns
// =============================================================================

/**
 * Directories that should never be parsed.
 * These are matched against path segments (not substrings).
 */
export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.git',
  'out',
  '.cache',
  '.turbo',
  '.vercel',
  '.output',
] as const;

// =============================================================================
// Excluded File Patterns
// =============================================================================

/**
 * Configuration file patterns (matched against basename).
 * Matches files like: webpack.config.js, vite.config.ts, jest.setup.ts
 */
const CONFIG_FILE_PATTERN = /\.(config|setup)\.(ts|js|mjs|cjs)$/;

/**
 * Specific configuration files by exact name (matched against basename).
 */
export const EXCLUDED_CONFIG_FILES = [
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.mjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  '.prettierrc.js',
  '.prettierrc.cjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'nuxt.config.js',
  'nuxt.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'vitest.config.js',
  'vitest.config.ts',
  'jest.config.js',
  'jest.config.ts',
  'webpack.config.js',
  'webpack.config.ts',
  'rollup.config.js',
  'rollup.config.ts',
  'babel.config.js',
  'babel.config.cjs',
  '.babelrc.js',
  'tsconfig.json',
  'jsconfig.json',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
] as const;

/**
 * Generated/minified file patterns (matched against basename).
 */
const GENERATED_FILE_PATTERNS = [
  /\.d\.ts$/, // TypeScript declaration files
  /\.min\.js$/, // Minified JavaScript
  /\.bundle\.js$/, // Bundled JavaScript
  /\.chunk\.js$/, // Code-split chunks
  /\.generated\.(ts|js)$/, // Explicitly generated files
] as const;

// =============================================================================
// Options
// =============================================================================

export interface FileFilterOptions {
  /**
   * Include .d.ts declaration files (default: false)
   */
  includeDeclarationFiles?: boolean;

  /**
   * Include test files (default: true)
   * When false, excludes files matching test patterns
   */
  includeTestFiles?: boolean;

  /**
   * Additional directories to exclude
   */
  additionalExcludedDirs?: string[];

  /**
   * Additional file patterns to exclude (regex patterns)
   */
  additionalExcludedPatterns?: RegExp[];
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Determines if a file should be parsed based on its path.
 *
 * @param filePath - Absolute or relative file path
 * @param options - Optional filtering configuration
 * @returns true if the file should be parsed, false otherwise
 *
 * @example
 * ```ts
 * shouldParseFile('/project/src/index.ts') // true
 * shouldParseFile('/project/node_modules/lodash/index.js') // false
 * shouldParseFile('/project/webpack.config.js') // false
 * shouldParseFile('/project/dist/bundle.js') // false
 * ```
 */
export function shouldParseFile(filePath: string, options: FileFilterOptions = {}): boolean {
  const normalizedPath = normalizePath(filePath);
  const basename = path.basename(normalizedPath);

  // Check excluded directories
  if (isInExcludedDirectory(normalizedPath, options.additionalExcludedDirs)) {
    return false;
  }

  // Check excluded config files by exact name
  if (isExcludedConfigFile(basename)) {
    return false;
  }

  // Check config/setup file pattern
  if (CONFIG_FILE_PATTERN.test(basename)) {
    return false;
  }

  // Check generated/minified file patterns
  if (isGeneratedFile(basename, options.includeDeclarationFiles)) {
    return false;
  }

  // Check additional excluded patterns
  if (options.additionalExcludedPatterns?.some((pattern) => pattern.test(normalizedPath))) {
    return false;
  }

  // Check test files if configured to exclude
  if (options.includeTestFiles === false && isTestFile(normalizedPath)) {
    return false;
  }

  return true;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalizes path separators to forward slashes for consistent matching.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Checks if the file is in an excluded directory.
 */
function isInExcludedDirectory(normalizedPath: string, additionalDirs?: string[]): boolean {
  const allExcludedDirs = additionalDirs
    ? [...EXCLUDED_DIRECTORIES, ...additionalDirs]
    : EXCLUDED_DIRECTORIES;

  for (const dir of allExcludedDirs) {
    // Match directory as a path segment: /dir/ or starts with dir/
    if (normalizedPath.includes(`/${dir}/`) || normalizedPath.startsWith(`${dir}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the file is an excluded config file by exact name.
 */
function isExcludedConfigFile(basename: string): boolean {
  return (EXCLUDED_CONFIG_FILES as readonly string[]).includes(basename);
}

/**
 * Checks if the file matches generated file patterns.
 */
function isGeneratedFile(basename: string, includeDeclarationFiles?: boolean): boolean {
  for (const pattern of GENERATED_FILE_PATTERNS) {
    // Skip .d.ts check if declaration files are included
    if (includeDeclarationFiles && pattern.source === '\\.d\\.ts$') {
      continue;
    }
    if (pattern.test(basename)) {
      return true;
    }
  }
  return false;
}

/**
 * Test file patterns for optional exclusion.
 */
const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.spec\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\/__tests__\//,
  /\/test\//,
  /\/tests\//,
];

/**
 * Checks if the file is a test file.
 */
function isTestFile(normalizedPath: string): boolean {
  return TEST_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}
