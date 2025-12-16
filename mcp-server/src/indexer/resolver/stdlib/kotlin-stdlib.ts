/**
 * Kotlin Standard Library symbols for resolution.
 *
 * These are implicitly imported in every Kotlin file and need to be
 * recognized by the resolver even though they're not in the project sources.
 *
 * Reference: https://kotlinlang.org/api/latest/jvm/stdlib/
 */

import type { FunctionSymbol, ClassSymbol, Symbol } from '../types.js';
import type { StdlibProvider } from './stdlib-provider.js';
import type { SupportedLanguage } from '../../types.js';

// Stdlib location placeholder
const STDLIB_LOC = {
  filePath: '<kotlin-stdlib>',
  startLine: 0,
  startColumn: 0,
  endLine: 0,
  endColumn: 0,
};

// Helper to create a function symbol with correct types
function fn(
  name: string,
  fqn: string,
  packageName: string,
  opts: {
    parameterTypes?: string[];
    returnType?: string;
    isExtension?: boolean;
    receiverType?: string;
    isOperator?: boolean;
    isInfix?: boolean;
    declaringTypeFqn?: string;
  } = {}
): FunctionSymbol {
  return {
    name,
    fqn,
    kind: 'function',
    filePath: '<kotlin-stdlib>',
    location: STDLIB_LOC,
    packageName,
    parameterTypes: opts.parameterTypes || [],
    returnType: opts.returnType,
    isExtension: opts.isExtension || false,
    receiverType: opts.receiverType,
    isOperator: opts.isOperator,
    isInfix: opts.isInfix,
    declaringTypeFqn: opts.declaringTypeFqn,
  };
}

// Helper to create a class symbol with correct types
function cls(
  name: string,
  fqn: string,
  packageName: string,
  kind: 'class' | 'interface' | 'object' | 'enum' = 'class',
  opts: {
    superClass?: string;
    interfaces?: string[];
    isData?: boolean;
    isSealed?: boolean;
    isAbstract?: boolean;
  } = {}
): ClassSymbol {
  return {
    name,
    fqn,
    kind,
    filePath: '<kotlin-stdlib>',
    location: STDLIB_LOC,
    packageName,
    superClass: opts.superClass,
    interfaces: opts.interfaces || [],
    isData: opts.isData,
    isSealed: opts.isSealed,
    isAbstract: opts.isAbstract,
  };
}

// =============================================================================
// Kotlin Stdlib Functions
// =============================================================================

/**
 * Top-level functions from kotlin-stdlib that are implicitly available.
 */
export const KOTLIN_STDLIB_FUNCTIONS: ReadonlyMap<string, FunctionSymbol> = new Map([
  // ---------------------------------------------------------------------------
  // kotlin (root package) - Scope functions & utilities
  // ---------------------------------------------------------------------------
  ['let', fn('let', 'kotlin.let', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: ['(T) -> R'], returnType: 'R' })],
  ['run', fn('run', 'kotlin.run', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: ['T.() -> R'], returnType: 'R' })],
  ['with', fn('with', 'kotlin.with', 'kotlin', { parameterTypes: ['T', 'T.() -> R'], returnType: 'R' })],
  ['apply', fn('apply', 'kotlin.apply', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: ['T.() -> Unit'], returnType: 'T' })],
  ['also', fn('also', 'kotlin.also', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: ['(T) -> Unit'], returnType: 'T' })],
  ['takeIf', fn('takeIf', 'kotlin.takeIf', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: ['(T) -> Boolean'], returnType: 'T?' })],
  ['takeUnless', fn('takeUnless', 'kotlin.takeUnless', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: ['(T) -> Boolean'], returnType: 'T?' })],
  ['repeat', fn('repeat', 'kotlin.repeat', 'kotlin', { parameterTypes: ['Int', '(Int) -> Unit'], returnType: 'Unit' })],
  ['TODO', fn('TODO', 'kotlin.TODO', 'kotlin', { parameterTypes: ['String'], returnType: 'Nothing' })],
  ['error', fn('error', 'kotlin.error', 'kotlin', { parameterTypes: ['Any'], returnType: 'Nothing' })],
  ['require', fn('require', 'kotlin.require', 'kotlin', { parameterTypes: ['Boolean'], returnType: 'Unit' })],
  ['requireNotNull', fn('requireNotNull', 'kotlin.requireNotNull', 'kotlin', { parameterTypes: ['T?'], returnType: 'T' })],
  ['check', fn('check', 'kotlin.check', 'kotlin', { parameterTypes: ['Boolean'], returnType: 'Unit' })],
  ['checkNotNull', fn('checkNotNull', 'kotlin.checkNotNull', 'kotlin', { parameterTypes: ['T?'], returnType: 'T' })],
  ['println', fn('println', 'kotlin.io.println', 'kotlin.io', { parameterTypes: ['Any?'], returnType: 'Unit' })],
  ['print', fn('print', 'kotlin.io.print', 'kotlin.io', { parameterTypes: ['Any?'], returnType: 'Unit' })],
  ['readLine', fn('readLine', 'kotlin.io.readLine', 'kotlin.io', { parameterTypes: [], returnType: 'String?' })],
  ['to', fn('to', 'kotlin.to', 'kotlin', { isExtension: true, isInfix: true, receiverType: 'A', parameterTypes: ['B'], returnType: 'Pair<A, B>' })],
  ['lazy', fn('lazy', 'kotlin.lazy', 'kotlin', { parameterTypes: ['() -> T'], returnType: 'Lazy<T>' })],

  // Arrays
  ['arrayOf', fn('arrayOf', 'kotlin.arrayOf', 'kotlin', { parameterTypes: ['vararg T'], returnType: 'Array<T>' })],
  ['arrayOfNulls', fn('arrayOfNulls', 'kotlin.arrayOfNulls', 'kotlin', { parameterTypes: ['Int'], returnType: 'Array<T?>' })],
  ['emptyArray', fn('emptyArray', 'kotlin.emptyArray', 'kotlin', { parameterTypes: [], returnType: 'Array<T>' })],
  ['intArrayOf', fn('intArrayOf', 'kotlin.intArrayOf', 'kotlin', { parameterTypes: ['vararg Int'], returnType: 'IntArray' })],
  ['longArrayOf', fn('longArrayOf', 'kotlin.longArrayOf', 'kotlin', { parameterTypes: ['vararg Long'], returnType: 'LongArray' })],
  ['doubleArrayOf', fn('doubleArrayOf', 'kotlin.doubleArrayOf', 'kotlin', { parameterTypes: ['vararg Double'], returnType: 'DoubleArray' })],
  ['booleanArrayOf', fn('booleanArrayOf', 'kotlin.booleanArrayOf', 'kotlin', { parameterTypes: ['vararg Boolean'], returnType: 'BooleanArray' })],
  ['charArrayOf', fn('charArrayOf', 'kotlin.charArrayOf', 'kotlin', { parameterTypes: ['vararg Char'], returnType: 'CharArray' })],
  ['byteArrayOf', fn('byteArrayOf', 'kotlin.byteArrayOf', 'kotlin', { parameterTypes: ['vararg Byte'], returnType: 'ByteArray' })],

  // ---------------------------------------------------------------------------
  // kotlin.collections - Collection factory functions
  // ---------------------------------------------------------------------------
  ['listOf', fn('listOf', 'kotlin.collections.listOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'List<T>' })],
  ['listOfNotNull', fn('listOfNotNull', 'kotlin.collections.listOfNotNull', 'kotlin.collections', { parameterTypes: ['vararg T?'], returnType: 'List<T>' })],
  ['mutableListOf', fn('mutableListOf', 'kotlin.collections.mutableListOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'MutableList<T>' })],
  ['arrayListOf', fn('arrayListOf', 'kotlin.collections.arrayListOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'ArrayList<T>' })],
  ['emptyList', fn('emptyList', 'kotlin.collections.emptyList', 'kotlin.collections', { parameterTypes: [], returnType: 'List<T>' })],
  ['setOf', fn('setOf', 'kotlin.collections.setOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'Set<T>' })],
  ['mutableSetOf', fn('mutableSetOf', 'kotlin.collections.mutableSetOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'MutableSet<T>' })],
  ['hashSetOf', fn('hashSetOf', 'kotlin.collections.hashSetOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'HashSet<T>' })],
  ['linkedSetOf', fn('linkedSetOf', 'kotlin.collections.linkedSetOf', 'kotlin.collections', { parameterTypes: ['vararg T'], returnType: 'LinkedHashSet<T>' })],
  ['emptySet', fn('emptySet', 'kotlin.collections.emptySet', 'kotlin.collections', { parameterTypes: [], returnType: 'Set<T>' })],
  ['mapOf', fn('mapOf', 'kotlin.collections.mapOf', 'kotlin.collections', { parameterTypes: ['vararg Pair<K, V>'], returnType: 'Map<K, V>' })],
  ['mutableMapOf', fn('mutableMapOf', 'kotlin.collections.mutableMapOf', 'kotlin.collections', { parameterTypes: ['vararg Pair<K, V>'], returnType: 'MutableMap<K, V>' })],
  ['hashMapOf', fn('hashMapOf', 'kotlin.collections.hashMapOf', 'kotlin.collections', { parameterTypes: ['vararg Pair<K, V>'], returnType: 'HashMap<K, V>' })],
  ['linkedMapOf', fn('linkedMapOf', 'kotlin.collections.linkedMapOf', 'kotlin.collections', { parameterTypes: ['vararg Pair<K, V>'], returnType: 'LinkedHashMap<K, V>' })],
  ['emptyMap', fn('emptyMap', 'kotlin.collections.emptyMap', 'kotlin.collections', { parameterTypes: [], returnType: 'Map<K, V>' })],

  // ---------------------------------------------------------------------------
  // kotlin.collections - Collection extension functions
  // ---------------------------------------------------------------------------
  ['map', fn('map', 'kotlin.collections.map', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R'], returnType: 'List<R>' })],
  ['mapNotNull', fn('mapNotNull', 'kotlin.collections.mapNotNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R?'], returnType: 'List<R>' })],
  ['mapIndexed', fn('mapIndexed', 'kotlin.collections.mapIndexed', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(Int, T) -> R'], returnType: 'List<R>' })],
  ['flatMap', fn('flatMap', 'kotlin.collections.flatMap', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Iterable<R>'], returnType: 'List<R>' })],
  ['flatten', fn('flatten', 'kotlin.collections.flatten', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<Iterable<T>>', parameterTypes: [], returnType: 'List<T>' })],
  ['filter', fn('filter', 'kotlin.collections.filter', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'List<T>' })],
  ['filterNotNull', fn('filterNotNull', 'kotlin.collections.filterNotNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T?>', parameterTypes: [], returnType: 'List<T>' })],
  ['filterNot', fn('filterNot', 'kotlin.collections.filterNot', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'List<T>' })],
  ['filterIndexed', fn('filterIndexed', 'kotlin.collections.filterIndexed', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(Int, T) -> Boolean'], returnType: 'List<T>' })],
  ['filterIsInstance', fn('filterIsInstance', 'kotlin.collections.filterIsInstance', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<*>', parameterTypes: [], returnType: 'List<R>' })],
  ['forEach', fn('forEach', 'kotlin.collections.forEach', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Unit'], returnType: 'Unit' })],
  ['forEachIndexed', fn('forEachIndexed', 'kotlin.collections.forEachIndexed', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(Int, T) -> Unit'], returnType: 'Unit' })],
  ['onEach', fn('onEach', 'kotlin.collections.onEach', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Unit'], returnType: 'Iterable<T>' })],
  ['find', fn('find', 'kotlin.collections.find', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'T?' })],
  ['findLast', fn('findLast', 'kotlin.collections.findLast', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'T?' })],
  ['first', fn('first', 'kotlin.collections.first', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T' })],
  ['firstOrNull', fn('firstOrNull', 'kotlin.collections.firstOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T?' })],
  ['last', fn('last', 'kotlin.collections.last', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T' })],
  ['lastOrNull', fn('lastOrNull', 'kotlin.collections.lastOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T?' })],
  ['single', fn('single', 'kotlin.collections.single', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T' })],
  ['singleOrNull', fn('singleOrNull', 'kotlin.collections.singleOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T?' })],
  ['any', fn('any', 'kotlin.collections.any', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'Boolean' })],
  ['all', fn('all', 'kotlin.collections.all', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'Boolean' })],
  ['none', fn('none', 'kotlin.collections.none', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'Boolean' })],
  ['count', fn('count', 'kotlin.collections.count', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'Int' })],
  ['fold', fn('fold', 'kotlin.collections.fold', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['R', '(R, T) -> R'], returnType: 'R' })],
  ['foldRight', fn('foldRight', 'kotlin.collections.foldRight', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>', parameterTypes: ['R', '(T, R) -> R'], returnType: 'R' })],
  ['reduce', fn('reduce', 'kotlin.collections.reduce', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(S, T) -> S'], returnType: 'S' })],
  ['reduceOrNull', fn('reduceOrNull', 'kotlin.collections.reduceOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(S, T) -> S'], returnType: 'S?' })],
  ['groupBy', fn('groupBy', 'kotlin.collections.groupBy', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> K'], returnType: 'Map<K, List<T>>' })],
  ['associate', fn('associate', 'kotlin.collections.associate', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Pair<K, V>'], returnType: 'Map<K, V>' })],
  ['associateWith', fn('associateWith', 'kotlin.collections.associateWith', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<K>', parameterTypes: ['(K) -> V'], returnType: 'Map<K, V>' })],
  ['associateBy', fn('associateBy', 'kotlin.collections.associateBy', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> K'], returnType: 'Map<K, T>' })],
  ['partition', fn('partition', 'kotlin.collections.partition', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'Pair<List<T>, List<T>>' })],
  ['zip', fn('zip', 'kotlin.collections.zip', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Iterable<R>'], returnType: 'List<Pair<T, R>>' })],
  ['unzip', fn('unzip', 'kotlin.collections.unzip', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<Pair<T, R>>', parameterTypes: [], returnType: 'Pair<List<T>, List<R>>' })],
  ['sorted', fn('sorted', 'kotlin.collections.sorted', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'List<T>' })],
  ['sortedBy', fn('sortedBy', 'kotlin.collections.sortedBy', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R?'], returnType: 'List<T>' })],
  ['sortedByDescending', fn('sortedByDescending', 'kotlin.collections.sortedByDescending', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R?'], returnType: 'List<T>' })],
  ['sortedDescending', fn('sortedDescending', 'kotlin.collections.sortedDescending', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'List<T>' })],
  ['sortedWith', fn('sortedWith', 'kotlin.collections.sortedWith', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Comparator<in T>'], returnType: 'List<T>' })],
  ['reversed', fn('reversed', 'kotlin.collections.reversed', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'List<T>' })],
  ['shuffled', fn('shuffled', 'kotlin.collections.shuffled', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'List<T>' })],
  ['distinct', fn('distinct', 'kotlin.collections.distinct', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'List<T>' })],
  ['distinctBy', fn('distinctBy', 'kotlin.collections.distinctBy', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> K'], returnType: 'List<T>' })],
  ['take', fn('take', 'kotlin.collections.take', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int'], returnType: 'List<T>' })],
  ['takeLast', fn('takeLast', 'kotlin.collections.takeLast', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>', parameterTypes: ['Int'], returnType: 'List<T>' })],
  ['takeWhile', fn('takeWhile', 'kotlin.collections.takeWhile', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'List<T>' })],
  ['drop', fn('drop', 'kotlin.collections.drop', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int'], returnType: 'List<T>' })],
  ['dropLast', fn('dropLast', 'kotlin.collections.dropLast', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>', parameterTypes: ['Int'], returnType: 'List<T>' })],
  ['dropWhile', fn('dropWhile', 'kotlin.collections.dropWhile', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'List<T>' })],
  ['chunked', fn('chunked', 'kotlin.collections.chunked', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int'], returnType: 'List<List<T>>' })],
  ['windowed', fn('windowed', 'kotlin.collections.windowed', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int', 'Int', 'Boolean'], returnType: 'List<List<T>>' })],
  ['plus', fn('plus', 'kotlin.collections.plus', 'kotlin.collections', { isExtension: true, isOperator: true, receiverType: 'Collection<T>', parameterTypes: ['T'], returnType: 'List<T>' })],
  ['minus', fn('minus', 'kotlin.collections.minus', 'kotlin.collections', { isExtension: true, isOperator: true, receiverType: 'Collection<T>', parameterTypes: ['T'], returnType: 'List<T>' })],
  ['contains', fn('contains', 'kotlin.collections.contains', 'kotlin.collections', { isExtension: true, isOperator: true, receiverType: 'Iterable<T>', parameterTypes: ['T'], returnType: 'Boolean' })],
  ['indexOf', fn('indexOf', 'kotlin.collections.indexOf', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['T'], returnType: 'Int' })],
  ['lastIndexOf', fn('lastIndexOf', 'kotlin.collections.lastIndexOf', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>', parameterTypes: ['T'], returnType: 'Int' })],
  ['indexOfFirst', fn('indexOfFirst', 'kotlin.collections.indexOfFirst', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'Int' })],
  ['indexOfLast', fn('indexOfLast', 'kotlin.collections.indexOfLast', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Boolean'], returnType: 'Int' })],
  ['elementAt', fn('elementAt', 'kotlin.collections.elementAt', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int'], returnType: 'T' })],
  ['elementAtOrNull', fn('elementAtOrNull', 'kotlin.collections.elementAtOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int'], returnType: 'T?' })],
  ['elementAtOrElse', fn('elementAtOrElse', 'kotlin.collections.elementAtOrElse', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['Int', '(Int) -> T'], returnType: 'T' })],
  ['getOrElse', fn('getOrElse', 'kotlin.collections.getOrElse', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>', parameterTypes: ['Int', '(Int) -> T'], returnType: 'T' })],
  ['getOrNull', fn('getOrNull', 'kotlin.collections.getOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>', parameterTypes: ['Int'], returnType: 'T?' })],
  ['toList', fn('toList', 'kotlin.collections.toList', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'List<T>' })],
  ['toMutableList', fn('toMutableList', 'kotlin.collections.toMutableList', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'MutableList<T>' })],
  ['toSet', fn('toSet', 'kotlin.collections.toSet', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'Set<T>' })],
  ['toMutableSet', fn('toMutableSet', 'kotlin.collections.toMutableSet', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'MutableSet<T>' })],
  ['toMap', fn('toMap', 'kotlin.collections.toMap', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<Pair<K, V>>', parameterTypes: [], returnType: 'Map<K, V>' })],
  ['toMutableMap', fn('toMutableMap', 'kotlin.collections.toMutableMap', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: [], returnType: 'MutableMap<K, V>' })],
  ['joinToString', fn('joinToString', 'kotlin.collections.joinToString', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['String', 'String', 'String', 'Int', 'String', '(T) -> CharSequence'], returnType: 'String' })],
  ['sumOf', fn('sumOf', 'kotlin.collections.sumOf', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> Int'], returnType: 'Int' })],
  ['maxOf', fn('maxOf', 'kotlin.collections.maxOf', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R'], returnType: 'R' })],
  ['minOf', fn('minOf', 'kotlin.collections.minOf', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R'], returnType: 'R' })],
  ['maxByOrNull', fn('maxByOrNull', 'kotlin.collections.maxByOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R'], returnType: 'T?' })],
  ['minByOrNull', fn('minByOrNull', 'kotlin.collections.minByOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: ['(T) -> R'], returnType: 'T?' })],
  ['maxOrNull', fn('maxOrNull', 'kotlin.collections.maxOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T?' })],
  ['minOrNull', fn('minOrNull', 'kotlin.collections.minOrNull', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'T?' })],
  ['average', fn('average', 'kotlin.collections.average', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<Int>', parameterTypes: [], returnType: 'Double' })],
  ['sum', fn('sum', 'kotlin.collections.sum', 'kotlin.collections', { isExtension: true, receiverType: 'Iterable<Int>', parameterTypes: [], returnType: 'Int' })],
  ['orEmpty', fn('orEmpty', 'kotlin.collections.orEmpty', 'kotlin.collections', { isExtension: true, receiverType: 'List<T>?', parameterTypes: [], returnType: 'List<T>' })],

  // MutableCollection methods
  ['add', fn('add', 'kotlin.collections.MutableCollection.add', 'kotlin.collections', { declaringTypeFqn: 'kotlin.collections.MutableCollection', parameterTypes: ['E'], returnType: 'Boolean' })],
  ['remove', fn('remove', 'kotlin.collections.MutableCollection.remove', 'kotlin.collections', { declaringTypeFqn: 'kotlin.collections.MutableCollection', parameterTypes: ['E'], returnType: 'Boolean' })],
  ['addAll', fn('addAll', 'kotlin.collections.MutableCollection.addAll', 'kotlin.collections', { declaringTypeFqn: 'kotlin.collections.MutableCollection', parameterTypes: ['Collection<E>'], returnType: 'Boolean' })],
  ['removeAll', fn('removeAll', 'kotlin.collections.MutableCollection.removeAll', 'kotlin.collections', { declaringTypeFqn: 'kotlin.collections.MutableCollection', parameterTypes: ['Collection<E>'], returnType: 'Boolean' })],
  ['clear', fn('clear', 'kotlin.collections.MutableCollection.clear', 'kotlin.collections', { declaringTypeFqn: 'kotlin.collections.MutableCollection', parameterTypes: [], returnType: 'Unit' })],

  // Map extensions
  ['getOrDefault', fn('getOrDefault', 'kotlin.collections.getOrDefault', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: ['K', 'V'], returnType: 'V' })],
  ['getOrPut', fn('getOrPut', 'kotlin.collections.getOrPut', 'kotlin.collections', { isExtension: true, receiverType: 'MutableMap<K, V>', parameterTypes: ['K', '() -> V'], returnType: 'V' })],
  ['getValue', fn('getValue', 'kotlin.collections.getValue', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: ['K'], returnType: 'V' })],
  ['mapKeys', fn('mapKeys', 'kotlin.collections.mapKeys', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: ['(Map.Entry<K, V>) -> R'], returnType: 'Map<R, V>' })],
  ['mapValues', fn('mapValues', 'kotlin.collections.mapValues', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: ['(Map.Entry<K, V>) -> R'], returnType: 'Map<K, R>' })],
  ['filterKeys', fn('filterKeys', 'kotlin.collections.filterKeys', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: ['(K) -> Boolean'], returnType: 'Map<K, V>' })],
  ['filterValues', fn('filterValues', 'kotlin.collections.filterValues', 'kotlin.collections', { isExtension: true, receiverType: 'Map<K, V>', parameterTypes: ['(V) -> Boolean'], returnType: 'Map<K, V>' })],

  // ---------------------------------------------------------------------------
  // kotlin.text - String extensions
  // ---------------------------------------------------------------------------
  ['trim', fn('trim', 'kotlin.text.trim', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'String' })],
  ['trimStart', fn('trimStart', 'kotlin.text.trimStart', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'String' })],
  ['trimEnd', fn('trimEnd', 'kotlin.text.trimEnd', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'String' })],
  ['split', fn('split', 'kotlin.text.split', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: ['vararg String'], returnType: 'List<String>' })],
  ['replace', fn('replace', 'kotlin.text.replace', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['String', 'String'], returnType: 'String' })],
  ['replaceFirst', fn('replaceFirst', 'kotlin.text.replaceFirst', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['String', 'String'], returnType: 'String' })],
  ['substring', fn('substring', 'kotlin.text.substring', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['Int', 'Int'], returnType: 'String' })],
  ['substringBefore', fn('substringBefore', 'kotlin.text.substringBefore', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['String', 'String'], returnType: 'String' })],
  ['substringAfter', fn('substringAfter', 'kotlin.text.substringAfter', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['String', 'String'], returnType: 'String' })],
  ['substringBeforeLast', fn('substringBeforeLast', 'kotlin.text.substringBeforeLast', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['String', 'String'], returnType: 'String' })],
  ['substringAfterLast', fn('substringAfterLast', 'kotlin.text.substringAfterLast', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['String', 'String'], returnType: 'String' })],
  ['startsWith', fn('startsWith', 'kotlin.text.startsWith', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: ['CharSequence', 'Boolean'], returnType: 'Boolean' })],
  ['endsWith', fn('endsWith', 'kotlin.text.endsWith', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: ['CharSequence', 'Boolean'], returnType: 'Boolean' })],
  ['padStart', fn('padStart', 'kotlin.text.padStart', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['Int', 'Char'], returnType: 'String' })],
  ['padEnd', fn('padEnd', 'kotlin.text.padEnd', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['Int', 'Char'], returnType: 'String' })],
  ['lowercase', fn('lowercase', 'kotlin.text.lowercase', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'String' })],
  ['uppercase', fn('uppercase', 'kotlin.text.uppercase', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'String' })],
  ['toInt', fn('toInt', 'kotlin.text.toInt', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Int' })],
  ['toIntOrNull', fn('toIntOrNull', 'kotlin.text.toIntOrNull', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Int?' })],
  ['toLong', fn('toLong', 'kotlin.text.toLong', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Long' })],
  ['toLongOrNull', fn('toLongOrNull', 'kotlin.text.toLongOrNull', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Long?' })],
  ['toDouble', fn('toDouble', 'kotlin.text.toDouble', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Double' })],
  ['toDoubleOrNull', fn('toDoubleOrNull', 'kotlin.text.toDoubleOrNull', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Double?' })],
  ['toBoolean', fn('toBoolean', 'kotlin.text.toBoolean', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Boolean' })],
  ['isBlank', fn('isBlank', 'kotlin.text.isBlank', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: [], returnType: 'Boolean' })],
  ['isNotBlank', fn('isNotBlank', 'kotlin.text.isNotBlank', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: [], returnType: 'Boolean' })],
  ['isEmpty', fn('isEmpty', 'kotlin.text.isEmpty', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: [], returnType: 'Boolean' })],
  ['isNotEmpty', fn('isNotEmpty', 'kotlin.text.isNotEmpty', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: [], returnType: 'Boolean' })],
  ['isNullOrEmpty', fn('isNullOrEmpty', 'kotlin.text.isNullOrEmpty', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence?', parameterTypes: [], returnType: 'Boolean' })],
  ['isNullOrBlank', fn('isNullOrBlank', 'kotlin.text.isNullOrBlank', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence?', parameterTypes: [], returnType: 'Boolean' })],
  ['ifEmpty', fn('ifEmpty', 'kotlin.text.ifEmpty', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: ['() -> R'], returnType: 'R' })],
  ['ifBlank', fn('ifBlank', 'kotlin.text.ifBlank', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: ['() -> R'], returnType: 'R' })],
  ['lines', fn('lines', 'kotlin.text.lines', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: [], returnType: 'List<String>' })],
  ['toRegex', fn('toRegex', 'kotlin.text.toRegex', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: [], returnType: 'Regex' })],
  ['matches', fn('matches', 'kotlin.text.matches', 'kotlin.text', { isExtension: true, receiverType: 'CharSequence', parameterTypes: ['Regex'], returnType: 'Boolean' })],
  ['format', fn('format', 'kotlin.text.format', 'kotlin.text', { isExtension: true, receiverType: 'String', parameterTypes: ['vararg Any?'], returnType: 'String' })],
  ['buildString', fn('buildString', 'kotlin.text.buildString', 'kotlin.text', { parameterTypes: ['StringBuilder.() -> Unit'], returnType: 'String' })],

  // ---------------------------------------------------------------------------
  // kotlin.ranges - Range functions
  // ---------------------------------------------------------------------------
  ['until', fn('until', 'kotlin.ranges.until', 'kotlin.ranges', { isExtension: true, isInfix: true, receiverType: 'Int', parameterTypes: ['Int'], returnType: 'IntRange' })],
  ['downTo', fn('downTo', 'kotlin.ranges.downTo', 'kotlin.ranges', { isExtension: true, isInfix: true, receiverType: 'Int', parameterTypes: ['Int'], returnType: 'IntProgression' })],
  ['step', fn('step', 'kotlin.ranges.step', 'kotlin.ranges', { isExtension: true, isInfix: true, receiverType: 'IntProgression', parameterTypes: ['Int'], returnType: 'IntProgression' })],
  ['coerceIn', fn('coerceIn', 'kotlin.ranges.coerceIn', 'kotlin.ranges', { isExtension: true, receiverType: 'T', parameterTypes: ['T', 'T'], returnType: 'T' })],
  ['coerceAtLeast', fn('coerceAtLeast', 'kotlin.ranges.coerceAtLeast', 'kotlin.ranges', { isExtension: true, receiverType: 'T', parameterTypes: ['T'], returnType: 'T' })],
  ['coerceAtMost', fn('coerceAtMost', 'kotlin.ranges.coerceAtMost', 'kotlin.ranges', { isExtension: true, receiverType: 'T', parameterTypes: ['T'], returnType: 'T' })],

  // ---------------------------------------------------------------------------
  // kotlin.sequences - Sequence functions
  // ---------------------------------------------------------------------------
  ['sequenceOf', fn('sequenceOf', 'kotlin.sequences.sequenceOf', 'kotlin.sequences', { parameterTypes: ['vararg T'], returnType: 'Sequence<T>' })],
  ['emptySequence', fn('emptySequence', 'kotlin.sequences.emptySequence', 'kotlin.sequences', { parameterTypes: [], returnType: 'Sequence<T>' })],
  ['generateSequence', fn('generateSequence', 'kotlin.sequences.generateSequence', 'kotlin.sequences', { parameterTypes: ['() -> T?', '(T) -> T?'], returnType: 'Sequence<T>' })],
  ['asSequence', fn('asSequence', 'kotlin.sequences.asSequence', 'kotlin.sequences', { isExtension: true, receiverType: 'Iterable<T>', parameterTypes: [], returnType: 'Sequence<T>' })],

  // ---------------------------------------------------------------------------
  // kotlin.comparisons - Comparator functions
  // ---------------------------------------------------------------------------
  ['compareBy', fn('compareBy', 'kotlin.comparisons.compareBy', 'kotlin.comparisons', { parameterTypes: ['vararg (T) -> Comparable<*>?'], returnType: 'Comparator<T>' })],
  ['compareByDescending', fn('compareByDescending', 'kotlin.comparisons.compareByDescending', 'kotlin.comparisons', { parameterTypes: ['(T) -> Comparable<*>?'], returnType: 'Comparator<T>' })],
  ['thenBy', fn('thenBy', 'kotlin.comparisons.thenBy', 'kotlin.comparisons', { isExtension: true, receiverType: 'Comparator<T>', parameterTypes: ['(T) -> Comparable<*>?'], returnType: 'Comparator<T>' })],
  ['naturalOrder', fn('naturalOrder', 'kotlin.comparisons.naturalOrder', 'kotlin.comparisons', { parameterTypes: [], returnType: 'Comparator<T>' })],
  ['reverseOrder', fn('reverseOrder', 'kotlin.comparisons.reverseOrder', 'kotlin.comparisons', { parameterTypes: [], returnType: 'Comparator<T>' })],

  // Copy for data classes
  ['copy', fn('copy', 'kotlin.copy', 'kotlin', { isExtension: true, receiverType: 'T', parameterTypes: [], returnType: 'T' })],
]);

// =============================================================================
// Kotlin Stdlib Classes
// =============================================================================

export const KOTLIN_STDLIB_CLASSES: ReadonlyMap<string, ClassSymbol> = new Map([
  // Primitives and core types
  ['Any', cls('Any', 'kotlin.Any', 'kotlin')],
  ['Unit', cls('Unit', 'kotlin.Unit', 'kotlin', 'object')],
  ['Nothing', cls('Nothing', 'kotlin.Nothing', 'kotlin')],
  ['String', cls('String', 'kotlin.String', 'kotlin')],
  ['Int', cls('Int', 'kotlin.Int', 'kotlin')],
  ['Long', cls('Long', 'kotlin.Long', 'kotlin')],
  ['Double', cls('Double', 'kotlin.Double', 'kotlin')],
  ['Float', cls('Float', 'kotlin.Float', 'kotlin')],
  ['Boolean', cls('Boolean', 'kotlin.Boolean', 'kotlin')],
  ['Char', cls('Char', 'kotlin.Char', 'kotlin')],
  ['Byte', cls('Byte', 'kotlin.Byte', 'kotlin')],
  ['Short', cls('Short', 'kotlin.Short', 'kotlin')],
  ['Number', cls('Number', 'kotlin.Number', 'kotlin', 'class', { isAbstract: true })],
  ['Pair', cls('Pair', 'kotlin.Pair', 'kotlin', 'class', { isData: true })],
  ['Triple', cls('Triple', 'kotlin.Triple', 'kotlin', 'class', { isData: true })],
  ['Comparable', cls('Comparable', 'kotlin.Comparable', 'kotlin', 'interface')],
  ['Enum', cls('Enum', 'kotlin.Enum', 'kotlin', 'class', { isAbstract: true })],
  ['CharSequence', cls('CharSequence', 'kotlin.CharSequence', 'kotlin', 'interface')],
  ['Lazy', cls('Lazy', 'kotlin.Lazy', 'kotlin', 'interface')],

  // Exceptions
  ['Throwable', cls('Throwable', 'kotlin.Throwable', 'kotlin')],
  ['Exception', cls('Exception', 'kotlin.Exception', 'kotlin', 'class', { superClass: 'kotlin.Throwable' })],
  ['RuntimeException', cls('RuntimeException', 'kotlin.RuntimeException', 'kotlin', 'class', { superClass: 'kotlin.Exception' })],
  ['IllegalArgumentException', cls('IllegalArgumentException', 'kotlin.IllegalArgumentException', 'kotlin', 'class', { superClass: 'kotlin.RuntimeException' })],
  ['IllegalStateException', cls('IllegalStateException', 'kotlin.IllegalStateException', 'kotlin', 'class', { superClass: 'kotlin.RuntimeException' })],
  ['NoSuchElementException', cls('NoSuchElementException', 'kotlin.NoSuchElementException', 'kotlin', 'class', { superClass: 'kotlin.RuntimeException' })],
  ['UnsupportedOperationException', cls('UnsupportedOperationException', 'kotlin.UnsupportedOperationException', 'kotlin', 'class', { superClass: 'kotlin.RuntimeException' })],
  ['IndexOutOfBoundsException', cls('IndexOutOfBoundsException', 'kotlin.IndexOutOfBoundsException', 'kotlin', 'class', { superClass: 'kotlin.RuntimeException' })],
  ['NullPointerException', cls('NullPointerException', 'kotlin.NullPointerException', 'kotlin', 'class', { superClass: 'kotlin.RuntimeException' })],

  // Collections
  ['Iterable', cls('Iterable', 'kotlin.collections.Iterable', 'kotlin.collections', 'interface')],
  ['Collection', cls('Collection', 'kotlin.collections.Collection', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Iterable'] })],
  ['List', cls('List', 'kotlin.collections.List', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Collection'] })],
  ['Set', cls('Set', 'kotlin.collections.Set', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Collection'] })],
  ['Map', cls('Map', 'kotlin.collections.Map', 'kotlin.collections', 'interface')],
  ['MutableIterable', cls('MutableIterable', 'kotlin.collections.MutableIterable', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Iterable'] })],
  ['MutableCollection', cls('MutableCollection', 'kotlin.collections.MutableCollection', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Collection', 'kotlin.collections.MutableIterable'] })],
  ['MutableList', cls('MutableList', 'kotlin.collections.MutableList', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.List', 'kotlin.collections.MutableCollection'] })],
  ['MutableSet', cls('MutableSet', 'kotlin.collections.MutableSet', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Set', 'kotlin.collections.MutableCollection'] })],
  ['MutableMap', cls('MutableMap', 'kotlin.collections.MutableMap', 'kotlin.collections', 'interface', { interfaces: ['kotlin.collections.Map'] })],
  ['ArrayList', cls('ArrayList', 'kotlin.collections.ArrayList', 'kotlin.collections', 'class', { interfaces: ['kotlin.collections.MutableList'] })],
  ['HashSet', cls('HashSet', 'kotlin.collections.HashSet', 'kotlin.collections', 'class', { interfaces: ['kotlin.collections.MutableSet'] })],
  ['LinkedHashSet', cls('LinkedHashSet', 'kotlin.collections.LinkedHashSet', 'kotlin.collections', 'class', { interfaces: ['kotlin.collections.MutableSet'] })],
  ['HashMap', cls('HashMap', 'kotlin.collections.HashMap', 'kotlin.collections', 'class', { interfaces: ['kotlin.collections.MutableMap'] })],
  ['LinkedHashMap', cls('LinkedHashMap', 'kotlin.collections.LinkedHashMap', 'kotlin.collections', 'class', { interfaces: ['kotlin.collections.MutableMap'] })],

  // Sequences
  ['Sequence', cls('Sequence', 'kotlin.sequences.Sequence', 'kotlin.sequences', 'interface')],

  // Ranges
  ['IntRange', cls('IntRange', 'kotlin.ranges.IntRange', 'kotlin.ranges')],
  ['LongRange', cls('LongRange', 'kotlin.ranges.LongRange', 'kotlin.ranges')],
  ['CharRange', cls('CharRange', 'kotlin.ranges.CharRange', 'kotlin.ranges')],
  ['IntProgression', cls('IntProgression', 'kotlin.ranges.IntProgression', 'kotlin.ranges')],

  // Text
  ['Regex', cls('Regex', 'kotlin.text.Regex', 'kotlin.text')],
  ['StringBuilder', cls('StringBuilder', 'kotlin.text.StringBuilder', 'kotlin.text')],
]);

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get all stdlib symbols (functions + classes) as a single map.
 */
export function getKotlinStdlibSymbols(): Map<string, Symbol> {
  const result = new Map<string, Symbol>();

  for (const [name, func] of KOTLIN_STDLIB_FUNCTIONS) {
    result.set(name, func);
  }

  for (const [name, clsSymbol] of KOTLIN_STDLIB_CLASSES) {
    result.set(name, clsSymbol);
  }

  return result;
}

/**
 * Lookup a stdlib function by name.
 */
export function lookupKotlinStdlibFunction(name: string): FunctionSymbol | undefined {
  return KOTLIN_STDLIB_FUNCTIONS.get(name);
}

/**
 * Lookup a stdlib class by name.
 */
export function lookupKotlinStdlibClass(name: string): ClassSymbol | undefined {
  return KOTLIN_STDLIB_CLASSES.get(name);
}

/**
 * Check if a function name is a known stdlib function.
 */
export function isKotlinStdlibFunction(name: string): boolean {
  return KOTLIN_STDLIB_FUNCTIONS.has(name);
}

/**
 * Check if a class name is a known stdlib class.
 */
export function isKotlinStdlibClass(name: string): boolean {
  return KOTLIN_STDLIB_CLASSES.has(name);
}

// =============================================================================
// Kotlin Stdlib Provider (implements StdlibProvider interface)
// =============================================================================

/**
 * StdlibProvider implementation for Kotlin.
 * Provides access to Kotlin stdlib functions and classes for symbol resolution.
 */
export class KotlinStdlibProvider implements StdlibProvider {
  readonly languages: readonly SupportedLanguage[] = ['kotlin'];

  readonly defaultWildcardImports: readonly string[] = [
    'kotlin',
    'kotlin.collections',
    'kotlin.text',
    'kotlin.io',
    'kotlin.ranges',
    'kotlin.sequences',
    'kotlin.annotation',
  ];

  lookupFunction(name: string): FunctionSymbol | undefined {
    return KOTLIN_STDLIB_FUNCTIONS.get(name);
  }

  lookupClass(name: string): ClassSymbol | undefined {
    return KOTLIN_STDLIB_CLASSES.get(name);
  }

  lookupStaticMethod(_qualifiedName: string): FunctionSymbol | undefined {
    // Kotlin doesn't really have static methods in the Java sense
    // Companion objects are handled separately in resolution
    return undefined;
  }

  isKnownSymbol(name: string): boolean {
    return KOTLIN_STDLIB_FUNCTIONS.has(name) || KOTLIN_STDLIB_CLASSES.has(name);
  }

  getAllSymbols(): Map<string, Symbol> {
    return getKotlinStdlibSymbols();
  }
}
