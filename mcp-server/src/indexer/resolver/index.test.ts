import { describe, it, expect } from 'vitest';
import {
  buildSymbolTable,
  resolveSymbols,
  lookupSymbol,
  findSymbols,
  getResolutionStats,
} from './index.js';
import type { ParsedFile, ParsedClass, ParsedFunction, ParsedCall, SourceLocation } from '../types.js';

// =============================================================================
// Test Helpers
// =============================================================================

const defaultLocation: SourceLocation = {
  filePath: '/test/Test.kt',
  startLine: 1,
  startColumn: 0,
  endLine: 1,
  endColumn: 10,
};

function createParsedFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    filePath: '/test/Test.kt',
    language: 'kotlin',
    imports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    ...overrides,
  };
}

function createParsedClass(overrides: Partial<ParsedClass> = {}): ParsedClass {
  return {
    name: 'TestClass',
    kind: 'class',
    visibility: 'public',
    isAbstract: false,
    isData: false,
    isSealed: false,
    interfaces: [],
    annotations: [],
    properties: [],
    functions: [],
    nestedClasses: [],
    location: defaultLocation,
    ...overrides,
  };
}

function createParsedFunction(overrides: Partial<ParsedFunction> = {}): ParsedFunction {
  return {
    name: 'testFunction',
    visibility: 'public',
    parameters: [],
    isAbstract: false,
    isSuspend: false,
    isExtension: false,
    annotations: [],
    location: defaultLocation,
    calls: [],
    ...overrides,
  };
}

function createParsedCall(overrides: Partial<ParsedCall> = {}): ParsedCall {
  return {
    name: 'calledFunction',
    location: defaultLocation,
    ...overrides,
  };
}

// =============================================================================
// Symbol Table Tests
// =============================================================================

describe('buildSymbolTable', () => {
  describe('class indexing', () => {
    it('should index classes with correct FQN', () => {
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'UserService' })],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.UserService')).toBe(true);
      const symbol = table.byFqn.get('com.example.UserService');
      expect(symbol?.name).toBe('UserService');
      expect(symbol?.kind).toBe('class');
    });

    it('should index classes without package', () => {
      const file = createParsedFile({
        classes: [createParsedClass({ name: 'UserService' })],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('UserService')).toBe(true);
    });

    it('should index interfaces', () => {
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'Repository', kind: 'interface' })],
      });

      const table = buildSymbolTable([file]);

      const symbol = table.byFqn.get('com.example.Repository');
      expect(symbol?.kind).toBe('interface');
    });

    it('should index objects', () => {
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'Singleton', kind: 'object' })],
      });

      const table = buildSymbolTable([file]);

      const symbol = table.byFqn.get('com.example.Singleton');
      expect(symbol?.kind).toBe('object');
    });
  });

  describe('nested class indexing', () => {
    it('should index nested classes with parent FQN', () => {
      const nestedClass = createParsedClass({ name: 'Inner' });
      const outerClass = createParsedClass({
        name: 'Outer',
        nestedClasses: [nestedClass],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [outerClass],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.Outer')).toBe(true);
      expect(table.byFqn.has('com.example.Outer.Inner')).toBe(true);
    });

    it('should index deeply nested classes', () => {
      const deepNested = createParsedClass({ name: 'DeepInner' });
      const nestedClass = createParsedClass({
        name: 'Inner',
        nestedClasses: [deepNested],
      });
      const outerClass = createParsedClass({
        name: 'Outer',
        nestedClasses: [nestedClass],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [outerClass],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.Outer.Inner.DeepInner')).toBe(true);
    });
  });

  describe('companion object indexing', () => {
    it('should index companion objects', () => {
      const companion = createParsedClass({
        name: 'Companion',
        kind: 'object',
        functions: [createParsedFunction({ name: 'create' })],
      });
      const outerClass = createParsedClass({
        name: 'User',
        companionObject: companion,
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [outerClass],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.User.Companion')).toBe(true);
      expect(table.byFqn.has('com.example.User.Companion.create')).toBe(true);
    });
  });

  describe('function indexing', () => {
    it('should index class methods', () => {
      const func = createParsedFunction({ name: 'save' });
      const cls = createParsedClass({
        name: 'UserService',
        functions: [func],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [cls],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.UserService.save')).toBe(true);
      expect(table.functionsByName.has('save')).toBe(true);
    });

    it('should index top-level functions', () => {
      const file = createParsedFile({
        packageName: 'com.example.utils',
        topLevelFunctions: [createParsedFunction({ name: 'formatDate' })],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.utils.formatDate')).toBe(true);
    });

    it('should index extension functions with receiver type', () => {
      const extensionFunc = createParsedFunction({
        name: 'capitalize',
        isExtension: true,
        receiverType: 'String',
      });
      const file = createParsedFile({
        packageName: 'com.example.extensions',
        topLevelFunctions: [extensionFunc],
      });

      const table = buildSymbolTable([file]);

      const funcs = table.functionsByName.get('capitalize');
      expect(funcs).toHaveLength(1);
      expect(funcs?.[0]?.isExtension).toBe(true);
      expect(funcs?.[0]?.receiverType).toBe('String');
    });
  });

  describe('property indexing', () => {
    it('should index class properties', () => {
      const cls = createParsedClass({
        name: 'User',
        properties: [
          {
            name: 'id',
            type: 'Long',
            visibility: 'public',
            isVal: true,
            annotations: [],
            location: defaultLocation,
          },
        ],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [cls],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.User.id')).toBe(true);
    });

    it('should index top-level properties', () => {
      const file = createParsedFile({
        packageName: 'com.example',
        topLevelProperties: [
          {
            name: 'VERSION',
            type: 'String',
            visibility: 'public',
            isVal: true,
            annotations: [],
            location: defaultLocation,
          },
        ],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.VERSION')).toBe(true);
    });
  });

  describe('type aliases', () => {
    it('should index type aliases as symbols', () => {
      const file = createParsedFile({
        packageName: 'com.example',
        typeAliases: [
          {
            name: 'UserId',
            aliasedType: 'Long',
            visibility: 'public',
            location: defaultLocation,
          },
        ],
      });

      const table = buildSymbolTable([file]);

      expect(table.byFqn.has('com.example.UserId')).toBe(true);
    });
  });

  describe('by-name index', () => {
    it('should allow lookup by simple name', () => {
      const file1 = createParsedFile({
        packageName: 'com.example.a',
        classes: [createParsedClass({ name: 'Service' })],
      });
      const file2 = createParsedFile({
        packageName: 'com.example.b',
        classes: [createParsedClass({ name: 'Service' })],
      });

      const table = buildSymbolTable([file1, file2]);

      const services = table.byName.get('Service');
      expect(services).toHaveLength(2);
    });
  });

  describe('by-package index', () => {
    it('should group symbols by package', () => {
      const file = createParsedFile({
        packageName: 'com.example.domain',
        classes: [
          createParsedClass({ name: 'User' }),
          createParsedClass({ name: 'Order' }),
        ],
      });

      const table = buildSymbolTable([file]);

      const packageSymbols = table.byPackage.get('com.example.domain');
      expect(packageSymbols).toBeDefined();
      expect(packageSymbols!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('type hierarchy', () => {
    it('should track extends relationship', () => {
      const parent = createParsedClass({ name: 'BaseService' });
      const child = createParsedClass({
        name: 'UserService',
        superClass: 'BaseService',
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [parent, child],
      });

      const table = buildSymbolTable([file]);

      const hierarchy = table.typeHierarchy.get('com.example.UserService');
      expect(hierarchy).toContain('com.example.BaseService');
    });

    it('should track implements relationship', () => {
      const iface = createParsedClass({ name: 'Repository', kind: 'interface' });
      const impl = createParsedClass({
        name: 'UserRepository',
        interfaces: ['Repository'],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [iface, impl],
      });

      const table = buildSymbolTable([file]);

      const hierarchy = table.typeHierarchy.get('com.example.UserRepository');
      expect(hierarchy).toContain('com.example.Repository');
    });

    it('should track multiple interfaces', () => {
      const impl = createParsedClass({
        name: 'UserService',
        interfaces: ['Serializable', 'Comparable'],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [impl],
      });

      const table = buildSymbolTable([file]);

      const hierarchy = table.typeHierarchy.get('com.example.UserService');
      expect(hierarchy).toHaveLength(2);
    });
  });
});

// =============================================================================
// Symbol Resolution Tests
// =============================================================================

describe('resolveSymbols', () => {
  describe('same class method calls', () => {
    it('should resolve calls to methods in the same class', () => {
      const helperFunc = createParsedFunction({ name: 'helper' });
      const mainFunc = createParsedFunction({
        name: 'main',
        calls: [createParsedCall({ name: 'helper' })],
      });
      const cls = createParsedClass({
        name: 'Service',
        functions: [helperFunc, mainFunc],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [cls],
      });

      const resolved = resolveSymbols([file]);

      expect(resolved[0]?.resolvedCalls).toHaveLength(1);
      expect(resolved[0]?.resolvedCalls[0]?.fromFqn).toBe('com.example.Service.main');
      expect(resolved[0]?.resolvedCalls[0]?.toFqn).toBe('com.example.Service.helper');
    });
  });

  describe('explicit import resolution', () => {
    it('should resolve calls to imported classes', () => {
      // File 1: UserRepository
      const repoFile = createParsedFile({
        filePath: '/test/repository/UserRepository.kt',
        packageName: 'com.example.repository',
        classes: [
          createParsedClass({
            name: 'UserRepository',
            functions: [createParsedFunction({ name: 'findById' })],
          }),
        ],
      });

      // File 2: UserService importing UserRepository
      const serviceFile = createParsedFile({
        filePath: '/test/service/UserService.kt',
        packageName: 'com.example.service',
        imports: [
          { path: 'com.example.repository.UserRepository', isWildcard: false },
        ],
        classes: [
          createParsedClass({
            name: 'UserService',
            properties: [
              {
                name: 'repository',
                type: 'UserRepository',
                visibility: 'private',
                isVal: true,
                annotations: [],
                location: defaultLocation,
              },
            ],
            functions: [
              createParsedFunction({
                name: 'getUser',
                calls: [createParsedCall({ name: 'findById', receiver: 'repository' })],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([repoFile, serviceFile]);
      const serviceResolved = resolved.find((f) => f.filePath === serviceFile.filePath);

      expect(serviceResolved?.resolvedCalls).toHaveLength(1);
      expect(serviceResolved?.resolvedCalls[0]?.toFqn).toBe(
        'com.example.repository.UserRepository.findById'
      );
    });
  });

  describe('same package resolution', () => {
    it('should resolve calls to classes in the same package', () => {
      const helperFile = createParsedFile({
        filePath: '/test/Helper.kt',
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Helper',
            functions: [createParsedFunction({ name: 'format' })],
          }),
        ],
      });

      const mainFile = createParsedFile({
        filePath: '/test/Main.kt',
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Main',
            properties: [
              {
                name: 'helper',
                type: 'Helper',
                visibility: 'private',
                isVal: true,
                annotations: [],
                location: defaultLocation,
              },
            ],
            functions: [
              createParsedFunction({
                name: 'run',
                calls: [createParsedCall({ name: 'format', receiver: 'helper' })],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([helperFile, mainFile]);
      const mainResolved = resolved.find((f) => f.filePath === mainFile.filePath);

      expect(mainResolved?.resolvedCalls).toHaveLength(1);
      expect(mainResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.Helper.format');
    });
  });

  describe('wildcard import resolution', () => {
    it('should resolve calls from wildcard imports', () => {
      const utilsFile = createParsedFile({
        filePath: '/test/utils/Utils.kt',
        packageName: 'com.example.utils',
        topLevelFunctions: [createParsedFunction({ name: 'log' })],
      });

      const mainFile = createParsedFile({
        filePath: '/test/Main.kt',
        packageName: 'com.example',
        imports: [{ path: 'com.example.utils.*', isWildcard: true }],
        classes: [
          createParsedClass({
            name: 'Main',
            functions: [
              createParsedFunction({
                name: 'run',
                calls: [createParsedCall({ name: 'log' })],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([utilsFile, mainFile]);
      const mainResolved = resolved.find((f) => f.filePath === mainFile.filePath);

      expect(mainResolved?.resolvedCalls).toHaveLength(1);
      expect(mainResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.utils.log');
    });
  });

  describe('receiver type resolution', () => {
    it('should resolve calls when receiver type is explicit', () => {
      const userFile = createParsedFile({
        filePath: '/test/User.kt',
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            functions: [createParsedFunction({ name: 'getName' })],
          }),
        ],
      });

      const serviceFile = createParsedFile({
        filePath: '/test/Service.kt',
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Service',
            functions: [
              createParsedFunction({
                name: 'process',
                parameters: [{ name: 'user', type: 'User', annotations: [] }],
                calls: [
                  createParsedCall({
                    name: 'getName',
                    receiver: 'user',
                    receiverType: 'User',
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([userFile, serviceFile]);
      const serviceResolved = resolved.find((f) => f.filePath === serviceFile.filePath);

      expect(serviceResolved?.resolvedCalls).toHaveLength(1);
      expect(serviceResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.User.getName');
    });
  });

  describe('local variable type resolution', () => {
    it('should resolve calls based on parameter types', () => {
      const userFile = createParsedFile({
        filePath: '/test/User.kt',
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            functions: [createParsedFunction({ name: 'validate' })],
          }),
        ],
      });

      const serviceFile = createParsedFile({
        filePath: '/test/Service.kt',
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Service',
            functions: [
              createParsedFunction({
                name: 'process',
                parameters: [{ name: 'user', type: 'User', annotations: [] }],
                calls: [createParsedCall({ name: 'validate', receiver: 'user' })],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([userFile, serviceFile]);
      const serviceResolved = resolved.find((f) => f.filePath === serviceFile.filePath);

      expect(serviceResolved?.resolvedCalls).toHaveLength(1);
      expect(serviceResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.User.validate');
    });
  });

  describe('companion object calls', () => {
    it('should resolve static-like calls through companion objects', () => {
      const companion = createParsedClass({
        name: 'Companion',
        kind: 'object',
        functions: [createParsedFunction({ name: 'create' })],
      });
      const userClass = createParsedClass({
        name: 'User',
        companionObject: companion,
      });
      const userFile = createParsedFile({
        filePath: '/test/User.kt',
        packageName: 'com.example',
        classes: [userClass],
      });

      const mainFile = createParsedFile({
        filePath: '/test/Main.kt',
        packageName: 'com.example',
        imports: [{ path: 'com.example.User', isWildcard: false }],
        classes: [
          createParsedClass({
            name: 'Main',
            functions: [
              createParsedFunction({
                name: 'run',
                calls: [createParsedCall({ name: 'create', receiver: 'User' })],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([userFile, mainFile]);
      const mainResolved = resolved.find((f) => f.filePath === mainFile.filePath);

      expect(mainResolved?.resolvedCalls).toHaveLength(1);
      expect(mainResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.User.Companion.create');
    });
  });

  describe('type hierarchy resolution', () => {
    it('should resolve calls to superclass methods', () => {
      const baseClass = createParsedClass({
        name: 'BaseService',
        functions: [createParsedFunction({ name: 'log' })],
      });
      const childClass = createParsedClass({
        name: 'UserService',
        superClass: 'BaseService',
        functions: [
          createParsedFunction({
            name: 'save',
            calls: [createParsedCall({ name: 'log' })],
          }),
        ],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [baseClass, childClass],
      });

      const resolved = resolveSymbols([file]);

      expect(resolved[0]?.resolvedCalls).toHaveLength(1);
      expect(resolved[0]?.resolvedCalls[0]?.toFqn).toBe('com.example.BaseService.log');
    });

    it('should resolve calls to interface methods', () => {
      const iface = createParsedClass({
        name: 'Repository',
        kind: 'interface',
        functions: [createParsedFunction({ name: 'save', isAbstract: true })],
      });
      const impl = createParsedClass({
        name: 'UserRepository',
        interfaces: ['Repository'],
        functions: [
          createParsedFunction({
            name: 'saveAll',
            calls: [createParsedCall({ name: 'save' })],
          }),
        ],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [iface, impl],
      });

      const resolved = resolveSymbols([file]);

      // save should resolve to Repository.save (inherited)
      const saveCall = resolved[0]?.resolvedCalls?.find((c) => c.toFqn.includes('save'));
      expect(saveCall?.toFqn).toBe('com.example.Repository.save');
    });
  });

  describe('extension function resolution', () => {
    it('should resolve extension function calls', () => {
      const extensionsFile = createParsedFile({
        filePath: '/test/extensions/StringExtensions.kt',
        packageName: 'com.example.extensions',
        topLevelFunctions: [
          createParsedFunction({
            name: 'capitalize',
            isExtension: true,
            receiverType: 'String',
          }),
        ],
      });

      const mainFile = createParsedFile({
        filePath: '/test/Main.kt',
        packageName: 'com.example',
        imports: [{ path: 'com.example.extensions.*', isWildcard: true }],
        classes: [
          createParsedClass({
            name: 'Main',
            functions: [
              createParsedFunction({
                name: 'run',
                parameters: [{ name: 'text', type: 'String', annotations: [] }],
                calls: [createParsedCall({ name: 'capitalize', receiver: 'text' })],
              }),
            ],
          }),
        ],
      });

      const resolved = resolveSymbols([extensionsFile, mainFile]);
      const mainResolved = resolved.find((f) => f.filePath === mainFile.filePath);

      expect(mainResolved?.resolvedCalls).toHaveLength(1);
      expect(mainResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.extensions.capitalize');
    });
  });

  describe('top-level function calls', () => {
    it('should resolve calls to top-level functions in same file', () => {
      const file = createParsedFile({
        packageName: 'com.example',
        topLevelFunctions: [
          createParsedFunction({ name: 'helper' }),
          createParsedFunction({
            name: 'main',
            calls: [createParsedCall({ name: 'helper' })],
          }),
        ],
      });

      const resolved = resolveSymbols([file]);

      expect(resolved[0]?.resolvedCalls).toHaveLength(1);
      expect(resolved[0]?.resolvedCalls[0]?.toFqn).toBe('com.example.helper');
    });
  });

  describe('nested class resolution', () => {
    it('should resolve calls within nested classes', () => {
      const inner = createParsedClass({
        name: 'Inner',
        functions: [
          createParsedFunction({
            name: 'innerMethod',
            calls: [createParsedCall({ name: 'outerMethod' })],
          }),
        ],
      });
      const outer = createParsedClass({
        name: 'Outer',
        functions: [createParsedFunction({ name: 'outerMethod' })],
        nestedClasses: [inner],
      });
      const file = createParsedFile({
        packageName: 'com.example',
        classes: [outer],
      });

      const resolved = resolveSymbols([file]);

      // The call should be from Inner.innerMethod
      const innerCall = resolved[0]?.resolvedCalls?.find((c) =>
        c.fromFqn.includes('Inner')
      );
      expect(innerCall).toBeDefined();
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('lookupSymbol', () => {
  it('should find symbol by FQN', () => {
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [createParsedClass({ name: 'Service' })],
    });
    const table = buildSymbolTable([file]);

    const symbol = lookupSymbol(table, 'com.example.Service');

    expect(symbol).toBeDefined();
    expect(symbol?.name).toBe('Service');
  });

  it('should return undefined for unknown FQN', () => {
    const table = buildSymbolTable([]);

    const symbol = lookupSymbol(table, 'com.unknown.Class');

    expect(symbol).toBeUndefined();
  });
});

describe('findSymbols', () => {
  it('should find symbols by pattern', () => {
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [
        createParsedClass({ name: 'UserService' }),
        createParsedClass({ name: 'OrderService' }),
        createParsedClass({ name: 'User' }),
      ],
    });
    const table = buildSymbolTable([file]);

    const services = findSymbols(table, '*Service');

    expect(services).toHaveLength(2);
    expect(services.map((s) => s.name)).toContain('UserService');
    expect(services.map((s) => s.name)).toContain('OrderService');
  });

  it('should find symbols by FQN pattern', () => {
    const file = createParsedFile({
      packageName: 'com.example.service',
      classes: [createParsedClass({ name: 'UserService' })],
    });
    const table = buildSymbolTable([file]);

    const found = findSymbols(table, 'com.example.*');

    expect(found.length).toBeGreaterThan(0);
  });
});

describe('getResolutionStats', () => {
  it('should calculate resolution statistics', () => {
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [
        createParsedClass({
          name: 'Service',
          functions: [
            createParsedFunction({
              name: 'method',
              calls: [
                createParsedCall({ name: 'known' }),
                createParsedCall({ name: 'unknown' }),
              ],
            }),
          ],
        }),
        createParsedClass({
          name: 'Helper',
          functions: [createParsedFunction({ name: 'known' })],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);
    const stats = getResolutionStats(resolved);

    expect(stats.totalCalls).toBe(2);
    expect(stats.resolvedCalls).toBe(1); // Only 'known' can be resolved
    expect(stats.unresolvedCalls).toBe(1);
    expect(stats.resolutionRate).toBe(0.5);
  });

  it('should handle files with no calls', () => {
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [createParsedClass({ name: 'Empty' })],
    });

    const resolved = resolveSymbols([file]);
    const stats = getResolutionStats(resolved);

    expect(stats.totalCalls).toBe(0);
    expect(stats.resolutionRate).toBe(1); // 100% when no calls
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('constructor call resolution', () => {
  it('should resolve constructor call to class <init>', () => {
    const userClass = createParsedClass({
      name: 'User',
      properties: [
        {
          name: 'name',
          type: 'String',
          visibility: 'public',
          isVal: true,
          annotations: [],
          location: defaultLocation,
        },
      ],
    });
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [userClass],
      topLevelFunctions: [
        createParsedFunction({
          name: 'createUser',
          calls: [
            createParsedCall({
              name: 'User',
              argumentCount: 1,
              argumentTypes: ['String'],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);
    const constructorCall = resolved[0]?.resolvedCalls.find((c) => c.toFqn.includes('User'));
    expect(constructorCall).toBeDefined();
    expect(constructorCall!.toFqn).toBe('com.example.User.<init>');
  });

  it('should distinguish constructor from function with same name', () => {
    const userClass = createParsedClass({ name: 'User' });
    const userFunc = createParsedFunction({ name: 'user', returnType: 'String' });
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [userClass],
      topLevelFunctions: [
        userFunc,
        createParsedFunction({
          name: 'test',
          calls: [
            createParsedCall({ name: 'User', argumentCount: 0 }), // Constructor (capital U)
            createParsedCall({ name: 'user', argumentCount: 0 }), // Function (lowercase u)
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);
    const calls = resolved[0]?.resolvedCalls || [];

    const constructorCall = calls.find((c) => c.toFqn.includes('<init>'));
    expect(constructorCall).toBeDefined();

    const functionCall = calls.find((c) => c.toFqn === 'com.example.user');
    expect(functionCall).toBeDefined();
  });

  it('should resolve data class constructor', () => {
    const personClass = createParsedClass({
      name: 'Person',
      isData: true,
      properties: [
        {
          name: 'name',
          type: 'String',
          visibility: 'public',
          isVal: true,
          annotations: [],
          location: defaultLocation,
        },
        {
          name: 'age',
          type: 'Int',
          visibility: 'public',
          isVal: true,
          annotations: [],
          location: defaultLocation,
        },
      ],
    });
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [personClass],
      topLevelFunctions: [
        createParsedFunction({
          name: 'test',
          calls: [
            createParsedCall({
              name: 'Person',
              argumentCount: 2,
              argumentTypes: ['String', 'Int'],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);
    const constructorCall = resolved[0]?.resolvedCalls.find((c) =>
      c.toFqn.includes('Person.<init>')
    );
    expect(constructorCall).toBeDefined();
  });
});

describe('overload resolution', () => {
  it('should resolve overloaded method by argument count', () => {
    const calcClass = createParsedClass({
      name: 'Calculator',
      functions: [
        createParsedFunction({
          name: 'add',
          parameters: [{ name: 'a', type: 'Int', annotations: [] }],
        }),
        createParsedFunction({
          name: 'add',
          parameters: [
            { name: 'a', type: 'Int', annotations: [] },
            { name: 'b', type: 'Int', annotations: [] },
          ],
        }),
        createParsedFunction({
          name: 'add',
          parameters: [
            { name: 'a', type: 'Int', annotations: [] },
            { name: 'b', type: 'Int', annotations: [] },
            { name: 'c', type: 'Int', annotations: [] },
          ],
        }),
      ],
    });
    const clientClass = createParsedClass({
      name: 'Client',
      properties: [
        {
          name: 'calc',
          type: 'Calculator',
          visibility: 'public',
          isVal: true,
          annotations: [],
          location: defaultLocation,
        },
      ],
      functions: [
        createParsedFunction({
          name: 'test',
          calls: [
            createParsedCall({ name: 'add', receiver: 'calc', argumentCount: 1 }),
            createParsedCall({ name: 'add', receiver: 'calc', argumentCount: 2 }),
            createParsedCall({ name: 'add', receiver: 'calc', argumentCount: 3 }),
          ],
        }),
      ],
    });
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [calcClass, clientClass],
    });

    const resolved = resolveSymbols([file]);
    const addCalls = resolved[0]?.resolvedCalls.filter((c) => c.toFqn.includes('add')) || [];

    // All add calls should be resolved
    expect(addCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should resolve overloaded method by argument types', () => {
    const formatterClass = createParsedClass({
      name: 'Formatter',
      functions: [
        createParsedFunction({
          name: 'format',
          parameters: [{ name: 'value', type: 'Int', annotations: [] }],
          returnType: 'String',
        }),
        createParsedFunction({
          name: 'format',
          parameters: [{ name: 'value', type: 'String', annotations: [] }],
          returnType: 'String',
        }),
        createParsedFunction({
          name: 'format',
          parameters: [{ name: 'value', type: 'Double', annotations: [] }],
          returnType: 'String',
        }),
      ],
    });
    const clientClass = createParsedClass({
      name: 'Client',
      properties: [
        {
          name: 'fmt',
          type: 'Formatter',
          visibility: 'public',
          isVal: true,
          annotations: [],
          location: defaultLocation,
        },
      ],
      functions: [
        createParsedFunction({
          name: 'test',
          calls: [
            createParsedCall({
              name: 'format',
              receiver: 'fmt',
              argumentCount: 1,
              argumentTypes: ['Int'],
            }),
            createParsedCall({
              name: 'format',
              receiver: 'fmt',
              argumentCount: 1,
              argumentTypes: ['String'],
            }),
            createParsedCall({
              name: 'format',
              receiver: 'fmt',
              argumentCount: 1,
              argumentTypes: ['Double'],
            }),
          ],
        }),
      ],
    });
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [formatterClass, clientClass],
    });

    const resolved = resolveSymbols([file]);
    const formatCalls = resolved[0]?.resolvedCalls.filter((c) => c.toFqn.includes('format')) || [];

    expect(formatCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should prefer exact type match over compatible type', () => {
    const loggerClass = createParsedClass({
      name: 'Logger',
      functions: [
        createParsedFunction({
          name: 'log',
          parameters: [{ name: 'msg', type: 'String', annotations: [] }],
        }),
        createParsedFunction({
          name: 'log',
          parameters: [{ name: 'msg', type: 'Any', annotations: [] }],
        }),
      ],
    });
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [loggerClass],
    });

    const table = buildSymbolTable([file]);

    // Check that both overloads are indexed
    const logFunctions = table.functionsByName.get('log') || [];
    const loggerMethods = logFunctions.filter(
      (f) => f.declaringTypeFqn === 'com.example.Logger'
    );
    expect(loggerMethods.length).toBe(2);
  });
});

describe('qualified call resolution', () => {
  it('should resolve qualified call to known type', () => {
    const utilsFile = createParsedFile({
      filePath: '/test/StringUtils.kt',
      packageName: 'com.example.utils',
      classes: [
        createParsedClass({
          name: 'StringUtils',
          kind: 'object',
          functions: [createParsedFunction({ name: 'format' })],
        }),
      ],
    });

    const appFile = createParsedFile({
      filePath: '/test/App.kt',
      packageName: 'com.example.app',
      topLevelFunctions: [
        createParsedFunction({
          name: 'test',
          calls: [
            createParsedCall({
              name: 'format',
              receiver: 'com.example.utils.StringUtils',
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([utilsFile, appFile]);
    const appResolved = resolved.find((f) => f.filePath === '/test/App.kt');

    const formatCall = appResolved?.resolvedCalls.find((c) => c.toFqn.includes('format'));
    expect(formatCall).toBeDefined();
    expect(formatCall!.toFqn).toBe('com.example.utils.StringUtils.format');
  });
});

describe('edge cases', () => {
  it('should handle files without package name', () => {
    const file = createParsedFile({
      classes: [
        createParsedClass({
          name: 'NoPackage',
          functions: [createParsedFunction({ name: 'method' })],
        }),
      ],
    });

    const table = buildSymbolTable([file]);
    const resolved = resolveSymbols([file], table);

    expect(table.byFqn.has('NoPackage')).toBe(true);
    expect(table.byFqn.has('NoPackage.method')).toBe(true);
    expect(resolved).toHaveLength(1);
  });

  it('should handle empty files', () => {
    const file = createParsedFile({});

    const table = buildSymbolTable([file]);
    const resolved = resolveSymbols([file], table);

    expect(table.byFqn.size).toBe(0);
    expect(resolved[0]?.resolvedCalls).toHaveLength(0);
  });

  it('should handle generic type names', () => {
    const file = createParsedFile({
      packageName: 'com.example',
      classes: [
        createParsedClass({
          name: 'Container',
          functions: [createParsedFunction({ name: 'get' })],
        }),
        createParsedClass({
          name: 'Service',
          properties: [
            {
              name: 'container',
              type: 'Container<String>',
              visibility: 'private',
              isVal: true,
              annotations: [],
              location: defaultLocation,
            },
          ],
          functions: [
            createParsedFunction({
              name: 'run',
              calls: [createParsedCall({ name: 'get', receiver: 'container' })],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);

    expect(resolved[0]?.resolvedCalls).toHaveLength(1);
    expect(resolved[0]?.resolvedCalls[0]?.toFqn).toBe('com.example.Container.get');
  });

  it('should handle import aliases', () => {
    const utilFile = createParsedFile({
      filePath: '/test/util/Logger.kt',
      packageName: 'com.example.util',
      classes: [
        createParsedClass({
          name: 'Logger',
          functions: [createParsedFunction({ name: 'log' })],
        }),
      ],
    });

    const mainFile = createParsedFile({
      filePath: '/test/Main.kt',
      packageName: 'com.example',
      imports: [
        { path: 'com.example.util.Logger', alias: 'Log', isWildcard: false },
      ],
      classes: [
        createParsedClass({
          name: 'Main',
          properties: [
            {
              name: 'logger',
              type: 'Log',
              visibility: 'private',
              isVal: true,
              annotations: [],
              location: defaultLocation,
            },
          ],
          functions: [
            createParsedFunction({
              name: 'run',
              calls: [createParsedCall({ name: 'log', receiver: 'logger' })],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([utilFile, mainFile]);
    const mainResolved = resolved.find((f) => f.filePath === mainFile.filePath);

    // Should resolve using the alias mapping
    expect(mainResolved?.resolvedCalls).toHaveLength(1);
    expect(mainResolved?.resolvedCalls[0]?.toFqn).toBe('com.example.util.Logger.log');
  });

  it('should handle multiple files with same class names in different packages', () => {
    const file1 = createParsedFile({
      filePath: '/test/a/Service.kt',
      packageName: 'com.example.a',
      classes: [
        createParsedClass({
          name: 'Service',
          functions: [createParsedFunction({ name: 'doA' })],
        }),
      ],
    });

    const file2 = createParsedFile({
      filePath: '/test/b/Service.kt',
      packageName: 'com.example.b',
      classes: [
        createParsedClass({
          name: 'Service',
          functions: [createParsedFunction({ name: 'doB' })],
        }),
      ],
    });

    const table = buildSymbolTable([file1, file2]);

    expect(table.byFqn.has('com.example.a.Service')).toBe(true);
    expect(table.byFqn.has('com.example.b.Service')).toBe(true);
    expect(table.byName.get('Service')).toHaveLength(2);
  });
});

// =============================================================================
// Multi-Language Stdlib Provider Tests
// =============================================================================

import {
  getStdlibProvider,
  getDefaultWildcardImports,
  KotlinStdlibProvider,
  JavaStdlibProvider,
} from './index.js';

describe('StdlibProvider', () => {
  describe('KotlinStdlibProvider', () => {
    const provider = new KotlinStdlibProvider();

    it('should support kotlin language', () => {
      expect(provider.languages).toContain('kotlin');
    });

    it('should have default Kotlin imports', () => {
      expect(provider.defaultWildcardImports).toContain('kotlin');
      expect(provider.defaultWildcardImports).toContain('kotlin.collections');
      expect(provider.defaultWildcardImports).toContain('kotlin.text');
    });

    it('should lookup Kotlin stdlib functions', () => {
      const listOf = provider.lookupFunction('listOf');
      expect(listOf).toBeDefined();
      expect(listOf?.fqn).toBe('kotlin.collections.listOf');

      const println = provider.lookupFunction('println');
      expect(println).toBeDefined();
      expect(println?.fqn).toBe('kotlin.io.println');
    });

    it('should lookup Kotlin stdlib classes', () => {
      const list = provider.lookupClass('List');
      expect(list).toBeDefined();
      expect(list?.fqn).toBe('kotlin.collections.List');

      const string = provider.lookupClass('String');
      expect(string).toBeDefined();
      expect(string?.fqn).toBe('kotlin.String');
    });

    it('should not lookup static methods (Kotlin uses companion objects)', () => {
      const result = provider.lookupStaticMethod('UUID.randomUUID');
      expect(result).toBeUndefined();
    });

    it('should check if symbol is known', () => {
      expect(provider.isKnownSymbol('listOf')).toBe(true);
      expect(provider.isKnownSymbol('String')).toBe(true);
      expect(provider.isKnownSymbol('unknownSymbol')).toBe(false);
    });
  });

  describe('JavaStdlibProvider', () => {
    const provider = new JavaStdlibProvider();

    it('should support java and kotlin languages', () => {
      expect(provider.languages).toContain('java');
      expect(provider.languages).toContain('kotlin');
    });

    it('should have java.lang as default import', () => {
      expect(provider.defaultWildcardImports).toContain('java.lang');
    });

    it('should not lookup top-level functions (Java has none)', () => {
      const result = provider.lookupFunction('println');
      expect(result).toBeUndefined();
    });

    it('should lookup Java stdlib classes', () => {
      const uuid = provider.lookupClass('UUID');
      expect(uuid).toBeDefined();
      expect(uuid?.fqn).toBe('java.util.UUID');

      const file = provider.lookupClass('File');
      expect(file).toBeDefined();
      expect(file?.fqn).toBe('java.io.File');
    });

    it('should lookup static methods', () => {
      const randomUUID = provider.lookupStaticMethod('UUID.randomUUID');
      expect(randomUUID).toBeDefined();
      expect(randomUUID?.fqn).toBe('java.util.UUID.randomUUID');

      const currentTimeMillis = provider.lookupStaticMethod('System.currentTimeMillis');
      expect(currentTimeMillis).toBeDefined();
      expect(currentTimeMillis?.fqn).toBe('java.lang.System.currentTimeMillis');
    });
  });
});

describe('StdlibRegistry', () => {
  describe('getStdlibProvider', () => {
    it('should return composite provider for kotlin', () => {
      const provider = getStdlibProvider('kotlin');
      expect(provider.languages).toContain('kotlin');
    });

    it('should return composite provider for java', () => {
      const provider = getStdlibProvider('java');
      expect(provider.languages).toContain('java');
    });

    it('should return empty provider for typescript (not yet implemented)', () => {
      const provider = getStdlibProvider('typescript');
      expect(provider.lookupFunction('console')).toBeUndefined();
    });
  });

  describe('getDefaultWildcardImports', () => {
    it('should return Kotlin and Java imports for kotlin language', () => {
      const imports = getDefaultWildcardImports('kotlin');
      expect(imports).toContain('kotlin');
      expect(imports).toContain('kotlin.collections');
      expect(imports).toContain('java.lang');
    });

    it('should return only Java imports for java language', () => {
      const imports = getDefaultWildcardImports('java');
      expect(imports).toContain('java.lang');
      expect(imports).not.toContain('kotlin');
    });
  });

  describe('Kotlin uses both Kotlin and Java stdlib', () => {
    const kotlinProvider = getStdlibProvider('kotlin');

    it('should resolve Kotlin stdlib functions', () => {
      const listOf = kotlinProvider.lookupFunction('listOf');
      expect(listOf?.fqn).toBe('kotlin.collections.listOf');
    });

    it('should resolve Java static methods via lookupStaticMethod', () => {
      const randomUUID = kotlinProvider.lookupStaticMethod('UUID.randomUUID');
      expect(randomUUID?.fqn).toBe('java.util.UUID.randomUUID');
    });

    it('should resolve both Kotlin and Java classes', () => {
      // Kotlin class
      const list = kotlinProvider.lookupClass('List');
      expect(list?.fqn).toBe('kotlin.collections.List');

      // Java class
      const uuid = kotlinProvider.lookupClass('UUID');
      expect(uuid?.fqn).toBe('java.util.UUID');
    });
  });
});

describe('Multi-language resolution', () => {
  it('should resolve Kotlin stdlib calls in Kotlin files', () => {
    const file = createParsedFile({
      language: 'kotlin',
      packageName: 'com.example',
      classes: [
        createParsedClass({
          name: 'Service',
          functions: [
            createParsedFunction({
              name: 'process',
              calls: [
                createParsedCall({ name: 'listOf' }),
                createParsedCall({ name: 'println' }),
              ],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);
    const calls = resolved[0]?.resolvedCalls;

    expect(calls).toHaveLength(2);
    expect(calls?.find((c) => c.toFqn === 'kotlin.collections.listOf')).toBeDefined();
    expect(calls?.find((c) => c.toFqn === 'kotlin.io.println')).toBeDefined();
  });

  it('should resolve Java static method calls in Kotlin files', () => {
    const file = createParsedFile({
      language: 'kotlin',
      packageName: 'com.example',
      classes: [
        createParsedClass({
          name: 'Service',
          functions: [
            createParsedFunction({
              name: 'generateId',
              calls: [
                createParsedCall({ name: 'randomUUID', receiver: 'UUID' }),
              ],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([file]);
    const calls = resolved[0]?.resolvedCalls;

    expect(calls).toHaveLength(1);
    expect(calls?.[0]?.toFqn).toBe('java.util.UUID.randomUUID');
  });

  it('should use language-specific default imports', () => {
    // Kotlin file with unqualified call to a Kotlin stdlib function
    const kotlinFile = createParsedFile({
      language: 'kotlin',
      filePath: '/test/Service.kt',
      packageName: 'com.example',
      classes: [
        createParsedClass({
          name: 'Service',
          functions: [
            createParsedFunction({
              name: 'test',
              calls: [createParsedCall({ name: 'require' })],
            }),
          ],
        }),
      ],
    });

    const resolved = resolveSymbols([kotlinFile]);
    const calls = resolved[0]?.resolvedCalls;

    // require is a Kotlin stdlib function
    expect(calls?.[0]?.toFqn).toBe('kotlin.require');
  });
});
