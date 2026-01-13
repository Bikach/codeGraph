import { describe, it, expect } from 'vitest';
import {
  NodejsStdlibProvider,
  NODEJS_STDLIB_CLASSES,
  NODEJS_STDLIB_FUNCTIONS,
} from './nodejs-stdlib.js';

describe('NodejsStdlibProvider', () => {
  const provider = new NodejsStdlibProvider();

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
    it('should find require function', () => {
      const fn = provider.lookupFunction('require');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('require');
      expect(fn?.returnType).toBe('any');
    });

    it('should find setImmediate function', () => {
      const fn = provider.lookupFunction('setImmediate');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('Immediate');
    });

    it('should find setTimeout function', () => {
      const fn = provider.lookupFunction('setTimeout');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('Timeout');
    });

    it('should return undefined for unknown functions', () => {
      const fn = provider.lookupFunction('unknownFunction');
      expect(fn).toBeUndefined();
    });
  });

  describe('lookupClass', () => {
    it('should find Buffer class', () => {
      const cls = provider.lookupClass('Buffer');
      expect(cls).toBeDefined();
      expect(cls?.name).toBe('Buffer');
      expect(cls?.kind).toBe('class');
    });

    it('should find process object', () => {
      const cls = provider.lookupClass('process');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('object');
    });

    it('should find Stream classes', () => {
      expect(provider.lookupClass('Stream')).toBeDefined();
      expect(provider.lookupClass('Readable')).toBeDefined();
      expect(provider.lookupClass('Writable')).toBeDefined();
      expect(provider.lookupClass('Duplex')).toBeDefined();
      expect(provider.lookupClass('Transform')).toBeDefined();
    });

    it('should find EventEmitter class', () => {
      const cls = provider.lookupClass('EventEmitter');
      expect(cls).toBeDefined();
      expect(cls?.fqn).toBe('events.EventEmitter');
    });

    it('should find URL class', () => {
      const cls = provider.lookupClass('URL');
      expect(cls).toBeDefined();
    });

    it('should return undefined for unknown classes', () => {
      const cls = provider.lookupClass('UnknownClass');
      expect(cls).toBeUndefined();
    });
  });

  describe('lookupStaticMethod', () => {
    it('should find Buffer.from', () => {
      const fn = provider.lookupStaticMethod('Buffer.from');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('from');
      expect(fn?.declaringTypeFqn).toBe('Buffer');
      expect(fn?.returnType).toBe('Buffer');
    });

    it('should find Buffer.alloc', () => {
      const fn = provider.lookupStaticMethod('Buffer.alloc');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('Buffer');
    });

    it('should find process.exit', () => {
      const fn = provider.lookupStaticMethod('process.exit');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('never');
    });

    it('should find process.cwd', () => {
      const fn = provider.lookupStaticMethod('process.cwd');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('string');
    });

    it('should find fs.readFileSync', () => {
      const fn = provider.lookupStaticMethod('fs.readFileSync');
      expect(fn).toBeDefined();
    });

    it('should find fs.writeFileSync', () => {
      const fn = provider.lookupStaticMethod('fs.writeFileSync');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('void');
    });

    it('should find fs.existsSync', () => {
      const fn = provider.lookupStaticMethod('fs.existsSync');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('boolean');
    });

    it('should find path methods', () => {
      expect(provider.lookupStaticMethod('path.join')).toBeDefined();
      expect(provider.lookupStaticMethod('path.resolve')).toBeDefined();
      expect(provider.lookupStaticMethod('path.dirname')).toBeDefined();
      expect(provider.lookupStaticMethod('path.basename')).toBeDefined();
    });

    it('should find http.createServer', () => {
      const fn = provider.lookupStaticMethod('http.createServer');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('Server');
    });

    it('should find crypto methods', () => {
      expect(provider.lookupStaticMethod('crypto.randomBytes')).toBeDefined();
      expect(provider.lookupStaticMethod('crypto.createHash')).toBeDefined();
    });

    it('should find util.promisify', () => {
      const fn = provider.lookupStaticMethod('util.promisify');
      expect(fn).toBeDefined();
    });

    it('should return undefined for unknown static methods', () => {
      const fn = provider.lookupStaticMethod('unknown.method');
      expect(fn).toBeUndefined();
    });
  });

  describe('isKnownSymbol', () => {
    it('should return true for Node.js classes', () => {
      expect(provider.isKnownSymbol('Buffer')).toBe(true);
      expect(provider.isKnownSymbol('process')).toBe(true);
      expect(provider.isKnownSymbol('EventEmitter')).toBe(true);
    });

    it('should return true for Node.js functions', () => {
      expect(provider.isKnownSymbol('require')).toBe(true);
      expect(provider.isKnownSymbol('setTimeout')).toBe(true);
    });

    it('should return false for unknown symbols', () => {
      expect(provider.isKnownSymbol('MyClass')).toBe(false);
      expect(provider.isKnownSymbol('unknownFunction')).toBe(false);
    });
  });

  describe('isBuiltinType', () => {
    it('should return false (Node.js does not define primitive types)', () => {
      expect(provider.isBuiltinType('string')).toBe(false);
      expect(provider.isBuiltinType('Buffer')).toBe(false);
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
      expect(symbols.get('Buffer')).toBeDefined();
      expect(symbols.get('process')).toBeDefined();
    });

    it('should include functions', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols.get('require')).toBeDefined();
      expect(symbols.get('setTimeout')).toBeDefined();
    });
  });
});

describe('NODEJS_STDLIB_CLASSES', () => {
  it('should have Buffer class', () => {
    const buffer = NODEJS_STDLIB_CLASSES.get('Buffer');
    expect(buffer).toBeDefined();
    expect(buffer?.kind).toBe('class');
  });

  it('should have process object', () => {
    const process = NODEJS_STDLIB_CLASSES.get('process');
    expect(process).toBeDefined();
    expect(process?.kind).toBe('object');
  });

  it('should have global objects', () => {
    expect(NODEJS_STDLIB_CLASSES.get('global')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('globalThis')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('__dirname')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('__filename')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('module')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('exports')).toBeDefined();
  });

  it('should have Stream classes with inheritance', () => {
    const readable = NODEJS_STDLIB_CLASSES.get('Readable');
    expect(readable).toBeDefined();
    expect(readable?.superClass).toBe('Stream');

    const writable = NODEJS_STDLIB_CLASSES.get('Writable');
    expect(writable?.superClass).toBe('Stream');

    const transform = NODEJS_STDLIB_CLASSES.get('Transform');
    expect(transform?.superClass).toBe('Duplex');
  });

  it('should have HTTP classes', () => {
    expect(NODEJS_STDLIB_CLASSES.get('IncomingMessage')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('ServerResponse')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('Server')).toBeDefined();
  });

  it('should have URL and URLSearchParams', () => {
    expect(NODEJS_STDLIB_CLASSES.get('URL')).toBeDefined();
    expect(NODEJS_STDLIB_CLASSES.get('URLSearchParams')).toBeDefined();
  });
});

describe('NODEJS_STDLIB_FUNCTIONS', () => {
  it('should have global functions', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('require')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('setImmediate')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('clearImmediate')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('setTimeout')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('clearTimeout')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('setInterval')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('clearInterval')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('queueMicrotask')).toBeDefined();
  });

  it('should have Buffer static methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('Buffer.alloc')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('Buffer.allocUnsafe')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('Buffer.from')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('Buffer.concat')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('Buffer.isBuffer')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('Buffer.byteLength')).toBeDefined();
  });

  it('should have process methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('process.exit')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('process.cwd')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('process.chdir')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('process.nextTick')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('process.hrtime')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('process.memoryUsage')).toBeDefined();
  });

  it('should have fs synchronous functions', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.readFileSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.writeFileSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.existsSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.mkdirSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.readdirSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.statSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.unlinkSync')).toBeDefined();
  });

  it('should have fs async functions', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.readFile')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.writeFile')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.mkdir')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.readdir')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('fs.stat')).toBeDefined();
  });

  it('should have path methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.join')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.resolve')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.dirname')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.basename')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.extname')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.parse')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.normalize')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.relative')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('path.isAbsolute')).toBeDefined();
  });

  it('should have os methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('os.platform')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('os.arch')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('os.cpus')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('os.homedir')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('os.tmpdir')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('os.hostname')).toBeDefined();
  });

  it('should have http/https methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('http.createServer')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('http.get')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('http.request')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('https.createServer')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('https.get')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('https.request')).toBeDefined();
  });

  it('should have crypto methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('crypto.randomBytes')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('crypto.createHash')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('crypto.createHmac')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('crypto.createCipheriv')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('crypto.createDecipheriv')).toBeDefined();
  });

  it('should have util methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('util.promisify')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('util.inspect')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('util.format')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('util.deprecate')).toBeDefined();
  });

  it('should have child_process methods', () => {
    expect(NODEJS_STDLIB_FUNCTIONS.get('child_process.spawn')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('child_process.exec')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('child_process.execSync')).toBeDefined();
    expect(NODEJS_STDLIB_FUNCTIONS.get('child_process.fork')).toBeDefined();
  });

  it('should have correct return types', () => {
    const pathJoin = NODEJS_STDLIB_FUNCTIONS.get('path.join');
    expect(pathJoin?.returnType).toBe('string');

    const fsExistsSync = NODEJS_STDLIB_FUNCTIONS.get('fs.existsSync');
    expect(fsExistsSync?.returnType).toBe('boolean');

    const processExit = NODEJS_STDLIB_FUNCTIONS.get('process.exit');
    expect(processExit?.returnType).toBe('never');
  });
});
