/**
 * Detect Primary Language Tests
 */

import { describe, it, expect } from 'vitest';
import { detectPrimaryLanguage } from './detect-primary-language.js';
import type { ResolvedFile } from '../../types.js';

function createMockFile(language: 'kotlin' | 'java' | 'typescript' | 'javascript'): ResolvedFile {
  return {
    filePath: `/src/File.${language === 'kotlin' ? 'kt' : language === 'java' ? 'java' : 'ts'}`,
    language,
    packageName: 'com.example',
    imports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    resolvedCalls: [],
  };
}

describe('detectPrimaryLanguage', () => {
  it('should return kotlin as default for empty files', () => {
    expect(detectPrimaryLanguage([])).toBe('kotlin');
  });

  it('should detect kotlin as primary language', () => {
    const files: ResolvedFile[] = [
      createMockFile('kotlin'),
      createMockFile('kotlin'),
      createMockFile('java'),
    ];

    expect(detectPrimaryLanguage(files)).toBe('kotlin');
  });

  it('should detect typescript as primary language', () => {
    const files: ResolvedFile[] = [
      createMockFile('typescript'),
      createMockFile('typescript'),
      createMockFile('javascript'),
    ];

    expect(detectPrimaryLanguage(files)).toBe('typescript');
  });

  it('should handle single file', () => {
    expect(detectPrimaryLanguage([createMockFile('java')])).toBe('java');
  });
});
