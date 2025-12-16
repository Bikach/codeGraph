/**
 * Java Standard Library symbols for resolution.
 *
 * These are commonly used Java classes and methods that appear in Kotlin code
 * (especially JVM-based Kotlin projects).
 *
 * Reference: https://docs.oracle.com/en/java/javase/17/docs/api/
 */

import type { FunctionSymbol, ClassSymbol, Symbol } from '../types.js';
import type { StdlibProvider } from './stdlib-provider.js';
import type { SupportedLanguage } from '../../types.js';

// Stdlib location placeholder
const STDLIB_LOC = {
  filePath: '<java-stdlib>',
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
  declaringTypeFqn: string,
  opts: {
    parameterTypes?: string[];
    returnType?: string;
  } = {}
): FunctionSymbol {
  return {
    name,
    fqn,
    kind: 'function',
    filePath: '<java-stdlib>',
    location: STDLIB_LOC,
    packageName,
    declaringTypeFqn,
    parameterTypes: opts.parameterTypes || [],
    returnType: opts.returnType,
    isExtension: false,
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
    isAbstract?: boolean;
  } = {}
): ClassSymbol {
  return {
    name,
    fqn,
    kind,
    filePath: '<java-stdlib>',
    location: STDLIB_LOC,
    packageName,
    superClass: opts.superClass,
    interfaces: opts.interfaces || [],
    isAbstract: opts.isAbstract,
  };
}

// =============================================================================
// Java Stdlib Classes
// =============================================================================

export const JAVA_STDLIB_CLASSES: ReadonlyMap<string, ClassSymbol> = new Map([
  // java.lang - Core classes
  ['Object', cls('Object', 'java.lang.Object', 'java.lang')],
  ['Class', cls('Class', 'java.lang.Class', 'java.lang')],
  ['System', cls('System', 'java.lang.System', 'java.lang')],
  ['Runtime', cls('Runtime', 'java.lang.Runtime', 'java.lang')],
  ['Thread', cls('Thread', 'java.lang.Thread', 'java.lang')],
  ['Runnable', cls('Runnable', 'java.lang.Runnable', 'java.lang', 'interface')],

  // java.util - UUID
  ['UUID', cls('UUID', 'java.util.UUID', 'java.util')],

  // java.util - Collections
  ['Collections', cls('Collections', 'java.util.Collections', 'java.util')],
  ['Arrays', cls('Arrays', 'java.util.Arrays', 'java.util')],
  ['Optional', cls('Optional', 'java.util.Optional', 'java.util')],

  // java.time - Date/Time
  ['LocalDate', cls('LocalDate', 'java.time.LocalDate', 'java.time')],
  ['LocalTime', cls('LocalTime', 'java.time.LocalTime', 'java.time')],
  ['LocalDateTime', cls('LocalDateTime', 'java.time.LocalDateTime', 'java.time')],
  ['ZonedDateTime', cls('ZonedDateTime', 'java.time.ZonedDateTime', 'java.time')],
  ['OffsetDateTime', cls('OffsetDateTime', 'java.time.OffsetDateTime', 'java.time')],
  ['Instant', cls('Instant', 'java.time.Instant', 'java.time')],
  ['Duration', cls('Duration', 'java.time.Duration', 'java.time')],
  ['Period', cls('Period', 'java.time.Period', 'java.time')],
  ['ZoneId', cls('ZoneId', 'java.time.ZoneId', 'java.time')],
  ['ZoneOffset', cls('ZoneOffset', 'java.time.ZoneOffset', 'java.time', 'class', { superClass: 'java.time.ZoneId' })],
  ['DateTimeFormatter', cls('DateTimeFormatter', 'java.time.format.DateTimeFormatter', 'java.time.format')],
  ['ChronoUnit', cls('ChronoUnit', 'java.time.temporal.ChronoUnit', 'java.time.temporal', 'enum')],

  // java.io - I/O
  ['File', cls('File', 'java.io.File', 'java.io')],
  ['InputStream', cls('InputStream', 'java.io.InputStream', 'java.io', 'class', { isAbstract: true })],
  ['OutputStream', cls('OutputStream', 'java.io.OutputStream', 'java.io', 'class', { isAbstract: true })],
  ['Reader', cls('Reader', 'java.io.Reader', 'java.io', 'class', { isAbstract: true })],
  ['Writer', cls('Writer', 'java.io.Writer', 'java.io', 'class', { isAbstract: true })],
  ['BufferedReader', cls('BufferedReader', 'java.io.BufferedReader', 'java.io', 'class', { superClass: 'java.io.Reader' })],
  ['BufferedWriter', cls('BufferedWriter', 'java.io.BufferedWriter', 'java.io', 'class', { superClass: 'java.io.Writer' })],
  ['IOException', cls('IOException', 'java.io.IOException', 'java.io', 'class', { superClass: 'java.lang.Exception' })],
  ['Closeable', cls('Closeable', 'java.io.Closeable', 'java.io', 'interface')],
  ['Serializable', cls('Serializable', 'java.io.Serializable', 'java.io', 'interface')],

  // java.nio - NIO
  ['Path', cls('Path', 'java.nio.file.Path', 'java.nio.file', 'interface')],
  ['Paths', cls('Paths', 'java.nio.file.Paths', 'java.nio.file')],
  ['Files', cls('Files', 'java.nio.file.Files', 'java.nio.file')],
  ['ByteBuffer', cls('ByteBuffer', 'java.nio.ByteBuffer', 'java.nio', 'class', { isAbstract: true })],
  ['Charset', cls('Charset', 'java.nio.charset.Charset', 'java.nio.charset', 'class', { isAbstract: true })],
  ['StandardCharsets', cls('StandardCharsets', 'java.nio.charset.StandardCharsets', 'java.nio.charset')],

  // java.net - Networking
  ['URL', cls('URL', 'java.net.URL', 'java.net')],
  ['URI', cls('URI', 'java.net.URI', 'java.net')],
  ['HttpURLConnection', cls('HttpURLConnection', 'java.net.HttpURLConnection', 'java.net', 'class', { isAbstract: true })],

  // java.util.concurrent - Concurrency
  ['Executor', cls('Executor', 'java.util.concurrent.Executor', 'java.util.concurrent', 'interface')],
  ['ExecutorService', cls('ExecutorService', 'java.util.concurrent.ExecutorService', 'java.util.concurrent', 'interface', { interfaces: ['java.util.concurrent.Executor'] })],
  ['Executors', cls('Executors', 'java.util.concurrent.Executors', 'java.util.concurrent')],
  ['Future', cls('Future', 'java.util.concurrent.Future', 'java.util.concurrent', 'interface')],
  ['CompletableFuture', cls('CompletableFuture', 'java.util.concurrent.CompletableFuture', 'java.util.concurrent', 'class', { interfaces: ['java.util.concurrent.Future'] })],
  ['Callable', cls('Callable', 'java.util.concurrent.Callable', 'java.util.concurrent', 'interface')],
  ['TimeUnit', cls('TimeUnit', 'java.util.concurrent.TimeUnit', 'java.util.concurrent', 'enum')],
  ['AtomicInteger', cls('AtomicInteger', 'java.util.concurrent.atomic.AtomicInteger', 'java.util.concurrent.atomic')],
  ['AtomicLong', cls('AtomicLong', 'java.util.concurrent.atomic.AtomicLong', 'java.util.concurrent.atomic')],
  ['AtomicBoolean', cls('AtomicBoolean', 'java.util.concurrent.atomic.AtomicBoolean', 'java.util.concurrent.atomic')],
  ['AtomicReference', cls('AtomicReference', 'java.util.concurrent.atomic.AtomicReference', 'java.util.concurrent.atomic')],
  ['ConcurrentHashMap', cls('ConcurrentHashMap', 'java.util.concurrent.ConcurrentHashMap', 'java.util.concurrent', 'class', { interfaces: ['java.util.Map'] })],
  ['CopyOnWriteArrayList', cls('CopyOnWriteArrayList', 'java.util.concurrent.CopyOnWriteArrayList', 'java.util.concurrent', 'class', { interfaces: ['java.util.List'] })],

  // java.math - BigDecimal, BigInteger
  ['BigDecimal', cls('BigDecimal', 'java.math.BigDecimal', 'java.math')],
  ['BigInteger', cls('BigInteger', 'java.math.BigInteger', 'java.math')],
  ['RoundingMode', cls('RoundingMode', 'java.math.RoundingMode', 'java.math', 'enum')],

  // java.util.regex - Regular expressions
  ['Pattern', cls('Pattern', 'java.util.regex.Pattern', 'java.util.regex')],
  ['Matcher', cls('Matcher', 'java.util.regex.Matcher', 'java.util.regex')],

  // java.util.stream - Streams
  ['Stream', cls('Stream', 'java.util.stream.Stream', 'java.util.stream', 'interface')],
  ['Collectors', cls('Collectors', 'java.util.stream.Collectors', 'java.util.stream')],

  // java.util.function - Functional interfaces
  ['Function', cls('Function', 'java.util.function.Function', 'java.util.function', 'interface')],
  ['Consumer', cls('Consumer', 'java.util.function.Consumer', 'java.util.function', 'interface')],
  ['Supplier', cls('Supplier', 'java.util.function.Supplier', 'java.util.function', 'interface')],
  ['Predicate', cls('Predicate', 'java.util.function.Predicate', 'java.util.function', 'interface')],
  ['BiFunction', cls('BiFunction', 'java.util.function.BiFunction', 'java.util.function', 'interface')],
  ['BiConsumer', cls('BiConsumer', 'java.util.function.BiConsumer', 'java.util.function', 'interface')],

  // java.lang.reflect - Reflection
  ['Method', cls('Method', 'java.lang.reflect.Method', 'java.lang.reflect')],
  ['Field', cls('Field', 'java.lang.reflect.Field', 'java.lang.reflect')],
  ['Constructor', cls('Constructor', 'java.lang.reflect.Constructor', 'java.lang.reflect')],

  // java.security - Security
  ['MessageDigest', cls('MessageDigest', 'java.security.MessageDigest', 'java.security', 'class', { isAbstract: true })],
  ['SecureRandom', cls('SecureRandom', 'java.security.SecureRandom', 'java.security')],

  // java.util - Misc utilities
  ['Random', cls('Random', 'java.util.Random', 'java.util')],
  ['Date', cls('Date', 'java.util.Date', 'java.util')],
  ['Calendar', cls('Calendar', 'java.util.Calendar', 'java.util', 'class', { isAbstract: true })],
  ['Locale', cls('Locale', 'java.util.Locale', 'java.util')],
  ['Properties', cls('Properties', 'java.util.Properties', 'java.util')],
  ['Objects', cls('Objects', 'java.util.Objects', 'java.util')],
  ['Base64', cls('Base64', 'java.util.Base64', 'java.util')],

  // Logging
  ['Logger', cls('Logger', 'java.util.logging.Logger', 'java.util.logging')],
]);

// =============================================================================
// Java Stdlib Static Methods (commonly called)
// =============================================================================

export const JAVA_STDLIB_FUNCTIONS: ReadonlyMap<string, FunctionSymbol> = new Map([
  // UUID
  ['UUID.randomUUID', fn('randomUUID', 'java.util.UUID.randomUUID', 'java.util', 'java.util.UUID', { returnType: 'UUID' })],
  ['UUID.fromString', fn('fromString', 'java.util.UUID.fromString', 'java.util', 'java.util.UUID', { parameterTypes: ['String'], returnType: 'UUID' })],

  // LocalDate
  ['LocalDate.now', fn('now', 'java.time.LocalDate.now', 'java.time', 'java.time.LocalDate', { returnType: 'LocalDate' })],
  ['LocalDate.of', fn('of', 'java.time.LocalDate.of', 'java.time', 'java.time.LocalDate', { parameterTypes: ['Int', 'Int', 'Int'], returnType: 'LocalDate' })],
  ['LocalDate.parse', fn('parse', 'java.time.LocalDate.parse', 'java.time', 'java.time.LocalDate', { parameterTypes: ['CharSequence'], returnType: 'LocalDate' })],

  // LocalDateTime
  ['LocalDateTime.now', fn('now', 'java.time.LocalDateTime.now', 'java.time', 'java.time.LocalDateTime', { returnType: 'LocalDateTime' })],
  ['LocalDateTime.of', fn('of', 'java.time.LocalDateTime.of', 'java.time', 'java.time.LocalDateTime', { parameterTypes: ['Int', 'Int', 'Int', 'Int', 'Int'], returnType: 'LocalDateTime' })],
  ['LocalDateTime.parse', fn('parse', 'java.time.LocalDateTime.parse', 'java.time', 'java.time.LocalDateTime', { parameterTypes: ['CharSequence'], returnType: 'LocalDateTime' })],

  // Instant
  ['Instant.now', fn('now', 'java.time.Instant.now', 'java.time', 'java.time.Instant', { returnType: 'Instant' })],
  ['Instant.ofEpochMilli', fn('ofEpochMilli', 'java.time.Instant.ofEpochMilli', 'java.time', 'java.time.Instant', { parameterTypes: ['Long'], returnType: 'Instant' })],

  // Duration
  ['Duration.ofSeconds', fn('ofSeconds', 'java.time.Duration.ofSeconds', 'java.time', 'java.time.Duration', { parameterTypes: ['Long'], returnType: 'Duration' })],
  ['Duration.ofMinutes', fn('ofMinutes', 'java.time.Duration.ofMinutes', 'java.time', 'java.time.Duration', { parameterTypes: ['Long'], returnType: 'Duration' })],
  ['Duration.ofHours', fn('ofHours', 'java.time.Duration.ofHours', 'java.time', 'java.time.Duration', { parameterTypes: ['Long'], returnType: 'Duration' })],
  ['Duration.ofDays', fn('ofDays', 'java.time.Duration.ofDays', 'java.time', 'java.time.Duration', { parameterTypes: ['Long'], returnType: 'Duration' })],
  ['Duration.between', fn('between', 'java.time.Duration.between', 'java.time', 'java.time.Duration', { parameterTypes: ['Temporal', 'Temporal'], returnType: 'Duration' })],

  // System
  ['System.currentTimeMillis', fn('currentTimeMillis', 'java.lang.System.currentTimeMillis', 'java.lang', 'java.lang.System', { returnType: 'Long' })],
  ['System.nanoTime', fn('nanoTime', 'java.lang.System.nanoTime', 'java.lang', 'java.lang.System', { returnType: 'Long' })],
  ['System.getenv', fn('getenv', 'java.lang.System.getenv', 'java.lang', 'java.lang.System', { parameterTypes: ['String'], returnType: 'String?' })],
  ['System.getProperty', fn('getProperty', 'java.lang.System.getProperty', 'java.lang', 'java.lang.System', { parameterTypes: ['String'], returnType: 'String?' })],

  // Optional
  ['Optional.of', fn('of', 'java.util.Optional.of', 'java.util', 'java.util.Optional', { parameterTypes: ['T'], returnType: 'Optional<T>' })],
  ['Optional.ofNullable', fn('ofNullable', 'java.util.Optional.ofNullable', 'java.util', 'java.util.Optional', { parameterTypes: ['T?'], returnType: 'Optional<T>' })],
  ['Optional.empty', fn('empty', 'java.util.Optional.empty', 'java.util', 'java.util.Optional', { returnType: 'Optional<T>' })],

  // Arrays
  ['Arrays.asList', fn('asList', 'java.util.Arrays.asList', 'java.util', 'java.util.Arrays', { parameterTypes: ['vararg T'], returnType: 'List<T>' })],
  ['Arrays.copyOf', fn('copyOf', 'java.util.Arrays.copyOf', 'java.util', 'java.util.Arrays', { parameterTypes: ['Array<T>', 'Int'], returnType: 'Array<T>' })],
  ['Arrays.sort', fn('sort', 'java.util.Arrays.sort', 'java.util', 'java.util.Arrays', { parameterTypes: ['Array<T>'], returnType: 'Unit' })],

  // Collections
  ['Collections.emptyList', fn('emptyList', 'java.util.Collections.emptyList', 'java.util', 'java.util.Collections', { returnType: 'List<T>' })],
  ['Collections.emptySet', fn('emptySet', 'java.util.Collections.emptySet', 'java.util', 'java.util.Collections', { returnType: 'Set<T>' })],
  ['Collections.emptyMap', fn('emptyMap', 'java.util.Collections.emptyMap', 'java.util', 'java.util.Collections', { returnType: 'Map<K, V>' })],
  ['Collections.singletonList', fn('singletonList', 'java.util.Collections.singletonList', 'java.util', 'java.util.Collections', { parameterTypes: ['T'], returnType: 'List<T>' })],
  ['Collections.unmodifiableList', fn('unmodifiableList', 'java.util.Collections.unmodifiableList', 'java.util', 'java.util.Collections', { parameterTypes: ['List<T>'], returnType: 'List<T>' })],

  // Objects
  ['Objects.equals', fn('equals', 'java.util.Objects.equals', 'java.util', 'java.util.Objects', { parameterTypes: ['Any?', 'Any?'], returnType: 'Boolean' })],
  ['Objects.hash', fn('hash', 'java.util.Objects.hash', 'java.util', 'java.util.Objects', { parameterTypes: ['vararg Any?'], returnType: 'Int' })],
  ['Objects.requireNonNull', fn('requireNonNull', 'java.util.Objects.requireNonNull', 'java.util', 'java.util.Objects', { parameterTypes: ['T?'], returnType: 'T' })],
  ['Objects.isNull', fn('isNull', 'java.util.Objects.isNull', 'java.util', 'java.util.Objects', { parameterTypes: ['Any?'], returnType: 'Boolean' })],
  ['Objects.nonNull', fn('nonNull', 'java.util.Objects.nonNull', 'java.util', 'java.util.Objects', { parameterTypes: ['Any?'], returnType: 'Boolean' })],

  // Base64
  ['Base64.getEncoder', fn('getEncoder', 'java.util.Base64.getEncoder', 'java.util', 'java.util.Base64', { returnType: 'Base64.Encoder' })],
  ['Base64.getDecoder', fn('getDecoder', 'java.util.Base64.getDecoder', 'java.util', 'java.util.Base64', { returnType: 'Base64.Decoder' })],

  // BigDecimal
  ['BigDecimal.valueOf', fn('valueOf', 'java.math.BigDecimal.valueOf', 'java.math', 'java.math.BigDecimal', { parameterTypes: ['Long'], returnType: 'BigDecimal' })],

  // Files (NIO)
  ['Files.readAllBytes', fn('readAllBytes', 'java.nio.file.Files.readAllBytes', 'java.nio.file', 'java.nio.file.Files', { parameterTypes: ['Path'], returnType: 'ByteArray' })],
  ['Files.readAllLines', fn('readAllLines', 'java.nio.file.Files.readAllLines', 'java.nio.file', 'java.nio.file.Files', { parameterTypes: ['Path'], returnType: 'List<String>' })],
  ['Files.write', fn('write', 'java.nio.file.Files.write', 'java.nio.file', 'java.nio.file.Files', { parameterTypes: ['Path', 'ByteArray'], returnType: 'Path' })],
  ['Files.exists', fn('exists', 'java.nio.file.Files.exists', 'java.nio.file', 'java.nio.file.Files', { parameterTypes: ['Path'], returnType: 'Boolean' })],
  ['Files.createDirectories', fn('createDirectories', 'java.nio.file.Files.createDirectories', 'java.nio.file', 'java.nio.file.Files', { parameterTypes: ['Path'], returnType: 'Path' })],
  ['Files.delete', fn('delete', 'java.nio.file.Files.delete', 'java.nio.file', 'java.nio.file.Files', { parameterTypes: ['Path'], returnType: 'Unit' })],

  // Paths
  ['Paths.get', fn('get', 'java.nio.file.Paths.get', 'java.nio.file', 'java.nio.file.Paths', { parameterTypes: ['String', 'vararg String'], returnType: 'Path' })],
]);

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get all Java stdlib symbols (functions + classes) as a single map.
 */
export function getJavaStdlibSymbols(): Map<string, Symbol> {
  const result = new Map<string, Symbol>();

  for (const [name, func] of JAVA_STDLIB_FUNCTIONS) {
    result.set(name, func);
  }

  for (const [name, clsSymbol] of JAVA_STDLIB_CLASSES) {
    result.set(name, clsSymbol);
  }

  return result;
}

/**
 * Lookup a Java stdlib function by name.
 */
export function lookupJavaStdlibFunction(name: string): FunctionSymbol | undefined {
  return JAVA_STDLIB_FUNCTIONS.get(name);
}

/**
 * Lookup a Java stdlib class by name.
 */
export function lookupJavaStdlibClass(name: string): ClassSymbol | undefined {
  return JAVA_STDLIB_CLASSES.get(name);
}

/**
 * Check if a function name is a known Java stdlib function.
 */
export function isJavaStdlibFunction(name: string): boolean {
  return JAVA_STDLIB_FUNCTIONS.has(name);
}

/**
 * Check if a class name is a known Java stdlib class.
 */
export function isJavaStdlibClass(name: string): boolean {
  return JAVA_STDLIB_CLASSES.has(name);
}

// =============================================================================
// Java Stdlib Provider (implements StdlibProvider interface)
// =============================================================================

/**
 * StdlibProvider implementation for Java.
 * Also used by Kotlin for Java interop (Kotlin runs on JVM and can use Java stdlib).
 */
export class JavaStdlibProvider implements StdlibProvider {
  // Java stdlib is also available in Kotlin (JVM interop)
  readonly languages: readonly SupportedLanguage[] = ['java', 'kotlin'];

  // java.lang.* is implicitly imported in Java
  readonly defaultWildcardImports: readonly string[] = ['java.lang'];

  lookupFunction(_name: string): FunctionSymbol | undefined {
    // Java doesn't have top-level functions, only static methods
    return undefined;
  }

  lookupClass(name: string): ClassSymbol | undefined {
    return JAVA_STDLIB_CLASSES.get(name);
  }

  lookupStaticMethod(qualifiedName: string): FunctionSymbol | undefined {
    // Java has static methods like UUID.randomUUID(), System.currentTimeMillis()
    return JAVA_STDLIB_FUNCTIONS.get(qualifiedName);
  }

  isKnownSymbol(name: string): boolean {
    return JAVA_STDLIB_CLASSES.has(name) || JAVA_STDLIB_FUNCTIONS.has(name);
  }

  getAllSymbols(): Map<string, Symbol> {
    return getJavaStdlibSymbols();
  }
}
