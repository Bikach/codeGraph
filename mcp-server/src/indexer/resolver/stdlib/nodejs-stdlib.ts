/**
 * Node.js Standard Library symbols for resolution.
 *
 * These are the built-in Node.js modules and global objects available
 * in Node.js environments without explicit imports (for CommonJS require).
 *
 * Reference: https://nodejs.org/docs/latest/api/
 */

import type { FunctionSymbol, ClassSymbol, Symbol } from '../types.js';
import type { StdlibProvider } from './stdlib-provider.js';
import type { SupportedLanguage } from '../../types.js';

// Stdlib location placeholder
const STDLIB_LOC = {
  filePath: '<nodejs-stdlib>',
  startLine: 0,
  startColumn: 0,
  endLine: 0,
  endColumn: 0,
};

// Helper to create a function symbol
function fn(
  name: string,
  fqn: string,
  opts: {
    parameterTypes?: string[];
    returnType?: string;
    declaringTypeFqn?: string;
  } = {}
): FunctionSymbol {
  return {
    name,
    fqn,
    kind: 'function',
    filePath: '<nodejs-stdlib>',
    location: STDLIB_LOC,
    packageName: 'nodejs',
    parameterTypes: opts.parameterTypes || [],
    returnType: opts.returnType,
    declaringTypeFqn: opts.declaringTypeFqn,
    isExtension: false,
  };
}

// Helper to create a class symbol
function cls(
  name: string,
  fqn: string,
  kind: 'class' | 'interface' | 'object' | 'enum' = 'class',
  opts: {
    superClass?: string;
    interfaces?: string[];
    isAbstract?: boolean;
  } = {}
): ClassSymbol {
  return {
    name,
    fqn,
    kind,
    filePath: '<nodejs-stdlib>',
    location: STDLIB_LOC,
    packageName: 'nodejs',
    superClass: opts.superClass,
    interfaces: opts.interfaces || [],
    isAbstract: opts.isAbstract,
  };
}

// =============================================================================
// Node.js Global Objects and Classes
// =============================================================================

export const NODEJS_STDLIB_CLASSES: ReadonlyMap<string, ClassSymbol> = new Map([
  // Buffer
  ['Buffer', cls('Buffer', 'Buffer', 'class')],

  // Process
  ['process', cls('process', 'process', 'object')],

  // Global objects
  ['global', cls('global', 'global', 'object')],
  ['globalThis', cls('globalThis', 'globalThis', 'object')],
  ['__dirname', cls('__dirname', '__dirname', 'object')],
  ['__filename', cls('__filename', '__filename', 'object')],
  ['module', cls('module', 'module', 'object')],
  ['exports', cls('exports', 'exports', 'object')],
  ['require', cls('require', 'require', 'object')],

  // Events
  ['EventEmitter', cls('EventEmitter', 'events.EventEmitter', 'class')],

  // Streams
  ['Stream', cls('Stream', 'stream.Stream', 'class')],
  ['Readable', cls('Readable', 'stream.Readable', 'class', { superClass: 'Stream' })],
  ['Writable', cls('Writable', 'stream.Writable', 'class', { superClass: 'Stream' })],
  ['Duplex', cls('Duplex', 'stream.Duplex', 'class', { superClass: 'Stream' })],
  ['Transform', cls('Transform', 'stream.Transform', 'class', { superClass: 'Duplex' })],

  // HTTP
  ['IncomingMessage', cls('IncomingMessage', 'http.IncomingMessage', 'class')],
  ['ServerResponse', cls('ServerResponse', 'http.ServerResponse', 'class')],
  ['Server', cls('Server', 'http.Server', 'class')],

  // File System
  ['Stats', cls('Stats', 'fs.Stats', 'class')],
  ['ReadStream', cls('ReadStream', 'fs.ReadStream', 'class')],
  ['WriteStream', cls('WriteStream', 'fs.WriteStream', 'class')],

  // URL
  ['URL', cls('URL', 'URL', 'class')],
  ['URLSearchParams', cls('URLSearchParams', 'URLSearchParams', 'class')],

  // Timers
  ['Timeout', cls('Timeout', 'Timeout', 'class')],
  ['Immediate', cls('Immediate', 'Immediate', 'class')],
]);

// =============================================================================
// Node.js Global Functions
// =============================================================================

export const NODEJS_STDLIB_FUNCTIONS: ReadonlyMap<string, FunctionSymbol> = new Map([
  // Global functions
  ['require', fn('require', 'require', { parameterTypes: ['string'], returnType: 'any' })],
  ['setImmediate', fn('setImmediate', 'setImmediate', { parameterTypes: ['(...args: any[]) => void', '...any[]'], returnType: 'Immediate' })],
  ['clearImmediate', fn('clearImmediate', 'clearImmediate', { parameterTypes: ['Immediate'], returnType: 'void' })],
  ['setTimeout', fn('setTimeout', 'setTimeout', { parameterTypes: ['(...args: any[]) => void', 'number?', '...any[]'], returnType: 'Timeout' })],
  ['clearTimeout', fn('clearTimeout', 'clearTimeout', { parameterTypes: ['Timeout'], returnType: 'void' })],
  ['setInterval', fn('setInterval', 'setInterval', { parameterTypes: ['(...args: any[]) => void', 'number?', '...any[]'], returnType: 'Timeout' })],
  ['clearInterval', fn('clearInterval', 'clearInterval', { parameterTypes: ['Timeout'], returnType: 'void' })],
  ['queueMicrotask', fn('queueMicrotask', 'queueMicrotask', { parameterTypes: ['() => void'], returnType: 'void' })],

  // Buffer static methods
  ['Buffer.alloc', fn('alloc', 'Buffer.alloc', { declaringTypeFqn: 'Buffer', parameterTypes: ['number', 'number | Buffer | string?', 'string?'], returnType: 'Buffer' })],
  ['Buffer.allocUnsafe', fn('allocUnsafe', 'Buffer.allocUnsafe', { declaringTypeFqn: 'Buffer', parameterTypes: ['number'], returnType: 'Buffer' })],
  ['Buffer.from', fn('from', 'Buffer.from', { declaringTypeFqn: 'Buffer', parameterTypes: ['string | Buffer | ArrayBuffer | any[]', 'string?', 'number?', 'number?'], returnType: 'Buffer' })],
  ['Buffer.concat', fn('concat', 'Buffer.concat', { declaringTypeFqn: 'Buffer', parameterTypes: ['Buffer[]', 'number?'], returnType: 'Buffer' })],
  ['Buffer.isBuffer', fn('isBuffer', 'Buffer.isBuffer', { declaringTypeFqn: 'Buffer', parameterTypes: ['any'], returnType: 'boolean' })],
  ['Buffer.byteLength', fn('byteLength', 'Buffer.byteLength', { declaringTypeFqn: 'Buffer', parameterTypes: ['string | Buffer', 'string?'], returnType: 'number' })],
  ['Buffer.compare', fn('compare', 'Buffer.compare', { declaringTypeFqn: 'Buffer', parameterTypes: ['Buffer', 'Buffer'], returnType: 'number' })],

  // Process methods
  ['process.exit', fn('exit', 'process.exit', { declaringTypeFqn: 'process', parameterTypes: ['number?'], returnType: 'never' })],
  ['process.cwd', fn('cwd', 'process.cwd', { declaringTypeFqn: 'process', parameterTypes: [], returnType: 'string' })],
  ['process.chdir', fn('chdir', 'process.chdir', { declaringTypeFqn: 'process', parameterTypes: ['string'], returnType: 'void' })],
  ['process.nextTick', fn('nextTick', 'process.nextTick', { declaringTypeFqn: 'process', parameterTypes: ['(...args: any[]) => void', '...any[]'], returnType: 'void' })],
  ['process.hrtime', fn('hrtime', 'process.hrtime', { declaringTypeFqn: 'process', parameterTypes: ['[number, number]?'], returnType: '[number, number]' })],
  ['process.memoryUsage', fn('memoryUsage', 'process.memoryUsage', { declaringTypeFqn: 'process', parameterTypes: [], returnType: 'MemoryUsage' })],
  ['process.cpuUsage', fn('cpuUsage', 'process.cpuUsage', { declaringTypeFqn: 'process', parameterTypes: ['CpuUsage?'], returnType: 'CpuUsage' })],
  ['process.uptime', fn('uptime', 'process.uptime', { declaringTypeFqn: 'process', parameterTypes: [], returnType: 'number' })],
  ['process.kill', fn('kill', 'process.kill', { declaringTypeFqn: 'process', parameterTypes: ['number', 'string | number?'], returnType: 'boolean' })],

  // fs synchronous functions (commonly used)
  ['fs.readFileSync', fn('readFileSync', 'fs.readFileSync', { parameterTypes: ['string | Buffer | URL | number', 'string | object?'], returnType: 'string | Buffer' })],
  ['fs.writeFileSync', fn('writeFileSync', 'fs.writeFileSync', { parameterTypes: ['string | Buffer | URL | number', 'string | Buffer', 'string | object?'], returnType: 'void' })],
  ['fs.existsSync', fn('existsSync', 'fs.existsSync', { parameterTypes: ['string | Buffer | URL'], returnType: 'boolean' })],
  ['fs.mkdirSync', fn('mkdirSync', 'fs.mkdirSync', { parameterTypes: ['string | Buffer | URL', 'string | object?'], returnType: 'string | undefined' })],
  ['fs.readdirSync', fn('readdirSync', 'fs.readdirSync', { parameterTypes: ['string | Buffer | URL', 'string | object?'], returnType: 'string[] | Buffer[] | Dirent[]' })],
  ['fs.statSync', fn('statSync', 'fs.statSync', { parameterTypes: ['string | Buffer | URL', 'object?'], returnType: 'Stats' })],
  ['fs.unlinkSync', fn('unlinkSync', 'fs.unlinkSync', { parameterTypes: ['string | Buffer | URL'], returnType: 'void' })],
  ['fs.renameSync', fn('renameSync', 'fs.renameSync', { parameterTypes: ['string | Buffer | URL', 'string | Buffer | URL'], returnType: 'void' })],
  ['fs.copyFileSync', fn('copyFileSync', 'fs.copyFileSync', { parameterTypes: ['string | Buffer | URL', 'string | Buffer | URL', 'number?'], returnType: 'void' })],
  ['fs.appendFileSync', fn('appendFileSync', 'fs.appendFileSync', { parameterTypes: ['string | Buffer | URL | number', 'string | Buffer', 'string | object?'], returnType: 'void' })],

  // fs async functions
  ['fs.readFile', fn('readFile', 'fs.readFile', { parameterTypes: ['string | Buffer | URL | number', 'string | object?', '(err: Error | null, data: string | Buffer) => void'], returnType: 'void' })],
  ['fs.writeFile', fn('writeFile', 'fs.writeFile', { parameterTypes: ['string | Buffer | URL | number', 'string | Buffer', 'string | object?', '(err: Error | null) => void'], returnType: 'void' })],
  ['fs.mkdir', fn('mkdir', 'fs.mkdir', { parameterTypes: ['string | Buffer | URL', 'string | object?', '(err: Error | null, path?: string) => void'], returnType: 'void' })],
  ['fs.readdir', fn('readdir', 'fs.readdir', { parameterTypes: ['string | Buffer | URL', 'string | object?', '(err: Error | null, files: string[]) => void'], returnType: 'void' })],
  ['fs.stat', fn('stat', 'fs.stat', { parameterTypes: ['string | Buffer | URL', 'object?', '(err: Error | null, stats: Stats) => void'], returnType: 'void' })],

  // path methods
  ['path.join', fn('join', 'path.join', { parameterTypes: ['...string[]'], returnType: 'string' })],
  ['path.resolve', fn('resolve', 'path.resolve', { parameterTypes: ['...string[]'], returnType: 'string' })],
  ['path.dirname', fn('dirname', 'path.dirname', { parameterTypes: ['string'], returnType: 'string' })],
  ['path.basename', fn('basename', 'path.basename', { parameterTypes: ['string', 'string?'], returnType: 'string' })],
  ['path.extname', fn('extname', 'path.extname', { parameterTypes: ['string'], returnType: 'string' })],
  ['path.parse', fn('parse', 'path.parse', { parameterTypes: ['string'], returnType: 'ParsedPath' })],
  ['path.format', fn('format', 'path.format', { parameterTypes: ['ParsedPath'], returnType: 'string' })],
  ['path.normalize', fn('normalize', 'path.normalize', { parameterTypes: ['string'], returnType: 'string' })],
  ['path.relative', fn('relative', 'path.relative', { parameterTypes: ['string', 'string'], returnType: 'string' })],
  ['path.isAbsolute', fn('isAbsolute', 'path.isAbsolute', { parameterTypes: ['string'], returnType: 'boolean' })],

  // os methods
  ['os.platform', fn('platform', 'os.platform', { parameterTypes: [], returnType: 'string' })],
  ['os.arch', fn('arch', 'os.arch', { parameterTypes: [], returnType: 'string' })],
  ['os.cpus', fn('cpus', 'os.cpus', { parameterTypes: [], returnType: 'CpuInfo[]' })],
  ['os.homedir', fn('homedir', 'os.homedir', { parameterTypes: [], returnType: 'string' })],
  ['os.tmpdir', fn('tmpdir', 'os.tmpdir', { parameterTypes: [], returnType: 'string' })],
  ['os.hostname', fn('hostname', 'os.hostname', { parameterTypes: [], returnType: 'string' })],
  ['os.freemem', fn('freemem', 'os.freemem', { parameterTypes: [], returnType: 'number' })],
  ['os.totalmem', fn('totalmem', 'os.totalmem', { parameterTypes: [], returnType: 'number' })],

  // http methods
  ['http.createServer', fn('createServer', 'http.createServer', { parameterTypes: ['RequestListener?'], returnType: 'Server' })],
  ['http.get', fn('get', 'http.get', { parameterTypes: ['string | URL | RequestOptions', '((res: IncomingMessage) => void)?'], returnType: 'ClientRequest' })],
  ['http.request', fn('request', 'http.request', { parameterTypes: ['string | URL | RequestOptions', '((res: IncomingMessage) => void)?'], returnType: 'ClientRequest' })],

  // https methods
  ['https.createServer', fn('createServer', 'https.createServer', { parameterTypes: ['ServerOptions?', 'RequestListener?'], returnType: 'Server' })],
  ['https.get', fn('get', 'https.get', { parameterTypes: ['string | URL | RequestOptions', '((res: IncomingMessage) => void)?'], returnType: 'ClientRequest' })],
  ['https.request', fn('request', 'https.request', { parameterTypes: ['string | URL | RequestOptions', '((res: IncomingMessage) => void)?'], returnType: 'ClientRequest' })],

  // crypto methods (commonly used)
  ['crypto.randomBytes', fn('randomBytes', 'crypto.randomBytes', { parameterTypes: ['number', '((err: Error | null, buf: Buffer) => void)?'], returnType: 'Buffer' })],
  ['crypto.createHash', fn('createHash', 'crypto.createHash', { parameterTypes: ['string', 'object?'], returnType: 'Hash' })],
  ['crypto.createHmac', fn('createHmac', 'crypto.createHmac', { parameterTypes: ['string', 'string | Buffer', 'object?'], returnType: 'Hmac' })],
  ['crypto.createCipheriv', fn('createCipheriv', 'crypto.createCipheriv', { parameterTypes: ['string', 'string | Buffer', 'string | Buffer | null', 'object?'], returnType: 'Cipher' })],
  ['crypto.createDecipheriv', fn('createDecipheriv', 'crypto.createDecipheriv', { parameterTypes: ['string', 'string | Buffer', 'string | Buffer | null', 'object?'], returnType: 'Decipher' })],

  // util methods
  ['util.promisify', fn('promisify', 'util.promisify', { parameterTypes: ['Function'], returnType: 'Function' })],
  ['util.inspect', fn('inspect', 'util.inspect', { parameterTypes: ['any', 'object?'], returnType: 'string' })],
  ['util.format', fn('format', 'util.format', { parameterTypes: ['any?', '...any[]'], returnType: 'string' })],
  ['util.deprecate', fn('deprecate', 'util.deprecate', { parameterTypes: ['Function', 'string', 'string?'], returnType: 'Function' })],
  ['util.types.isArrayBuffer', fn('isArrayBuffer', 'util.types.isArrayBuffer', { parameterTypes: ['any'], returnType: 'boolean' })],
  ['util.types.isPromise', fn('isPromise', 'util.types.isPromise', { parameterTypes: ['any'], returnType: 'boolean' })],

  // events methods
  ['events.on', fn('on', 'events.on', { parameterTypes: ['EventEmitter', 'string | symbol', 'object?'], returnType: 'AsyncIterableIterator<any>' })],
  ['events.once', fn('once', 'events.once', { parameterTypes: ['EventEmitter', 'string | symbol', 'object?'], returnType: 'Promise<any[]>' })],

  // child_process methods
  ['child_process.spawn', fn('spawn', 'child_process.spawn', { parameterTypes: ['string', 'string[]?', 'SpawnOptions?'], returnType: 'ChildProcess' })],
  ['child_process.exec', fn('exec', 'child_process.exec', { parameterTypes: ['string', 'object?', '((error: Error | null, stdout: string, stderr: string) => void)?'], returnType: 'ChildProcess' })],
  ['child_process.execSync', fn('execSync', 'child_process.execSync', { parameterTypes: ['string', 'object?'], returnType: 'Buffer | string' })],
  ['child_process.fork', fn('fork', 'child_process.fork', { parameterTypes: ['string', 'string[]?', 'ForkOptions?'], returnType: 'ChildProcess' })],
]);

// =============================================================================
// Node.js Stdlib Provider
// =============================================================================

/**
 * StdlibProvider implementation for Node.js.
 * Provides access to Node.js stdlib for symbol resolution.
 */
export class NodejsStdlibProvider implements StdlibProvider {
  readonly languages: readonly SupportedLanguage[] = ['typescript', 'javascript'];

  // Node.js global objects (available without import)
  readonly defaultWildcardImports: readonly string[] = [];

  lookupFunction(name: string): FunctionSymbol | undefined {
    return NODEJS_STDLIB_FUNCTIONS.get(name);
  }

  lookupClass(name: string): ClassSymbol | undefined {
    return NODEJS_STDLIB_CLASSES.get(name);
  }

  lookupStaticMethod(qualifiedName: string): FunctionSymbol | undefined {
    return NODEJS_STDLIB_FUNCTIONS.get(qualifiedName);
  }

  isKnownSymbol(name: string): boolean {
    return NODEJS_STDLIB_CLASSES.has(name) || NODEJS_STDLIB_FUNCTIONS.has(name);
  }

  getAllSymbols(): Map<string, Symbol> {
    const result = new Map<string, Symbol>();

    for (const [name, func] of NODEJS_STDLIB_FUNCTIONS) {
      result.set(name, func);
    }

    for (const [name, clsSymbol] of NODEJS_STDLIB_CLASSES) {
      result.set(name, clsSymbol);
    }

    return result;
  }

  isBuiltinType(_typeName: string): boolean {
    // Node.js doesn't add primitive types, defer to TypeScript
    return false;
  }
}
