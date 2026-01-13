/**
 * Export Index
 *
 * Tracks what each file exports, enabling resolution of imported symbols
 * to their actual definitions.
 */

import type { ParsedFile, ParsedClass } from '../../types.js';

/**
 * Information about a single export from a file.
 */
export interface ExportEntry {
  /** The exported name (may differ from original name if aliased) */
  exportedName: string;
  /** The original name in the source file */
  originalName: string;
  /** FQN of the symbol */
  fqn: string;
  /** Kind of symbol */
  kind: 'class' | 'interface' | 'function' | 'property' | 'typealias' | 'object' | 'enum';
  /** Is this a default export? */
  isDefault: boolean;
  /** Is this a re-export from another module? */
  isReexport: boolean;
  /** Original file path (for re-exports) */
  sourceFilePath?: string;
}

/**
 * Index of exports by file path.
 * Map<filePath, Map<exportedName, ExportEntry>>
 */
export type ExportIndex = Map<string, Map<string, ExportEntry>>;

/**
 * Build an export index from parsed files.
 *
 * This creates a mapping of file paths to their exported symbols,
 * enabling resolution of imports to their actual definitions.
 */
export function buildExportIndex(files: ParsedFile[]): ExportIndex {
  const index: ExportIndex = new Map();

  for (const file of files) {
    const fileExports = new Map<string, ExportEntry>();

    // Process classes/interfaces
    for (const cls of file.classes) {
      addClassExports(fileExports, cls, file);
    }

    // Process top-level functions
    for (const func of file.topLevelFunctions) {
      const fqn = file.packageName ? `${file.packageName}.${func.name}` : func.name;
      fileExports.set(func.name, {
        exportedName: func.name,
        originalName: func.name,
        fqn,
        kind: 'function',
        isDefault: false, // TODO: detect default exports
        isReexport: false,
      });
    }

    // Process top-level properties (including exported constants)
    for (const prop of file.topLevelProperties) {
      const fqn = file.packageName ? `${file.packageName}.${prop.name}` : prop.name;
      fileExports.set(prop.name, {
        exportedName: prop.name,
        originalName: prop.name,
        fqn,
        kind: 'property',
        isDefault: false,
        isReexport: false,
      });
    }

    // Process type aliases
    for (const alias of file.typeAliases) {
      const fqn = file.packageName ? `${file.packageName}.${alias.name}` : alias.name;
      fileExports.set(alias.name, {
        exportedName: alias.name,
        originalName: alias.name,
        fqn,
        kind: 'typealias',
        isDefault: false,
        isReexport: false,
      });
    }

    // Process re-exports
    // Note: Re-exports point to other files, we'll resolve them later
    for (const reexport of file.reexports) {
      // For re-exports, we store them but mark them as re-exports
      // The actual symbol will be resolved during import resolution
      if (reexport.originalName) {
        fileExports.set(reexport.exportedName || reexport.originalName, {
          exportedName: reexport.exportedName || reexport.originalName,
          originalName: reexport.originalName,
          fqn: '', // Will be resolved later
          kind: 'class', // Placeholder, will be determined later
          isDefault: reexport.originalName === 'default',
          isReexport: true,
          sourceFilePath: reexport.sourcePath,
        });
      }
    }

    index.set(file.filePath, fileExports);
  }

  return index;
}

/**
 * Add class/interface exports to the file exports map.
 */
function addClassExports(
  fileExports: Map<string, ExportEntry>,
  cls: ParsedClass,
  file: ParsedFile
): void {
  const fqn = file.packageName ? `${file.packageName}.${cls.name}` : cls.name;

  // Determine kind based on class properties
  let kind: ExportEntry['kind'] = 'class';
  if (cls.kind === 'interface') {
    kind = 'interface';
  } else if (cls.kind === 'object') {
    kind = 'object';
  } else if (cls.kind === 'enum') {
    kind = 'enum';
  }

  fileExports.set(cls.name, {
    exportedName: cls.name,
    originalName: cls.name,
    fqn,
    kind,
    isDefault: false, // TODO: detect default exports
    isReexport: false,
  });

  // Also add nested classes
  for (const nested of cls.nestedClasses) {
    addClassExports(fileExports, nested, file);
  }
}

/**
 * Look up an export by name from a specific file.
 */
export function getExport(
  index: ExportIndex,
  filePath: string,
  exportName: string
): ExportEntry | undefined {
  return index.get(filePath)?.get(exportName);
}

/**
 * Get all exports from a file.
 */
export function getFileExports(index: ExportIndex, filePath: string): ExportEntry[] {
  const fileExports = index.get(filePath);
  return fileExports ? Array.from(fileExports.values()) : [];
}
