/**
 * Kotlin Parser Module
 *
 * Exports the Kotlin language parser for use by the registry.
 * Implementation will be added in Étape 2.
 */

import type { LanguageParser, ParsedFile } from '../../types.js';

// Placeholder implementation - will be replaced in Étape 2
export const kotlinParser: LanguageParser = {
  language: 'kotlin',
  extensions: ['.kt', '.kts'],

  async parse(_source: string, filePath: string): Promise<ParsedFile> {
    // TODO: Implement with tree-sitter-kotlin in Étape 2
    return {
      filePath,
      packageName: undefined,
      imports: [],
      classes: [],
      topLevelFunctions: [],
      topLevelProperties: [],
    };
  },
};
