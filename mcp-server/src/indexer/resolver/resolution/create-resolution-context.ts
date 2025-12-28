import type { ParsedFile } from '../../types.js';
import type { ResolutionContext } from '../types.js';
import { getDefaultWildcardImports } from '../stdlib/stdlib-registry.js';

/**
 * Create a resolution context for a file.
 */
export function createResolutionContext(file: ParsedFile): ResolutionContext {
  const imports = new Map<string, string>();
  const wildcardImports: string[] = [];

  // Process imports
  for (const imp of file.imports) {
    if (imp.isWildcard) {
      // Remove the .* suffix for wildcard imports
      const packagePath = imp.path.replace(/\.\*$/, '');
      wildcardImports.push(packagePath);
    } else {
      // Extract simple name from the import path
      const simpleName = imp.alias || imp.path.split('.').pop()!;
      imports.set(simpleName, imp.path);
    }
  }

  // Add default wildcard imports based on language (from stdlib registry)
  const defaultImports = getDefaultWildcardImports(file.language);
  wildcardImports.push(...defaultImports);

  return {
    currentFile: file,
    language: file.language,
    imports,
    wildcardImports,
    localVariables: new Map(),
  };
}
