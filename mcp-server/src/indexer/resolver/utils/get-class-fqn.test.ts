import { describe, it, expect } from 'vitest';
import { getClassFqn } from './get-class-fqn.js';
import type { ResolutionContext } from '../types.js';
import type { ParsedFile, ParsedClass } from '../../types.js';

function createMockFile(packageName: string): ParsedFile {
  return {
    filePath: '/test/Test.kt',
    language: 'kotlin',
    packageName,
    imports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
  };
}

function createMockClass(name: string): ParsedClass {
  return {
    name,
    kind: 'class',
    visibility: 'public',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    superClass: undefined,
    interfaces: [],
    typeParameters: [],
    functions: [],
    properties: [],
    nestedClasses: [],
    annotations: [],
    isAbstract: false,
    isData: false,
    isSealed: false,
  };
}

function createContext(packageName: string, currentClass?: ParsedClass): ResolutionContext {
  return {
    currentFile: createMockFile(packageName),
    language: 'kotlin',
    imports: new Map(),
    wildcardImports: [],
    localVariables: new Map(),
    currentClass,
  };
}

describe('getClassFqn', () => {
  it('should return empty string when no current class', () => {
    const context = createContext('com.example');
    expect(getClassFqn(context)).toBe('');
  });

  it('should return class FQN with package', () => {
    const context = createContext('com.example', createMockClass('UserService'));
    expect(getClassFqn(context)).toBe('com.example.UserService');
  });

  it('should return class name only when no package', () => {
    const context = createContext('', createMockClass('UserService'));
    expect(getClassFqn(context)).toBe('UserService');
  });

  it('should handle nested package names', () => {
    const context = createContext('com.example.domain.user', createMockClass('UserRepository'));
    expect(getClassFqn(context)).toBe('com.example.domain.user.UserRepository');
  });
});
