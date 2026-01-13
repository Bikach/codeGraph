/**
 * Centralized File Filtering for Code Indexer
 *
 * Determines which files should be parsed and indexed based on configurable
 * exclusion patterns. This prevents indexing of:
 * - Dependencies (node_modules)
 * - Build outputs (dist, build, DerivedData)
 * - Configuration files (*.config.ts, *.config.js)
 * - Generated files (*.d.ts, *.min.js)
 * - Framework-specific build directories (.next, .nuxt, .angular)
 * - Platform-specific build artifacts (ios, android builds)
 */

import * as path from 'path';

// =============================================================================
// Excluded Directory Patterns
// =============================================================================

/**
 * Directories that should never be scanned or parsed.
 * These are matched against path segments (not substrings).
 *
 * Categories:
 * - Package managers: node_modules
 * - Version control: .git
 * - Build outputs: dist, build, out, target
 * - IDE/Editor: .idea, .vscode
 * - Framework caches: .next, .nuxt, .angular, .turbo, .vercel
 * - Mobile platforms: DerivedData, Pods (iOS), .gradle (Android)
 * - Test coverage: coverage
 * - Temporary: .cache, .tmp, .output
 */
export const EXCLUDED_DIRECTORIES = [
  // Package managers
  'node_modules',

  // Version control
  '.git',

  // Common build outputs
  'dist',
  'build',
  'out',
  'target',

  // IDE/Editor configs
  '.idea',
  '.vscode',

  // JavaScript/TypeScript frameworks
  '.next',
  '.nuxt',
  '.angular',
  '.turbo',
  '.vercel',
  '.output',
  '.svelte-kit',
  '.astro',

  // iOS/macOS (Xcode)
  'DerivedData',
  'Pods',
  '.xcbuild',
  'xcuserdata',

  // Android (Gradle)
  '.gradle',
  '.m2',

  // Web build outputs
  'www',
  'public',

  // Test coverage
  'coverage',
  '__coverage__',

  // Cache directories
  '.cache',
  '.tmp',
  '.temp',

  // Generated API clients
  '.tmp',

  // Monorepo tools
  '.nx',
  '.pnpm',

  // Python
  '__pycache__',
  '.venv',
  'venv',
  '.tox',

  // Ruby
  'vendor/bundle',

  // Rust
  'target/debug',
  'target/release',
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
  // ESLint
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.mjs',
  'eslint.config.js',
  'eslint.config.mjs',

  // Prettier
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  '.prettierrc.js',
  '.prettierrc.cjs',

  // Tailwind CSS
  'tailwind.config.js',
  'tailwind.config.ts',

  // PostCSS
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',

  // Next.js
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',

  // Nuxt.js
  'nuxt.config.js',
  'nuxt.config.ts',

  // Vite
  'vite.config.js',
  'vite.config.ts',

  // Vitest
  'vitest.config.js',
  'vitest.config.ts',

  // Jest
  'jest.config.js',
  'jest.config.ts',

  // Webpack
  'webpack.config.js',
  'webpack.config.ts',

  // Rollup
  'rollup.config.js',
  'rollup.config.ts',

  // Babel
  'babel.config.js',
  'babel.config.cjs',
  '.babelrc.js',

  // TypeScript/JavaScript configs
  'tsconfig.json',
  'jsconfig.json',

  // Package managers
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',

  // Capacitor/Cordova
  'capacitor.config.ts',
  'capacitor.config.js',

  // Angular
  'angular.json',
  'karma.conf.js',
  'protractor.conf.js',

  // Metro (React Native)
  'metro.config.js',
  'metro.config.ts',

  // Expo
  'app.config.js',
  'app.config.ts',
  'eas.json',

  // Gradle
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'gradle.properties',

  // Xcode
  'Podfile',
  'Podfile.lock',
] as const;

/**
 * Generated/minified file patterns (matched against basename).
 */
const GENERATED_FILE_PATTERNS = [
  /\.d\.ts$/, // TypeScript declaration files
  /\.d\.mts$/, // ES module TypeScript declaration files
  /\.d\.cts$/, // CommonJS TypeScript declaration files
  /\.min\.js$/, // Minified JavaScript
  /\.min\.css$/, // Minified CSS
  /\.bundle\.js$/, // Bundled JavaScript
  /\.chunk\.js$/, // Code-split chunks
  /\.generated\.(ts|js)$/, // Explicitly generated files
  /\.g\.dart$/, // Generated Dart files
  /-lock\.json$/, // Lock files
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

  /**
   * Include config files (default: false)
   */
  includeConfigFiles?: boolean;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Determines if a directory should be scanned during file discovery.
 * This is used by the indexer to skip entire directory trees.
 *
 * @param dirName - The directory name (not full path)
 * @param options - Optional filtering configuration
 * @param fullPath - Optional full path for checking path-based exclusions
 * @returns true if the directory should be scanned, false otherwise
 *
 * @example
 * ```ts
 * shouldScanDirectory('node_modules') // false
 * shouldScanDirectory('src') // true
 * shouldScanDirectory('DerivedData') // false
 * shouldScanDirectory('.angular') // false
 * shouldScanDirectory('public', {}, '/project/ios/App/App/public') // false (in ios path)
 * ```
 */
export function shouldScanDirectory(
  dirName: string,
  options: FileFilterOptions = {},
  fullPath?: string
): boolean {
  const allExcludedDirs = options.additionalExcludedDirs
    ? [...EXCLUDED_DIRECTORIES, ...options.additionalExcludedDirs]
    : EXCLUDED_DIRECTORIES;

  // Check by directory name
  if (allExcludedDirs.includes(dirName as (typeof EXCLUDED_DIRECTORIES)[number])) {
    return false;
  }

  // Check by full path if provided (for nested build directories)
  if (fullPath) {
    const normalizedPath = fullPath.replace(/\\/g, '/');
    // Exclude any 'public' directory inside ios/ or android/ (Capacitor builds)
    if (
      (normalizedPath.includes('/ios/') || normalizedPath.includes('/android/')) &&
      dirName === 'public'
    ) {
      return false;
    }
    // Exclude .angular/cache
    if (normalizedPath.includes('/.angular/')) {
      return false;
    }
  }

  return true;
}

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
 * shouldParseFile('/project/ios/DerivedData/Build/main.js') // false
 * ```
 */
export function shouldParseFile(filePath: string, options: FileFilterOptions = {}): boolean {
  const normalizedPath = normalizePath(filePath);
  const basename = path.basename(normalizedPath);

  // Check excluded directories in path
  if (isInExcludedDirectory(normalizedPath, options.additionalExcludedDirs)) {
    return false;
  }

  // Check excluded config files by exact name
  if (!options.includeConfigFiles && isExcludedConfigFile(basename)) {
    return false;
  }

  // Check config/setup file pattern
  if (!options.includeConfigFiles && CONFIG_FILE_PATTERN.test(basename)) {
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

/**
 * Checks if a file is a test file.
 *
 * @param filePath - File path to check
 * @returns true if the file is a test file
 */
export function isTestFile(filePath: string): boolean {
  const normalizedPath = normalizePath(filePath);
  return TEST_PATTERNS.some((pattern) => pattern.test(normalizedPath));
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
    if (includeDeclarationFiles && pattern.source.includes('\\.d\\.')) {
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
  // File suffixes
  /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.spec\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.tests\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.specs\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /Test\.(kt|java)$/,
  /Tests\.(kt|java)$/,
  /Spec\.(kt|java)$/,

  // Test directories
  /\/__tests__\//,
  /\/test\//,
  /\/tests\//,
  /\/spec\//,
  /\/specs\//,

  // Android test directories
  /\/androidTest\//,
  /\/androidTestDebug\//,

  // iOS test directories
  /\/xctest\//,
  /Tests\.swift$/,
];
