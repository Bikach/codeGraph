/**
 * TypeScript Standard Library symbols for resolution.
 *
 * These are the built-in global types, constructors, and commonly used
 * utility types available in TypeScript without explicit imports.
 *
 * Reference: https://www.typescriptlang.org/docs/handbook/utility-types.html
 * Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference
 */

import type { FunctionSymbol, ClassSymbol, Symbol } from '../types.js';
import type { StdlibProvider } from './stdlib-provider.js';
import type { SupportedLanguage } from '../../types.js';

// Stdlib location placeholder
const STDLIB_LOC = {
  filePath: '<typescript-stdlib>',
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
    filePath: '<typescript-stdlib>',
    location: STDLIB_LOC,
    packageName: 'global',
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
    filePath: '<typescript-stdlib>',
    location: STDLIB_LOC,
    packageName: 'global',
    superClass: opts.superClass,
    interfaces: opts.interfaces || [],
    isAbstract: opts.isAbstract,
  };
}

// =============================================================================
// TypeScript Built-in Types (primitives and special types)
// =============================================================================

/**
 * Primitive and special built-in type names.
 * These are recognized as stdlib types without any import.
 */
export const TYPESCRIPT_BUILTIN_TYPES = new Set([
  // Primitive types
  'string',
  'number',
  'boolean',
  'symbol',
  'bigint',
  'undefined',
  'null',
  'void',
  'never',
  'unknown',
  'any',
  'object',
]);

// =============================================================================
// TypeScript Stdlib Classes (global constructors and interfaces)
// =============================================================================

export const TYPESCRIPT_STDLIB_CLASSES: ReadonlyMap<string, ClassSymbol> = new Map([
  // Core Object types
  ['Object', cls('Object', 'Object', 'class')],
  ['Function', cls('Function', 'Function', 'class')],
  ['Boolean', cls('Boolean', 'Boolean', 'class')],
  ['Symbol', cls('Symbol', 'Symbol', 'class')],

  // Number types
  ['Number', cls('Number', 'Number', 'class')],
  ['BigInt', cls('BigInt', 'BigInt', 'class')],
  ['Math', cls('Math', 'Math', 'object')],

  // String types
  ['String', cls('String', 'String', 'class')],
  ['RegExp', cls('RegExp', 'RegExp', 'class')],

  // Collections
  ['Array', cls('Array', 'Array', 'class')],
  ['Map', cls('Map', 'Map', 'class')],
  ['Set', cls('Set', 'Set', 'class')],
  ['WeakMap', cls('WeakMap', 'WeakMap', 'class')],
  ['WeakSet', cls('WeakSet', 'WeakSet', 'class')],

  // Typed Arrays
  ['Int8Array', cls('Int8Array', 'Int8Array', 'class')],
  ['Uint8Array', cls('Uint8Array', 'Uint8Array', 'class')],
  ['Uint8ClampedArray', cls('Uint8ClampedArray', 'Uint8ClampedArray', 'class')],
  ['Int16Array', cls('Int16Array', 'Int16Array', 'class')],
  ['Uint16Array', cls('Uint16Array', 'Uint16Array', 'class')],
  ['Int32Array', cls('Int32Array', 'Int32Array', 'class')],
  ['Uint32Array', cls('Uint32Array', 'Uint32Array', 'class')],
  ['Float32Array', cls('Float32Array', 'Float32Array', 'class')],
  ['Float64Array', cls('Float64Array', 'Float64Array', 'class')],
  ['BigInt64Array', cls('BigInt64Array', 'BigInt64Array', 'class')],
  ['BigUint64Array', cls('BigUint64Array', 'BigUint64Array', 'class')],
  ['ArrayBuffer', cls('ArrayBuffer', 'ArrayBuffer', 'class')],
  ['SharedArrayBuffer', cls('SharedArrayBuffer', 'SharedArrayBuffer', 'class')],
  ['DataView', cls('DataView', 'DataView', 'class')],

  // Async types
  ['Promise', cls('Promise', 'Promise', 'class')],
  ['AsyncIterable', cls('AsyncIterable', 'AsyncIterable', 'interface')],
  ['AsyncIterator', cls('AsyncIterator', 'AsyncIterator', 'interface')],
  ['AsyncIterableIterator', cls('AsyncIterableIterator', 'AsyncIterableIterator', 'interface')],

  // Iterator types
  ['Iterable', cls('Iterable', 'Iterable', 'interface')],
  ['Iterator', cls('Iterator', 'Iterator', 'interface')],
  ['IterableIterator', cls('IterableIterator', 'IterableIterator', 'interface')],
  ['Generator', cls('Generator', 'Generator', 'interface')],
  ['AsyncGenerator', cls('AsyncGenerator', 'AsyncGenerator', 'interface')],

  // Error types
  ['Error', cls('Error', 'Error', 'class')],
  ['EvalError', cls('EvalError', 'EvalError', 'class', { superClass: 'Error' })],
  ['RangeError', cls('RangeError', 'RangeError', 'class', { superClass: 'Error' })],
  ['ReferenceError', cls('ReferenceError', 'ReferenceError', 'class', { superClass: 'Error' })],
  ['SyntaxError', cls('SyntaxError', 'SyntaxError', 'class', { superClass: 'Error' })],
  ['TypeError', cls('TypeError', 'TypeError', 'class', { superClass: 'Error' })],
  ['URIError', cls('URIError', 'URIError', 'class', { superClass: 'Error' })],
  ['AggregateError', cls('AggregateError', 'AggregateError', 'class', { superClass: 'Error' })],

  // Date
  ['Date', cls('Date', 'Date', 'class')],

  // JSON
  ['JSON', cls('JSON', 'JSON', 'object')],

  // Console
  ['Console', cls('Console', 'Console', 'interface')],

  // Reflect and Proxy
  ['Reflect', cls('Reflect', 'Reflect', 'object')],
  ['Proxy', cls('Proxy', 'Proxy', 'class')],

  // Intl
  ['Intl', cls('Intl', 'Intl', 'object')],

  // TypeScript utility types (treated as interfaces)
  ['Partial', cls('Partial', 'Partial', 'interface')],
  ['Required', cls('Required', 'Required', 'interface')],
  ['Readonly', cls('Readonly', 'Readonly', 'interface')],
  ['Record', cls('Record', 'Record', 'interface')],
  ['Pick', cls('Pick', 'Pick', 'interface')],
  ['Omit', cls('Omit', 'Omit', 'interface')],
  ['Exclude', cls('Exclude', 'Exclude', 'interface')],
  ['Extract', cls('Extract', 'Extract', 'interface')],
  ['NonNullable', cls('NonNullable', 'NonNullable', 'interface')],
  ['Parameters', cls('Parameters', 'Parameters', 'interface')],
  ['ConstructorParameters', cls('ConstructorParameters', 'ConstructorParameters', 'interface')],
  ['ReturnType', cls('ReturnType', 'ReturnType', 'interface')],
  ['InstanceType', cls('InstanceType', 'InstanceType', 'interface')],
  ['ThisParameterType', cls('ThisParameterType', 'ThisParameterType', 'interface')],
  ['OmitThisParameter', cls('OmitThisParameter', 'OmitThisParameter', 'interface')],
  ['ThisType', cls('ThisType', 'ThisType', 'interface')],
  ['Awaited', cls('Awaited', 'Awaited', 'interface')],
  ['Uppercase', cls('Uppercase', 'Uppercase', 'interface')],
  ['Lowercase', cls('Lowercase', 'Lowercase', 'interface')],
  ['Capitalize', cls('Capitalize', 'Capitalize', 'interface')],
  ['Uncapitalize', cls('Uncapitalize', 'Uncapitalize', 'interface')],
]);

// =============================================================================
// TypeScript Stdlib Functions (static methods on global objects)
// =============================================================================

export const TYPESCRIPT_STDLIB_FUNCTIONS: ReadonlyMap<string, FunctionSymbol> = new Map([
  // Global functions
  ['parseInt', fn('parseInt', 'parseInt', { parameterTypes: ['string', 'number?'], returnType: 'number' })],
  ['parseFloat', fn('parseFloat', 'parseFloat', { parameterTypes: ['string'], returnType: 'number' })],
  ['isNaN', fn('isNaN', 'isNaN', { parameterTypes: ['number'], returnType: 'boolean' })],
  ['isFinite', fn('isFinite', 'isFinite', { parameterTypes: ['number'], returnType: 'boolean' })],
  ['encodeURI', fn('encodeURI', 'encodeURI', { parameterTypes: ['string'], returnType: 'string' })],
  ['encodeURIComponent', fn('encodeURIComponent', 'encodeURIComponent', { parameterTypes: ['string'], returnType: 'string' })],
  ['decodeURI', fn('decodeURI', 'decodeURI', { parameterTypes: ['string'], returnType: 'string' })],
  ['decodeURIComponent', fn('decodeURIComponent', 'decodeURIComponent', { parameterTypes: ['string'], returnType: 'string' })],
  ['eval', fn('eval', 'eval', { parameterTypes: ['string'], returnType: 'any' })],

  // console methods
  ['console.log', fn('log', 'console.log', { declaringTypeFqn: 'Console', parameterTypes: ['...any[]'], returnType: 'void' })],
  ['console.error', fn('error', 'console.error', { declaringTypeFqn: 'Console', parameterTypes: ['...any[]'], returnType: 'void' })],
  ['console.warn', fn('warn', 'console.warn', { declaringTypeFqn: 'Console', parameterTypes: ['...any[]'], returnType: 'void' })],
  ['console.info', fn('info', 'console.info', { declaringTypeFqn: 'Console', parameterTypes: ['...any[]'], returnType: 'void' })],
  ['console.debug', fn('debug', 'console.debug', { declaringTypeFqn: 'Console', parameterTypes: ['...any[]'], returnType: 'void' })],
  ['console.trace', fn('trace', 'console.trace', { declaringTypeFqn: 'Console', parameterTypes: ['...any[]'], returnType: 'void' })],
  ['console.dir', fn('dir', 'console.dir', { declaringTypeFqn: 'Console', parameterTypes: ['any', 'object?'], returnType: 'void' })],
  ['console.table', fn('table', 'console.table', { declaringTypeFqn: 'Console', parameterTypes: ['any', 'string[]?'], returnType: 'void' })],
  ['console.time', fn('time', 'console.time', { declaringTypeFqn: 'Console', parameterTypes: ['string?'], returnType: 'void' })],
  ['console.timeEnd', fn('timeEnd', 'console.timeEnd', { declaringTypeFqn: 'Console', parameterTypes: ['string?'], returnType: 'void' })],
  ['console.assert', fn('assert', 'console.assert', { declaringTypeFqn: 'Console', parameterTypes: ['boolean?', '...any[]'], returnType: 'void' })],
  ['console.clear', fn('clear', 'console.clear', { declaringTypeFqn: 'Console', parameterTypes: [], returnType: 'void' })],

  // Array static methods
  ['Array.isArray', fn('isArray', 'Array.isArray', { declaringTypeFqn: 'Array', parameterTypes: ['any'], returnType: 'boolean' })],
  ['Array.from', fn('from', 'Array.from', { declaringTypeFqn: 'Array', parameterTypes: ['ArrayLike<T>', '((v: T, k: number) => U)?'], returnType: 'U[]' })],
  ['Array.of', fn('of', 'Array.of', { declaringTypeFqn: 'Array', parameterTypes: ['...T[]'], returnType: 'T[]' })],

  // Object static methods
  ['Object.keys', fn('keys', 'Object.keys', { declaringTypeFqn: 'Object', parameterTypes: ['object'], returnType: 'string[]' })],
  ['Object.values', fn('values', 'Object.values', { declaringTypeFqn: 'Object', parameterTypes: ['object'], returnType: 'any[]' })],
  ['Object.entries', fn('entries', 'Object.entries', { declaringTypeFqn: 'Object', parameterTypes: ['object'], returnType: '[string, any][]' })],
  ['Object.assign', fn('assign', 'Object.assign', { declaringTypeFqn: 'Object', parameterTypes: ['T', '...U[]'], returnType: 'T & U' })],
  ['Object.freeze', fn('freeze', 'Object.freeze', { declaringTypeFqn: 'Object', parameterTypes: ['T'], returnType: 'Readonly<T>' })],
  ['Object.seal', fn('seal', 'Object.seal', { declaringTypeFqn: 'Object', parameterTypes: ['T'], returnType: 'T' })],
  ['Object.create', fn('create', 'Object.create', { declaringTypeFqn: 'Object', parameterTypes: ['object | null', 'PropertyDescriptorMap?'], returnType: 'any' })],
  ['Object.defineProperty', fn('defineProperty', 'Object.defineProperty', { declaringTypeFqn: 'Object', parameterTypes: ['T', 'PropertyKey', 'PropertyDescriptor'], returnType: 'T' })],
  ['Object.defineProperties', fn('defineProperties', 'Object.defineProperties', { declaringTypeFqn: 'Object', parameterTypes: ['T', 'PropertyDescriptorMap'], returnType: 'T' })],
  ['Object.getOwnPropertyNames', fn('getOwnPropertyNames', 'Object.getOwnPropertyNames', { declaringTypeFqn: 'Object', parameterTypes: ['any'], returnType: 'string[]' })],
  ['Object.getOwnPropertyDescriptor', fn('getOwnPropertyDescriptor', 'Object.getOwnPropertyDescriptor', { declaringTypeFqn: 'Object', parameterTypes: ['any', 'PropertyKey'], returnType: 'PropertyDescriptor | undefined' })],
  ['Object.getPrototypeOf', fn('getPrototypeOf', 'Object.getPrototypeOf', { declaringTypeFqn: 'Object', parameterTypes: ['any'], returnType: 'any' })],
  ['Object.setPrototypeOf', fn('setPrototypeOf', 'Object.setPrototypeOf', { declaringTypeFqn: 'Object', parameterTypes: ['any', 'object | null'], returnType: 'any' })],
  ['Object.fromEntries', fn('fromEntries', 'Object.fromEntries', { declaringTypeFqn: 'Object', parameterTypes: ['Iterable<readonly [PropertyKey, T]>'], returnType: '{ [k: string]: T }' })],
  ['Object.hasOwn', fn('hasOwn', 'Object.hasOwn', { declaringTypeFqn: 'Object', parameterTypes: ['object', 'PropertyKey'], returnType: 'boolean' })],

  // JSON methods
  ['JSON.parse', fn('parse', 'JSON.parse', { declaringTypeFqn: 'JSON', parameterTypes: ['string', '((key: string, value: any) => any)?'], returnType: 'any' })],
  ['JSON.stringify', fn('stringify', 'JSON.stringify', { declaringTypeFqn: 'JSON', parameterTypes: ['any', '((key: string, value: any) => any)?', 'string | number?'], returnType: 'string' })],

  // Math methods
  ['Math.abs', fn('abs', 'Math.abs', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.ceil', fn('ceil', 'Math.ceil', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.floor', fn('floor', 'Math.floor', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.round', fn('round', 'Math.round', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.max', fn('max', 'Math.max', { declaringTypeFqn: 'Math', parameterTypes: ['...number[]'], returnType: 'number' })],
  ['Math.min', fn('min', 'Math.min', { declaringTypeFqn: 'Math', parameterTypes: ['...number[]'], returnType: 'number' })],
  ['Math.pow', fn('pow', 'Math.pow', { declaringTypeFqn: 'Math', parameterTypes: ['number', 'number'], returnType: 'number' })],
  ['Math.sqrt', fn('sqrt', 'Math.sqrt', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.random', fn('random', 'Math.random', { declaringTypeFqn: 'Math', parameterTypes: [], returnType: 'number' })],
  ['Math.sign', fn('sign', 'Math.sign', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.trunc', fn('trunc', 'Math.trunc', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.log', fn('log', 'Math.log', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.log10', fn('log10', 'Math.log10', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.log2', fn('log2', 'Math.log2', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.exp', fn('exp', 'Math.exp', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.sin', fn('sin', 'Math.sin', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.cos', fn('cos', 'Math.cos', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],
  ['Math.tan', fn('tan', 'Math.tan', { declaringTypeFqn: 'Math', parameterTypes: ['number'], returnType: 'number' })],

  // Number static methods
  ['Number.isInteger', fn('isInteger', 'Number.isInteger', { declaringTypeFqn: 'Number', parameterTypes: ['unknown'], returnType: 'boolean' })],
  ['Number.isNaN', fn('isNaN', 'Number.isNaN', { declaringTypeFqn: 'Number', parameterTypes: ['unknown'], returnType: 'boolean' })],
  ['Number.isFinite', fn('isFinite', 'Number.isFinite', { declaringTypeFqn: 'Number', parameterTypes: ['unknown'], returnType: 'boolean' })],
  ['Number.isSafeInteger', fn('isSafeInteger', 'Number.isSafeInteger', { declaringTypeFqn: 'Number', parameterTypes: ['unknown'], returnType: 'boolean' })],
  ['Number.parseFloat', fn('parseFloat', 'Number.parseFloat', { declaringTypeFqn: 'Number', parameterTypes: ['string'], returnType: 'number' })],
  ['Number.parseInt', fn('parseInt', 'Number.parseInt', { declaringTypeFqn: 'Number', parameterTypes: ['string', 'number?'], returnType: 'number' })],

  // String static methods
  ['String.fromCharCode', fn('fromCharCode', 'String.fromCharCode', { declaringTypeFqn: 'String', parameterTypes: ['...number[]'], returnType: 'string' })],
  ['String.fromCodePoint', fn('fromCodePoint', 'String.fromCodePoint', { declaringTypeFqn: 'String', parameterTypes: ['...number[]'], returnType: 'string' })],
  ['String.raw', fn('raw', 'String.raw', { declaringTypeFqn: 'String', parameterTypes: ['TemplateStringsArray', '...any[]'], returnType: 'string' })],

  // Promise static methods
  ['Promise.resolve', fn('resolve', 'Promise.resolve', { declaringTypeFqn: 'Promise', parameterTypes: ['T | PromiseLike<T>'], returnType: 'Promise<T>' })],
  ['Promise.reject', fn('reject', 'Promise.reject', { declaringTypeFqn: 'Promise', parameterTypes: ['any?'], returnType: 'Promise<never>' })],
  ['Promise.all', fn('all', 'Promise.all', { declaringTypeFqn: 'Promise', parameterTypes: ['Iterable<T | PromiseLike<T>>'], returnType: 'Promise<T[]>' })],
  ['Promise.allSettled', fn('allSettled', 'Promise.allSettled', { declaringTypeFqn: 'Promise', parameterTypes: ['Iterable<T | PromiseLike<T>>'], returnType: 'Promise<PromiseSettledResult<T>[]>' })],
  ['Promise.race', fn('race', 'Promise.race', { declaringTypeFqn: 'Promise', parameterTypes: ['Iterable<T | PromiseLike<T>>'], returnType: 'Promise<T>' })],
  ['Promise.any', fn('any', 'Promise.any', { declaringTypeFqn: 'Promise', parameterTypes: ['Iterable<T | PromiseLike<T>>'], returnType: 'Promise<T>' })],

  // Date static methods
  ['Date.now', fn('now', 'Date.now', { declaringTypeFqn: 'Date', parameterTypes: [], returnType: 'number' })],
  ['Date.parse', fn('parse', 'Date.parse', { declaringTypeFqn: 'Date', parameterTypes: ['string'], returnType: 'number' })],
  ['Date.UTC', fn('UTC', 'Date.UTC', { declaringTypeFqn: 'Date', parameterTypes: ['number', 'number?', 'number?', 'number?', 'number?', 'number?', 'number?'], returnType: 'number' })],

  // Symbol methods
  ['Symbol.for', fn('for', 'Symbol.for', { declaringTypeFqn: 'Symbol', parameterTypes: ['string'], returnType: 'symbol' })],
  ['Symbol.keyFor', fn('keyFor', 'Symbol.keyFor', { declaringTypeFqn: 'Symbol', parameterTypes: ['symbol'], returnType: 'string | undefined' })],

  // Reflect methods
  ['Reflect.get', fn('get', 'Reflect.get', { declaringTypeFqn: 'Reflect', parameterTypes: ['object', 'PropertyKey', 'any?'], returnType: 'any' })],
  ['Reflect.set', fn('set', 'Reflect.set', { declaringTypeFqn: 'Reflect', parameterTypes: ['object', 'PropertyKey', 'any', 'any?'], returnType: 'boolean' })],
  ['Reflect.has', fn('has', 'Reflect.has', { declaringTypeFqn: 'Reflect', parameterTypes: ['object', 'PropertyKey'], returnType: 'boolean' })],
  ['Reflect.deleteProperty', fn('deleteProperty', 'Reflect.deleteProperty', { declaringTypeFqn: 'Reflect', parameterTypes: ['object', 'PropertyKey'], returnType: 'boolean' })],
  ['Reflect.apply', fn('apply', 'Reflect.apply', { declaringTypeFqn: 'Reflect', parameterTypes: ['Function', 'any', 'ArrayLike<any>'], returnType: 'any' })],
  ['Reflect.construct', fn('construct', 'Reflect.construct', { declaringTypeFqn: 'Reflect', parameterTypes: ['Function', 'ArrayLike<any>', 'Function?'], returnType: 'object' })],
  ['Reflect.ownKeys', fn('ownKeys', 'Reflect.ownKeys', { declaringTypeFqn: 'Reflect', parameterTypes: ['object'], returnType: '(string | symbol)[]' })],
]);

// =============================================================================
// TypeScript Stdlib Instance Methods (commonly called on built-in types)
// =============================================================================

export const TYPESCRIPT_STDLIB_INSTANCE_METHODS: ReadonlyMap<string, FunctionSymbol> = new Map([
  // Array instance methods
  ['Array.map', fn('map', 'Array.prototype.map', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, array: T[]) => U', 'any?'], returnType: 'U[]' })],
  ['Array.filter', fn('filter', 'Array.prototype.filter', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, array: T[]) => boolean', 'any?'], returnType: 'T[]' })],
  ['Array.reduce', fn('reduce', 'Array.prototype.reduce', { declaringTypeFqn: 'Array', parameterTypes: ['(prev: U, curr: T, index: number, array: T[]) => U', 'U?'], returnType: 'U' })],
  ['Array.reduceRight', fn('reduceRight', 'Array.prototype.reduceRight', { declaringTypeFqn: 'Array', parameterTypes: ['(prev: U, curr: T, index: number, array: T[]) => U', 'U?'], returnType: 'U' })],
  ['Array.forEach', fn('forEach', 'Array.prototype.forEach', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, array: T[]) => void', 'any?'], returnType: 'void' })],
  ['Array.find', fn('find', 'Array.prototype.find', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, obj: T[]) => boolean', 'any?'], returnType: 'T | undefined' })],
  ['Array.findIndex', fn('findIndex', 'Array.prototype.findIndex', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, obj: T[]) => boolean', 'any?'], returnType: 'number' })],
  ['Array.findLast', fn('findLast', 'Array.prototype.findLast', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, obj: T[]) => boolean', 'any?'], returnType: 'T | undefined' })],
  ['Array.findLastIndex', fn('findLastIndex', 'Array.prototype.findLastIndex', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, obj: T[]) => boolean', 'any?'], returnType: 'number' })],
  ['Array.some', fn('some', 'Array.prototype.some', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, array: T[]) => boolean', 'any?'], returnType: 'boolean' })],
  ['Array.every', fn('every', 'Array.prototype.every', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, array: T[]) => boolean', 'any?'], returnType: 'boolean' })],
  ['Array.includes', fn('includes', 'Array.prototype.includes', { declaringTypeFqn: 'Array', parameterTypes: ['T', 'number?'], returnType: 'boolean' })],
  ['Array.indexOf', fn('indexOf', 'Array.prototype.indexOf', { declaringTypeFqn: 'Array', parameterTypes: ['T', 'number?'], returnType: 'number' })],
  ['Array.lastIndexOf', fn('lastIndexOf', 'Array.prototype.lastIndexOf', { declaringTypeFqn: 'Array', parameterTypes: ['T', 'number?'], returnType: 'number' })],
  ['Array.join', fn('join', 'Array.prototype.join', { declaringTypeFqn: 'Array', parameterTypes: ['string?'], returnType: 'string' })],
  ['Array.concat', fn('concat', 'Array.prototype.concat', { declaringTypeFqn: 'Array', parameterTypes: ['...(T | ConcatArray<T>)[]'], returnType: 'T[]' })],
  ['Array.slice', fn('slice', 'Array.prototype.slice', { declaringTypeFqn: 'Array', parameterTypes: ['number?', 'number?'], returnType: 'T[]' })],
  ['Array.splice', fn('splice', 'Array.prototype.splice', { declaringTypeFqn: 'Array', parameterTypes: ['number', 'number?', '...T[]'], returnType: 'T[]' })],
  ['Array.push', fn('push', 'Array.prototype.push', { declaringTypeFqn: 'Array', parameterTypes: ['...T[]'], returnType: 'number' })],
  ['Array.pop', fn('pop', 'Array.prototype.pop', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'T | undefined' })],
  ['Array.shift', fn('shift', 'Array.prototype.shift', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'T | undefined' })],
  ['Array.unshift', fn('unshift', 'Array.prototype.unshift', { declaringTypeFqn: 'Array', parameterTypes: ['...T[]'], returnType: 'number' })],
  ['Array.sort', fn('sort', 'Array.prototype.sort', { declaringTypeFqn: 'Array', parameterTypes: ['((a: T, b: T) => number)?'], returnType: 'T[]' })],
  ['Array.reverse', fn('reverse', 'Array.prototype.reverse', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'T[]' })],
  ['Array.flat', fn('flat', 'Array.prototype.flat', { declaringTypeFqn: 'Array', parameterTypes: ['number?'], returnType: 'FlatArray<T, D>[]' })],
  ['Array.flatMap', fn('flatMap', 'Array.prototype.flatMap', { declaringTypeFqn: 'Array', parameterTypes: ['(value: T, index: number, array: T[]) => U | ReadonlyArray<U>', 'any?'], returnType: 'U[]' })],
  ['Array.fill', fn('fill', 'Array.prototype.fill', { declaringTypeFqn: 'Array', parameterTypes: ['T', 'number?', 'number?'], returnType: 'T[]' })],
  ['Array.copyWithin', fn('copyWithin', 'Array.prototype.copyWithin', { declaringTypeFqn: 'Array', parameterTypes: ['number', 'number', 'number?'], returnType: 'T[]' })],
  ['Array.entries', fn('entries', 'Array.prototype.entries', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'IterableIterator<[number, T]>' })],
  ['Array.keys', fn('keys', 'Array.prototype.keys', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'IterableIterator<number>' })],
  ['Array.values', fn('values', 'Array.prototype.values', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'IterableIterator<T>' })],
  ['Array.at', fn('at', 'Array.prototype.at', { declaringTypeFqn: 'Array', parameterTypes: ['number'], returnType: 'T | undefined' })],
  ['Array.toReversed', fn('toReversed', 'Array.prototype.toReversed', { declaringTypeFqn: 'Array', parameterTypes: [], returnType: 'T[]' })],
  ['Array.toSorted', fn('toSorted', 'Array.prototype.toSorted', { declaringTypeFqn: 'Array', parameterTypes: ['((a: T, b: T) => number)?'], returnType: 'T[]' })],
  ['Array.toSpliced', fn('toSpliced', 'Array.prototype.toSpliced', { declaringTypeFqn: 'Array', parameterTypes: ['number', 'number?', '...T[]'], returnType: 'T[]' })],
  ['Array.with', fn('with', 'Array.prototype.with', { declaringTypeFqn: 'Array', parameterTypes: ['number', 'T'], returnType: 'T[]' })],

  // String instance methods
  ['String.charAt', fn('charAt', 'String.prototype.charAt', { declaringTypeFqn: 'String', parameterTypes: ['number'], returnType: 'string' })],
  ['String.charCodeAt', fn('charCodeAt', 'String.prototype.charCodeAt', { declaringTypeFqn: 'String', parameterTypes: ['number'], returnType: 'number' })],
  ['String.codePointAt', fn('codePointAt', 'String.prototype.codePointAt', { declaringTypeFqn: 'String', parameterTypes: ['number'], returnType: 'number | undefined' })],
  ['String.concat', fn('concat', 'String.prototype.concat', { declaringTypeFqn: 'String', parameterTypes: ['...string[]'], returnType: 'string' })],
  ['String.includes', fn('includes', 'String.prototype.includes', { declaringTypeFqn: 'String', parameterTypes: ['string', 'number?'], returnType: 'boolean' })],
  ['String.startsWith', fn('startsWith', 'String.prototype.startsWith', { declaringTypeFqn: 'String', parameterTypes: ['string', 'number?'], returnType: 'boolean' })],
  ['String.endsWith', fn('endsWith', 'String.prototype.endsWith', { declaringTypeFqn: 'String', parameterTypes: ['string', 'number?'], returnType: 'boolean' })],
  ['String.indexOf', fn('indexOf', 'String.prototype.indexOf', { declaringTypeFqn: 'String', parameterTypes: ['string', 'number?'], returnType: 'number' })],
  ['String.lastIndexOf', fn('lastIndexOf', 'String.prototype.lastIndexOf', { declaringTypeFqn: 'String', parameterTypes: ['string', 'number?'], returnType: 'number' })],
  ['String.match', fn('match', 'String.prototype.match', { declaringTypeFqn: 'String', parameterTypes: ['string | RegExp'], returnType: 'RegExpMatchArray | null' })],
  ['String.matchAll', fn('matchAll', 'String.prototype.matchAll', { declaringTypeFqn: 'String', parameterTypes: ['RegExp'], returnType: 'IterableIterator<RegExpMatchArray>' })],
  ['String.replace', fn('replace', 'String.prototype.replace', { declaringTypeFqn: 'String', parameterTypes: ['string | RegExp', 'string | ((substring: string, ...args: any[]) => string)'], returnType: 'string' })],
  ['String.replaceAll', fn('replaceAll', 'String.prototype.replaceAll', { declaringTypeFqn: 'String', parameterTypes: ['string | RegExp', 'string | ((substring: string, ...args: any[]) => string)'], returnType: 'string' })],
  ['String.search', fn('search', 'String.prototype.search', { declaringTypeFqn: 'String', parameterTypes: ['string | RegExp'], returnType: 'number' })],
  ['String.slice', fn('slice', 'String.prototype.slice', { declaringTypeFqn: 'String', parameterTypes: ['number?', 'number?'], returnType: 'string' })],
  ['String.split', fn('split', 'String.prototype.split', { declaringTypeFqn: 'String', parameterTypes: ['string | RegExp', 'number?'], returnType: 'string[]' })],
  ['String.substring', fn('substring', 'String.prototype.substring', { declaringTypeFqn: 'String', parameterTypes: ['number', 'number?'], returnType: 'string' })],
  ['String.toLowerCase', fn('toLowerCase', 'String.prototype.toLowerCase', { declaringTypeFqn: 'String', parameterTypes: [], returnType: 'string' })],
  ['String.toUpperCase', fn('toUpperCase', 'String.prototype.toUpperCase', { declaringTypeFqn: 'String', parameterTypes: [], returnType: 'string' })],
  ['String.toLocaleLowerCase', fn('toLocaleLowerCase', 'String.prototype.toLocaleLowerCase', { declaringTypeFqn: 'String', parameterTypes: ['string | string[]?'], returnType: 'string' })],
  ['String.toLocaleUpperCase', fn('toLocaleUpperCase', 'String.prototype.toLocaleUpperCase', { declaringTypeFqn: 'String', parameterTypes: ['string | string[]?'], returnType: 'string' })],
  ['String.trim', fn('trim', 'String.prototype.trim', { declaringTypeFqn: 'String', parameterTypes: [], returnType: 'string' })],
  ['String.trimStart', fn('trimStart', 'String.prototype.trimStart', { declaringTypeFqn: 'String', parameterTypes: [], returnType: 'string' })],
  ['String.trimEnd', fn('trimEnd', 'String.prototype.trimEnd', { declaringTypeFqn: 'String', parameterTypes: [], returnType: 'string' })],
  ['String.padStart', fn('padStart', 'String.prototype.padStart', { declaringTypeFqn: 'String', parameterTypes: ['number', 'string?'], returnType: 'string' })],
  ['String.padEnd', fn('padEnd', 'String.prototype.padEnd', { declaringTypeFqn: 'String', parameterTypes: ['number', 'string?'], returnType: 'string' })],
  ['String.repeat', fn('repeat', 'String.prototype.repeat', { declaringTypeFqn: 'String', parameterTypes: ['number'], returnType: 'string' })],
  ['String.normalize', fn('normalize', 'String.prototype.normalize', { declaringTypeFqn: 'String', parameterTypes: ['string?'], returnType: 'string' })],
  ['String.at', fn('at', 'String.prototype.at', { declaringTypeFqn: 'String', parameterTypes: ['number'], returnType: 'string | undefined' })],

  // Promise instance methods
  ['Promise.then', fn('then', 'Promise.prototype.then', { declaringTypeFqn: 'Promise', parameterTypes: ['((value: T) => TResult1 | PromiseLike<TResult1>)?', '((reason: any) => TResult2 | PromiseLike<TResult2>)?'], returnType: 'Promise<TResult1 | TResult2>' })],
  ['Promise.catch', fn('catch', 'Promise.prototype.catch', { declaringTypeFqn: 'Promise', parameterTypes: ['((reason: any) => TResult | PromiseLike<TResult>)?'], returnType: 'Promise<T | TResult>' })],
  ['Promise.finally', fn('finally', 'Promise.prototype.finally', { declaringTypeFqn: 'Promise', parameterTypes: ['(() => void)?'], returnType: 'Promise<T>' })],

  // Map instance methods
  ['Map.get', fn('get', 'Map.prototype.get', { declaringTypeFqn: 'Map', parameterTypes: ['K'], returnType: 'V | undefined' })],
  ['Map.set', fn('set', 'Map.prototype.set', { declaringTypeFqn: 'Map', parameterTypes: ['K', 'V'], returnType: 'Map<K, V>' })],
  ['Map.has', fn('has', 'Map.prototype.has', { declaringTypeFqn: 'Map', parameterTypes: ['K'], returnType: 'boolean' })],
  ['Map.delete', fn('delete', 'Map.prototype.delete', { declaringTypeFqn: 'Map', parameterTypes: ['K'], returnType: 'boolean' })],
  ['Map.clear', fn('clear', 'Map.prototype.clear', { declaringTypeFqn: 'Map', parameterTypes: [], returnType: 'void' })],
  ['Map.forEach', fn('forEach', 'Map.prototype.forEach', { declaringTypeFqn: 'Map', parameterTypes: ['(value: V, key: K, map: Map<K, V>) => void', 'any?'], returnType: 'void' })],
  ['Map.keys', fn('keys', 'Map.prototype.keys', { declaringTypeFqn: 'Map', parameterTypes: [], returnType: 'IterableIterator<K>' })],
  ['Map.values', fn('values', 'Map.prototype.values', { declaringTypeFqn: 'Map', parameterTypes: [], returnType: 'IterableIterator<V>' })],
  ['Map.entries', fn('entries', 'Map.prototype.entries', { declaringTypeFqn: 'Map', parameterTypes: [], returnType: 'IterableIterator<[K, V]>' })],

  // Set instance methods
  ['Set.add', fn('add', 'Set.prototype.add', { declaringTypeFqn: 'Set', parameterTypes: ['T'], returnType: 'Set<T>' })],
  ['Set.has', fn('has', 'Set.prototype.has', { declaringTypeFqn: 'Set', parameterTypes: ['T'], returnType: 'boolean' })],
  ['Set.delete', fn('delete', 'Set.prototype.delete', { declaringTypeFqn: 'Set', parameterTypes: ['T'], returnType: 'boolean' })],
  ['Set.clear', fn('clear', 'Set.prototype.clear', { declaringTypeFqn: 'Set', parameterTypes: [], returnType: 'void' })],
  ['Set.forEach', fn('forEach', 'Set.prototype.forEach', { declaringTypeFqn: 'Set', parameterTypes: ['(value: T, value2: T, set: Set<T>) => void', 'any?'], returnType: 'void' })],
  ['Set.keys', fn('keys', 'Set.prototype.keys', { declaringTypeFqn: 'Set', parameterTypes: [], returnType: 'IterableIterator<T>' })],
  ['Set.values', fn('values', 'Set.prototype.values', { declaringTypeFqn: 'Set', parameterTypes: [], returnType: 'IterableIterator<T>' })],
  ['Set.entries', fn('entries', 'Set.prototype.entries', { declaringTypeFqn: 'Set', parameterTypes: [], returnType: 'IterableIterator<[T, T]>' })],
]);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all TypeScript stdlib symbols (functions + classes) as a single map.
 */
export function getTypescriptStdlibSymbols(): Map<string, Symbol> {
  const result = new Map<string, Symbol>();

  for (const [name, func] of TYPESCRIPT_STDLIB_FUNCTIONS) {
    result.set(name, func);
  }

  for (const [name, func] of TYPESCRIPT_STDLIB_INSTANCE_METHODS) {
    result.set(name, func);
  }

  for (const [name, clsSymbol] of TYPESCRIPT_STDLIB_CLASSES) {
    result.set(name, clsSymbol);
  }

  return result;
}

/**
 * Lookup a TypeScript stdlib function by name.
 */
export function lookupTypescriptStdlibFunction(name: string): FunctionSymbol | undefined {
  return TYPESCRIPT_STDLIB_FUNCTIONS.get(name);
}

/**
 * Lookup a TypeScript stdlib class by name.
 */
export function lookupTypescriptStdlibClass(name: string): ClassSymbol | undefined {
  return TYPESCRIPT_STDLIB_CLASSES.get(name);
}

/**
 * Check if a name is a known TypeScript stdlib symbol.
 */
export function isTypescriptStdlibSymbol(name: string): boolean {
  return (
    TYPESCRIPT_BUILTIN_TYPES.has(name) ||
    TYPESCRIPT_STDLIB_CLASSES.has(name) ||
    TYPESCRIPT_STDLIB_FUNCTIONS.has(name) ||
    TYPESCRIPT_STDLIB_INSTANCE_METHODS.has(name)
  );
}

/**
 * Check if a type is a TypeScript built-in primitive type.
 */
export function isTypescriptBuiltinType(typeName: string): boolean {
  return TYPESCRIPT_BUILTIN_TYPES.has(typeName);
}

// =============================================================================
// TypeScript Stdlib Provider (implements StdlibProvider interface)
// =============================================================================

/**
 * StdlibProvider implementation for TypeScript.
 * Provides access to TypeScript/JavaScript stdlib for symbol resolution.
 */
export class TypescriptStdlibProvider implements StdlibProvider {
  readonly languages: readonly SupportedLanguage[] = ['typescript', 'javascript'];

  // TypeScript/JavaScript don't have implicit wildcard imports
  readonly defaultWildcardImports: readonly string[] = [];

  lookupFunction(name: string): FunctionSymbol | undefined {
    // Check global functions first
    return TYPESCRIPT_STDLIB_FUNCTIONS.get(name);
  }

  lookupClass(name: string): ClassSymbol | undefined {
    return TYPESCRIPT_STDLIB_CLASSES.get(name);
  }

  lookupStaticMethod(qualifiedName: string): FunctionSymbol | undefined {
    // Check static methods like Array.isArray, Object.keys
    const staticMethod = TYPESCRIPT_STDLIB_FUNCTIONS.get(qualifiedName);
    if (staticMethod) {
      return staticMethod;
    }

    // Check instance methods like Array.map, Promise.then
    return TYPESCRIPT_STDLIB_INSTANCE_METHODS.get(qualifiedName);
  }

  isKnownSymbol(name: string): boolean {
    return isTypescriptStdlibSymbol(name);
  }

  getAllSymbols(): Map<string, Symbol> {
    return getTypescriptStdlibSymbols();
  }

  /**
   * Check if a type name is a built-in primitive type.
   */
  isBuiltinType(typeName: string): boolean {
    return TYPESCRIPT_BUILTIN_TYPES.has(typeName);
  }
}
