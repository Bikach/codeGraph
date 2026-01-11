import { describe, it, expect } from 'vitest';
import {
  TypescriptStdlibProvider,
  TYPESCRIPT_BUILTIN_TYPES,
  TYPESCRIPT_STDLIB_CLASSES,
  TYPESCRIPT_STDLIB_FUNCTIONS,
  TYPESCRIPT_STDLIB_INSTANCE_METHODS,
  lookupTypescriptStdlibFunction,
  lookupTypescriptStdlibClass,
  isTypescriptStdlibSymbol,
  isTypescriptBuiltinType,
  getTypescriptStdlibSymbols,
} from './typescript-stdlib.js';

describe('TypescriptStdlibProvider', () => {
  const provider = new TypescriptStdlibProvider();

  describe('languages', () => {
    it('should support typescript and javascript', () => {
      expect(provider.languages).toContain('typescript');
      expect(provider.languages).toContain('javascript');
    });
  });

  describe('defaultWildcardImports', () => {
    it('should have no default wildcard imports', () => {
      expect(provider.defaultWildcardImports).toEqual([]);
    });
  });

  describe('lookupFunction', () => {
    it('should find global functions like parseInt', () => {
      const fn = provider.lookupFunction('parseInt');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('parseInt');
      expect(fn?.fqn).toBe('parseInt');
      expect(fn?.returnType).toBe('number');
    });

    it('should find isNaN function', () => {
      const fn = provider.lookupFunction('isNaN');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('boolean');
    });

    it('should return undefined for unknown functions', () => {
      const fn = provider.lookupFunction('unknownFunction');
      expect(fn).toBeUndefined();
    });

    it('should return undefined for user-defined functions', () => {
      const fn = provider.lookupFunction('myCustomFunction');
      expect(fn).toBeUndefined();
    });
  });

  describe('lookupClass', () => {
    it('should find Array class', () => {
      const cls = provider.lookupClass('Array');
      expect(cls).toBeDefined();
      expect(cls?.name).toBe('Array');
      expect(cls?.fqn).toBe('Array');
      expect(cls?.kind).toBe('class');
    });

    it('should find Promise class', () => {
      const cls = provider.lookupClass('Promise');
      expect(cls).toBeDefined();
      expect(cls?.name).toBe('Promise');
    });

    it('should find Map class', () => {
      const cls = provider.lookupClass('Map');
      expect(cls).toBeDefined();
    });

    it('should find Set class', () => {
      const cls = provider.lookupClass('Set');
      expect(cls).toBeDefined();
    });

    it('should find Error class with no superClass', () => {
      const cls = provider.lookupClass('Error');
      expect(cls).toBeDefined();
      expect(cls?.superClass).toBeUndefined();
    });

    it('should find TypeError with Error as superClass', () => {
      const cls = provider.lookupClass('TypeError');
      expect(cls).toBeDefined();
      expect(cls?.superClass).toBe('Error');
    });

    it('should find TypeScript utility types like Partial', () => {
      const cls = provider.lookupClass('Partial');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('interface');
    });

    it('should find Record utility type', () => {
      const cls = provider.lookupClass('Record');
      expect(cls).toBeDefined();
    });

    it('should return undefined for unknown classes', () => {
      const cls = provider.lookupClass('UnknownClass');
      expect(cls).toBeUndefined();
    });

    it('should return undefined for user-defined classes', () => {
      const cls = provider.lookupClass('MyService');
      expect(cls).toBeUndefined();
    });
  });

  describe('lookupStaticMethod', () => {
    it('should find Array.isArray', () => {
      const fn = provider.lookupStaticMethod('Array.isArray');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('isArray');
      expect(fn?.fqn).toBe('Array.isArray');
      expect(fn?.declaringTypeFqn).toBe('Array');
      expect(fn?.returnType).toBe('boolean');
    });

    it('should find Array.from', () => {
      const fn = provider.lookupStaticMethod('Array.from');
      expect(fn).toBeDefined();
      expect(fn?.declaringTypeFqn).toBe('Array');
    });

    it('should find Object.keys', () => {
      const fn = provider.lookupStaticMethod('Object.keys');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('string[]');
    });

    it('should find Object.entries', () => {
      const fn = provider.lookupStaticMethod('Object.entries');
      expect(fn).toBeDefined();
    });

    it('should find Object.assign', () => {
      const fn = provider.lookupStaticMethod('Object.assign');
      expect(fn).toBeDefined();
    });

    it('should find JSON.parse', () => {
      const fn = provider.lookupStaticMethod('JSON.parse');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('any');
    });

    it('should find JSON.stringify', () => {
      const fn = provider.lookupStaticMethod('JSON.stringify');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('string');
    });

    it('should find Promise.resolve', () => {
      const fn = provider.lookupStaticMethod('Promise.resolve');
      expect(fn).toBeDefined();
    });

    it('should find Promise.all', () => {
      const fn = provider.lookupStaticMethod('Promise.all');
      expect(fn).toBeDefined();
    });

    it('should find Math.max', () => {
      const fn = provider.lookupStaticMethod('Math.max');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('number');
    });

    it('should find Math.random', () => {
      const fn = provider.lookupStaticMethod('Math.random');
      expect(fn).toBeDefined();
    });

    it('should find Date.now', () => {
      const fn = provider.lookupStaticMethod('Date.now');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('number');
    });

    it('should find console.log', () => {
      const fn = provider.lookupStaticMethod('console.log');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('void');
    });

    it('should find console.error', () => {
      const fn = provider.lookupStaticMethod('console.error');
      expect(fn).toBeDefined();
    });

    it('should find Array instance methods via lookupStaticMethod', () => {
      const fn = provider.lookupStaticMethod('Array.map');
      expect(fn).toBeDefined();
      expect(fn?.fqn).toBe('Array.prototype.map');
    });

    it('should find Promise.then instance method', () => {
      const fn = provider.lookupStaticMethod('Promise.then');
      expect(fn).toBeDefined();
    });

    it('should find Map.get instance method', () => {
      const fn = provider.lookupStaticMethod('Map.get');
      expect(fn).toBeDefined();
    });

    it('should return undefined for unknown static methods', () => {
      const fn = provider.lookupStaticMethod('Array.unknownMethod');
      expect(fn).toBeUndefined();
    });
  });

  describe('isKnownSymbol', () => {
    it('should return true for built-in types', () => {
      expect(provider.isKnownSymbol('string')).toBe(true);
      expect(provider.isKnownSymbol('number')).toBe(true);
      expect(provider.isKnownSymbol('boolean')).toBe(true);
    });

    it('should return true for stdlib classes', () => {
      expect(provider.isKnownSymbol('Array')).toBe(true);
      expect(provider.isKnownSymbol('Promise')).toBe(true);
      expect(provider.isKnownSymbol('Map')).toBe(true);
    });

    it('should return true for global functions', () => {
      expect(provider.isKnownSymbol('parseInt')).toBe(true);
      expect(provider.isKnownSymbol('parseFloat')).toBe(true);
    });

    it('should return false for user-defined symbols', () => {
      expect(provider.isKnownSymbol('MyClass')).toBe(false);
      expect(provider.isKnownSymbol('customFunction')).toBe(false);
    });
  });

  describe('isBuiltinType', () => {
    it('should return true for primitive types', () => {
      expect(provider.isBuiltinType('string')).toBe(true);
      expect(provider.isBuiltinType('number')).toBe(true);
      expect(provider.isBuiltinType('boolean')).toBe(true);
      expect(provider.isBuiltinType('symbol')).toBe(true);
      expect(provider.isBuiltinType('bigint')).toBe(true);
    });

    it('should return true for special types', () => {
      expect(provider.isBuiltinType('void')).toBe(true);
      expect(provider.isBuiltinType('never')).toBe(true);
      expect(provider.isBuiltinType('unknown')).toBe(true);
      expect(provider.isBuiltinType('any')).toBe(true);
      expect(provider.isBuiltinType('undefined')).toBe(true);
      expect(provider.isBuiltinType('null')).toBe(true);
      expect(provider.isBuiltinType('object')).toBe(true);
    });

    it('should return false for non-primitive types', () => {
      expect(provider.isBuiltinType('String')).toBe(false);
      expect(provider.isBuiltinType('Array')).toBe(false);
      expect(provider.isBuiltinType('MyType')).toBe(false);
    });
  });

  describe('getAllSymbols', () => {
    it('should return a map with all symbols', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols).toBeInstanceOf(Map);
      expect(symbols.size).toBeGreaterThan(0);
    });

    it('should include classes', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols.get('Array')).toBeDefined();
      expect(symbols.get('Promise')).toBeDefined();
    });

    it('should include functions', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols.get('parseInt')).toBeDefined();
    });

    it('should include instance methods', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols.get('Array.map')).toBeDefined();
    });
  });
});

describe('TYPESCRIPT_BUILTIN_TYPES', () => {
  it('should contain all primitive types', () => {
    expect(TYPESCRIPT_BUILTIN_TYPES.has('string')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('number')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('boolean')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('symbol')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('bigint')).toBe(true);
  });

  it('should contain special types', () => {
    expect(TYPESCRIPT_BUILTIN_TYPES.has('void')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('never')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('unknown')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('any')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('undefined')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('null')).toBe(true);
    expect(TYPESCRIPT_BUILTIN_TYPES.has('object')).toBe(true);
  });
});

describe('TYPESCRIPT_STDLIB_CLASSES', () => {
  it('should have Array class', () => {
    const array = TYPESCRIPT_STDLIB_CLASSES.get('Array');
    expect(array).toBeDefined();
    expect(array?.kind).toBe('class');
  });

  it('should have Map class', () => {
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Map')).toBeDefined();
  });

  it('should have Set class', () => {
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Set')).toBeDefined();
  });

  it('should have all Error types', () => {
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Error')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('TypeError')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('RangeError')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('SyntaxError')).toBeDefined();
  });

  it('should have TypeScript utility types', () => {
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Partial')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Required')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Readonly')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Record')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Pick')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Omit')).toBeDefined();
  });

  it('should have Iterator types', () => {
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Iterable')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Iterator')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_CLASSES.get('Generator')).toBeDefined();
  });
});

describe('TYPESCRIPT_STDLIB_FUNCTIONS', () => {
  it('should have global functions', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('parseInt')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('parseFloat')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('isNaN')).toBeDefined();
  });

  it('should have console methods', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('console.log')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('console.error')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('console.warn')).toBeDefined();
  });

  it('should have Object static methods', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Object.keys')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Object.values')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Object.entries')).toBeDefined();
  });

  it('should have Array static methods', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Array.isArray')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Array.from')).toBeDefined();
  });

  it('should have JSON methods', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('JSON.parse')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('JSON.stringify')).toBeDefined();
  });

  it('should have Math methods', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Math.max')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Math.min')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Math.floor')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Math.ceil')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Math.random')).toBeDefined();
  });

  it('should have Promise static methods', () => {
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Promise.resolve')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Promise.reject')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Promise.all')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_FUNCTIONS.get('Promise.race')).toBeDefined();
  });
});

describe('TYPESCRIPT_STDLIB_INSTANCE_METHODS', () => {
  it('should have Array instance methods', () => {
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.map')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.filter')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.reduce')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.forEach')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.find')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.includes')).toBeDefined();
  });

  it('should have String instance methods', () => {
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('String.split')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('String.trim')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('String.toLowerCase')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('String.toUpperCase')).toBeDefined();
  });

  it('should have Promise instance methods', () => {
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Promise.then')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Promise.catch')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Promise.finally')).toBeDefined();
  });

  it('should have Map instance methods', () => {
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Map.get')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Map.set')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Map.has')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Map.delete')).toBeDefined();
  });

  it('should have Set instance methods', () => {
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Set.add')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Set.has')).toBeDefined();
    expect(TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Set.delete')).toBeDefined();
  });

  it('should have correct FQN for instance methods', () => {
    const mapMethod = TYPESCRIPT_STDLIB_INSTANCE_METHODS.get('Array.map');
    expect(mapMethod?.fqn).toBe('Array.prototype.map');
  });
});

describe('helper functions', () => {
  describe('lookupTypescriptStdlibFunction', () => {
    it('should find global functions', () => {
      const fn = lookupTypescriptStdlibFunction('parseInt');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('parseInt');
    });

    it('should return undefined for unknown functions', () => {
      expect(lookupTypescriptStdlibFunction('unknown')).toBeUndefined();
    });
  });

  describe('lookupTypescriptStdlibClass', () => {
    it('should find stdlib classes', () => {
      const cls = lookupTypescriptStdlibClass('Array');
      expect(cls).toBeDefined();
      expect(cls?.name).toBe('Array');
    });

    it('should return undefined for unknown classes', () => {
      expect(lookupTypescriptStdlibClass('Unknown')).toBeUndefined();
    });
  });

  describe('isTypescriptStdlibSymbol', () => {
    it('should return true for builtin types', () => {
      expect(isTypescriptStdlibSymbol('string')).toBe(true);
      expect(isTypescriptStdlibSymbol('number')).toBe(true);
    });

    it('should return true for classes', () => {
      expect(isTypescriptStdlibSymbol('Array')).toBe(true);
      expect(isTypescriptStdlibSymbol('Map')).toBe(true);
    });

    it('should return true for functions', () => {
      expect(isTypescriptStdlibSymbol('parseInt')).toBe(true);
    });

    it('should return true for instance methods', () => {
      expect(isTypescriptStdlibSymbol('Array.map')).toBe(true);
    });

    it('should return false for unknown symbols', () => {
      expect(isTypescriptStdlibSymbol('MyClass')).toBe(false);
    });
  });

  describe('isTypescriptBuiltinType', () => {
    it('should return true for primitive types', () => {
      expect(isTypescriptBuiltinType('string')).toBe(true);
      expect(isTypescriptBuiltinType('number')).toBe(true);
    });

    it('should return false for non-primitive types', () => {
      expect(isTypescriptBuiltinType('String')).toBe(false);
      expect(isTypescriptBuiltinType('Array')).toBe(false);
    });
  });

  describe('getTypescriptStdlibSymbols', () => {
    it('should return all symbols in a map', () => {
      const symbols = getTypescriptStdlibSymbols();
      expect(symbols.size).toBeGreaterThan(50);
    });

    it('should include classes, functions, and instance methods', () => {
      const symbols = getTypescriptStdlibSymbols();
      expect(symbols.get('Array')).toBeDefined();
      expect(symbols.get('parseInt')).toBeDefined();
      expect(symbols.get('Array.map')).toBeDefined();
    });
  });
});
