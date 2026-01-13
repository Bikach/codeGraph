/**
 * File Filtering Module
 *
 * Centralized file filtering for the code indexer.
 * Determines which files and directories should be parsed and indexed.
 *
 * This module is language-agnostic and used by all parsers and the indexer script.
 */

export {
  shouldParseFile,
  shouldScanDirectory,
  isTestFile,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_CONFIG_FILES,
  type FileFilterOptions,
} from './should-parse-file.js';
