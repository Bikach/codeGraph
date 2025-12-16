#!/usr/bin/env npx tsx
/**
 * Test script for the CodeGraph indexer
 *
 * Usage:
 *   npx tsx src/test-index.ts /path/to/kotlin/project
 *
 * Prerequisites:
 *   - Neo4j running on bolt://localhost:7687 (docker-compose up -d)
 *
 * Options:
 *   --clear          Clear the database before indexing
 *   --dry-run        Parse and resolve only, don't write to Neo4j
 *   --exclude-tests  Exclude test files (*Test.kt, *Tests.kt, etc.)
 */

import { resolve, relative } from 'path';
import { readdir, readFile, stat } from 'fs/promises';
import { Neo4jClient } from './neo4j/neo4j.js';
import {
  getParserForFile,
  isFileSupported,
  buildSymbolTable,
  resolveSymbols,
  getResolutionStats,
  Neo4jWriter,
  type ParsedFile,
} from './indexer/index.js';

// =============================================================================
// Configuration
// =============================================================================

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

// =============================================================================
// Helpers
// =============================================================================

function log(message: string, indent = 0): void {
  const prefix = '  '.repeat(indent);
  console.log(`${prefix}${message}`);
}

function success(message: string): void {
  console.log(`✓ ${message}`);
}

function error(message: string): void {
  console.error(`✗ ${message}`);
}

function info(message: string): void {
  console.log(`ℹ ${message}`);
}

/**
 * Test file patterns to exclude when --exclude-tests is used
 */
const TEST_FILE_PATTERNS = [
  /Test\.kt$/,           // UserServiceTest.kt
  /Tests\.kt$/,          // UserServiceTests.kt
  /Spec\.kt$/,           // UserServiceSpec.kt
  /IT\.kt$/,             // UserServiceIT.kt (integration tests)
  /E2E\.kt$/,            // UserServiceE2E.kt (end-to-end tests)
  /Mock[A-Z].*\.kt$/,    // MockUserService.kt
  /Fake[A-Z].*\.kt$/,    // FakeUserRepository.kt
  /Stub[A-Z].*\.kt$/,    // StubPaymentGateway.kt
  /TestUtils?\.kt$/,     // TestUtil.kt, TestUtils.kt
  /TestHelper\.kt$/,     // TestHelper.kt
  /TestFixtures?\.kt$/,  // TestFixture.kt, TestFixtures.kt
];

/**
 * Test directory patterns to exclude when --exclude-tests is used
 */
const TEST_DIR_PATTERNS = [
  /[/\\]test[/\\]/,           // src/test/kotlin/...
  /[/\\]tests[/\\]/,          // src/tests/kotlin/...
  /[/\\]androidTest[/\\]/,    // Android instrumented tests
  /[/\\]testFixtures[/\\]/,   // Gradle test fixtures
  /[/\\]integrationTest[/\\]/, // Integration tests
  /[/\\]functionalTest[/\\]/, // Functional tests
];

function isTestFile(filePath: string): boolean {
  // Check directory patterns
  for (const pattern of TEST_DIR_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }

  // Check file name patterns
  const fileName = filePath.split(/[/\\]/).pop() || '';
  for (const pattern of TEST_FILE_PATTERNS) {
    if (pattern.test(fileName)) {
      return true;
    }
  }

  return false;
}

interface FindFilesOptions {
  excludeTests?: boolean;
}

async function findKotlinFiles(dir: string, options: FindFilesOptions = {}): Promise<string[]> {
  const files: string[] = [];
  const excludedTestFiles: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);

      // Skip common non-source directories
      if (entry.isDirectory()) {
        const skip = ['node_modules', '.git', 'build', 'out', '.gradle', '.idea', 'target'];
        if (!skip.includes(entry.name)) {
          await scan(fullPath);
        }
      } else if (entry.isFile() && isFileSupported(fullPath)) {
        // Check if we should exclude test files
        if (options.excludeTests && isTestFile(fullPath)) {
          excludedTestFiles.push(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dir);

  // Log excluded test files count if any
  if (options.excludeTests && excludedTestFiles.length > 0) {
    info(`Excluded ${excludedTestFiles.length} test files`);
  }

  return files.sort();
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const paths = args.filter((a) => !a.startsWith('--'));

  const clearBefore = flags.includes('--clear');
  const dryRun = flags.includes('--dry-run');
  const showUnresolved = flags.includes('--show-unresolved');
  const excludeTests = flags.includes('--exclude-tests');

  if (paths.length === 0) {
    console.log('Usage: npx tsx src/test-index.ts [options] <project-path>');
    console.log('');
    console.log('Options:');
    console.log('  --clear           Clear the database before indexing');
    console.log('  --dry-run         Parse and resolve only, skip Neo4j write');
    console.log('  --show-unresolved Show unresolved calls grouped by pattern');
    console.log('  --exclude-tests   Exclude test files (*Test.kt, src/test/, etc.)');
    console.log('');
    console.log('Example:');
    console.log('  npx tsx src/test-index.ts ~/projects/my-kotlin-app');
    process.exit(1);
  }

  const projectPath = resolve(paths[0]!);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║               CodeGraph Indexer - Test Run                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Verify project exists
  try {
    const projectStat = await stat(projectPath);
    if (!projectStat.isDirectory()) {
      error(`Not a directory: ${projectPath}`);
      process.exit(1);
    }
  } catch {
    error(`Project not found: ${projectPath}`);
    process.exit(1);
  }

  info(`Project: ${projectPath}`);
  info(`Options: ${clearBefore ? '--clear ' : ''}${dryRun ? '--dry-run ' : ''}${excludeTests ? '--exclude-tests' : ''}`);
  console.log('');

  // ==========================================================================
  // Step 1: Find Kotlin files
  // ==========================================================================
  console.log('┌─ Step 1: Scanning for Kotlin files ─────────────────────────┐');

  const files = await findKotlinFiles(projectPath, { excludeTests });

  if (files.length === 0) {
    error('No Kotlin files found in project');
    process.exit(1);
  }

  success(`Found ${files.length} Kotlin files`);
  console.log('');

  // Show first 10 files
  const showFiles = files.slice(0, 10);
  for (const file of showFiles) {
    log(relative(projectPath, file), 1);
  }
  if (files.length > 10) {
    log(`... and ${files.length - 10} more`, 1);
  }
  console.log('');

  // ==========================================================================
  // Step 2: Parse files
  // ==========================================================================
  console.log('┌─ Step 2: Parsing files ─────────────────────────────────────┐');

  const parsedFiles: ParsedFile[] = [];
  const parseErrors: { file: string; error: string }[] = [];
  let parseCount = 0;

  for (const filePath of files) {
    parseCount++;
    const progress = `[${parseCount}/${files.length}]`;

    try {
      const parser = await getParserForFile(filePath);
      if (!parser) {
        throw new Error('No parser found');
      }

      const source = await readFile(filePath, 'utf-8');
      const parsed = await parser.parse(source, filePath);
      parsedFiles.push(parsed);

      // Show progress every 10 files
      if (parseCount % 10 === 0 || parseCount === files.length) {
        process.stdout.write(`\r  ${progress} Parsing...`);
      }
    } catch (err) {
      parseErrors.push({
        file: relative(projectPath, filePath),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(''); // New line after progress
  success(`Parsed ${parsedFiles.length}/${files.length} files`);

  if (parseErrors.length > 0) {
    error(`Failed to parse ${parseErrors.length} files:`);
    for (const { file, error: msg } of parseErrors.slice(0, 5)) {
      log(`${file}: ${msg}`, 1);
    }
    if (parseErrors.length > 5) {
      log(`... and ${parseErrors.length - 5} more errors`, 1);
    }
  }

  // Show parsing stats
  let totalClasses = 0;
  let totalFunctions = 0;
  let totalProperties = 0;
  let totalCalls = 0;

  for (const parsed of parsedFiles) {
    totalClasses += parsed.classes.length;
    totalFunctions += parsed.topLevelFunctions.length;
    totalProperties += parsed.topLevelProperties.length;

    for (const cls of parsed.classes) {
      totalFunctions += cls.functions.length;
      totalProperties += cls.properties.length;
      for (const fn of cls.functions) {
        totalCalls += fn.calls.length;
      }
      // Count nested classes
      const countNested = (classes: typeof parsed.classes): void => {
        for (const c of classes) {
          totalClasses++;
          totalFunctions += c.functions.length;
          totalProperties += c.properties.length;
          for (const fn of c.functions) {
            totalCalls += fn.calls.length;
          }
          countNested(c.nestedClasses);
        }
      };
      countNested(cls.nestedClasses);
    }

    for (const fn of parsed.topLevelFunctions) {
      totalCalls += fn.calls.length;
    }
  }

  // Correct double-counting of classes (we counted them once in parsed.classes.length, then again in nested loop)
  totalClasses = 0;
  for (const parsed of parsedFiles) {
    const countClasses = (classes: typeof parsed.classes): number => {
      let count = classes.length;
      for (const c of classes) {
        count += countClasses(c.nestedClasses);
      }
      return count;
    };
    totalClasses += countClasses(parsed.classes);
  }

  console.log('');
  log(`Classes/Interfaces/Objects: ${totalClasses}`, 1);
  log(`Functions: ${totalFunctions}`, 1);
  log(`Properties: ${totalProperties}`, 1);
  log(`Total calls (before resolution): ${totalCalls}`, 1);
  console.log('');

  // ==========================================================================
  // Step 3: Resolve symbols
  // ==========================================================================
  console.log('┌─ Step 3: Resolving symbols ─────────────────────────────────┐');

  const symbolTable = buildSymbolTable(parsedFiles);
  const resolvedFiles = resolveSymbols(parsedFiles, symbolTable);
  const stats = getResolutionStats(resolvedFiles);

  success(`Symbol table: ${symbolTable.byFqn.size} symbols`);
  const ratePercent = Math.round(stats.resolutionRate * 100);
  success(`Resolved ${stats.resolvedCalls}/${stats.totalCalls} calls (${ratePercent}%)`);
  console.log('');

  // Show unresolved count if any
  if (stats.unresolvedCalls > 0) {
    info(`Unresolved calls: ${stats.unresolvedCalls}`);
    console.log('');

    // Collect and display unresolved calls if flag is set
    if (showUnresolved) {
      console.log('┌─ Unresolved Calls Analysis ─────────────────────────────────┐');

      // Collect all unresolved calls
      const unresolvedByName = new Map<string, { count: number; receivers: Set<string>; files: Set<string> }>();

      // Build a set of resolved call locations for fast lookup
      // Key format: "filePath:startLine:startColumn"
      const buildResolvedCallsSet = (resolvedCalls: typeof resolvedFiles[0]['resolvedCalls'], filePath: string): Set<string> => {
        const resolvedSet = new Set<string>();
        for (const rc of resolvedCalls) {
          const key = `${filePath}:${rc.location.startLine}:${rc.location.startColumn}`;
          resolvedSet.add(key);
        }
        return resolvedSet;
      };

      const collectUnresolved = (
        calls: Array<{ name: string; receiver?: string; location: { startLine: number; startColumn: number } }>,
        resolvedSet: Set<string>,
        filePath: string
      ): void => {
        for (const call of calls) {
          const callKey = `${filePath}:${call.location.startLine}:${call.location.startColumn}`;
          // If this call's location is NOT in the resolved set, it's unresolved
          if (!resolvedSet.has(callKey)) {
            const key = call.name;
            if (!unresolvedByName.has(key)) {
              unresolvedByName.set(key, { count: 0, receivers: new Set(), files: new Set() });
            }
            const entry = unresolvedByName.get(key)!;
            entry.count++;
            if (call.receiver) {
              entry.receivers.add(call.receiver);
            }
            entry.files.add(relative(projectPath, filePath));
          }
        }
      };

      for (const resolved of resolvedFiles) {
        const resolvedSet = buildResolvedCallsSet(resolved.resolvedCalls, resolved.filePath);

        for (const cls of resolved.classes) {
          for (const fn of cls.functions) {
            collectUnresolved(fn.calls, resolvedSet, resolved.filePath);
          }
          // Nested classes
          const processNested = (classes: typeof resolved.classes): void => {
            for (const c of classes) {
              for (const fn of c.functions) {
                collectUnresolved(fn.calls, resolvedSet, resolved.filePath);
              }
              processNested(c.nestedClasses);
            }
          };
          processNested(cls.nestedClasses);
        }
        for (const fn of resolved.topLevelFunctions) {
          collectUnresolved(fn.calls, resolvedSet, resolved.filePath);
        }
      }

      // Sort by count (most common first)
      const sorted = [...unresolvedByName.entries()].sort((a, b) => b[1].count - a[1].count);

      // Group by category
      const categories: Record<string, typeof sorted> = {
        'Kotlin stdlib': [],
        'Java stdlib': [],
        'Framework (Spring, etc.)': [],
        'Operators/Special': [],
        'Other': [],
      };

      const kotlinStdlib = /^(let|also|apply|run|with|takeIf|takeUnless|repeat|require|check|error|TODO|println|print|listOf|mapOf|setOf|mutableListOf|mutableMapOf|mutableSetOf|arrayOf|sequenceOf|buildList|buildMap|buildSet|associate|associateBy|associateWith|groupBy|partition|chunked|windowed|zip|zipWithNext|flatten|flatMap|map|filter|filterNot|filterNotNull|filterIsInstance|first|firstOrNull|last|lastOrNull|single|singleOrNull|find|findLast|any|all|none|count|sum|sumOf|average|min|minBy|minOf|max|maxBy|maxOf|reduce|fold|scan|sortedBy|sortedByDescending|sortedWith|reversed|shuffled|distinct|distinctBy|drop|dropWhile|dropLast|take|takeWhile|takeLast|plus|minus|union|intersect|subtract|contains|containsAll|indexOf|lastIndexOf|get|getOrNull|getOrElse|getOrDefault|set|remove|removeAll|retainAll|clear|add|addAll|put|putAll|entries|keys|values|size|isEmpty|isNotEmpty|isNullOrEmpty|isNullOrBlank|isBlank|isNotBlank|trim|trimStart|trimEnd|padStart|padEnd|replace|replaceFirst|replaceLast|split|lines|substringBefore|substringAfter|substringBeforeLast|substringAfterLast|startsWith|endsWith|removeSurrounding|removePrefix|removeSuffix|uppercase|lowercase|capitalize|decapitalize|toInt|toIntOrNull|toLong|toLongOrNull|toDouble|toDoubleOrNull|toFloat|toFloatOrNull|toBoolean|toBooleanStrict|toString|toList|toMutableList|toSet|toMutableSet|toMap|toMutableMap|toSortedMap|toSortedSet|toTypedArray|toByteArray|toCharArray|toIntArray|toLongArray|toFloatArray|toDoubleArray|toBooleanArray|toShortArray|asSequence|asIterable|iterator|forEach|forEachIndexed|onEach|onEachIndexed|joinToString|joinTo|format|compareTo|coerceIn|coerceAtLeast|coerceAtMost|until|downTo|step|rangeTo|rangeUntil|copy|component\d+|hashCode|equals|invoke|getValue|setValue|provideDelegate|lazy|synchronized|use|useLines|readLine|readLines|readText|readBytes|writeText|writeBytes|appendText|appendBytes|bufferedReader|bufferedWriter|inputStream|outputStream|reader|writer|forEachLine|copyTo|copyRecursively|deleteRecursively|walk|walkTopDown|walkBottomUp|resolve|resolveSibling|relativeTo|relativeToOrNull|relativeToOrSelf|normalize|absolute|absoluteFile|canonicalFile|canonicalPath|invariantSeparatorsPath|nameWithoutExtension|extension|parent|parentFile|name|path|exists|isFile|isDirectory|isHidden|isReadable|isWritable|isExecutable|canRead|canWrite|canExecute|length|lastModified|setLastModified|setReadOnly|setWritable|setReadable|setExecutable|createNewFile|delete|deleteOnExit|mkdir|mkdirs|renameTo|listFiles|list|createTempFile|createTempDirectory)$/;

      const javaStdlib = /^(valueOf|values|of|ofNullable|empty|stream|parallelStream|collect|toArray|asList|copyOf|nCopies|fill|sort|binarySearch|reverse|shuffle|swap|rotate|replaceAll|frequency|disjoint|min|max|singleton|singletonList|singletonMap|emptyList|emptySet|emptyMap|unmodifiableList|unmodifiableSet|unmodifiableMap|synchronizedList|synchronizedSet|synchronizedMap|checkedList|checkedSet|checkedMap|newArrayList|newHashSet|newHashMap|newLinkedHashMap|newTreeMap|newTreeSet|newConcurrentHashMap|getClass|wait|notify|notifyAll|finalize|clone|now|parse|format|of|ofInstant|ofEpochMilli|ofEpochSecond|toInstant|toEpochMilli|toEpochSecond|atZone|atOffset|atStartOfDay|plusDays|plusHours|plusMinutes|plusSeconds|plusMillis|plusNanos|plusWeeks|plusMonths|plusYears|minusDays|minusHours|minusMinutes|minusSeconds|minusMillis|minusNanos|minusWeeks|minusMonths|minusYears|withDayOfMonth|withMonth|withYear|withHour|withMinute|withSecond|withNano|getDayOfMonth|getDayOfWeek|getDayOfYear|getMonth|getMonthValue|getYear|getHour|getMinute|getSecond|getNano|isBefore|isAfter|isEqual|truncatedTo|until|between|from|query|adjustInto|range|get|getLong|isSupported|with|plus|minus|multipliedBy|dividedBy|negated|abs|toMillis|toSeconds|toMinutes|toHours|toDays|toNanos|getSeconds|getNano|isZero|isNegative|isPositive|compareTo|append|insert|delete|deleteCharAt|setCharAt|charAt|substring|length|capacity|ensureCapacity|trimToSize|setLength|reverse|indexOf|lastIndexOf|replace|toString|getBytes|toCharArray|toLowerCase|toUpperCase|trim|strip|stripLeading|stripTrailing|isBlank|isEmpty|lines|indent|stripIndent|translateEscapes|formatted|repeat|matches|contains|startsWith|endsWith|regionMatches|contentEquals|equalsIgnoreCase|compareTo|compareToIgnoreCase|concat|join|valueOf|copyValueOf|format|intern|chars|codePoints|getChars|subSequence|split|replaceAll|replaceFirst|replace)$/;

      const frameworkPatterns = /^(inject|autowired|bean|component|service|repository|controller|restController|requestMapping|getMapping|postMapping|putMapping|deleteMapping|patchMapping|pathVariable|requestBody|requestParam|responseBody|responseStatus|transactional|async|scheduled|cacheable|cacheEvict|cachePut|validated|valid|notNull|notBlank|notEmpty|size|min|max|pattern|email|past|future|positive|negative|assertNotNull|assertTrue|assertFalse|assertEquals|assertNotEquals|assertSame|assertNotSame|assertNull|assertArrayEquals|assertIterableEquals|assertThrows|assertDoesNotThrow|assertTimeout|assertTimeoutPreemptively|fail|assume|given|when|then|verify|verifyNoMoreInteractions|verifyNoInteractions|mock|spy|doReturn|doThrow|doAnswer|doNothing|doCallRealMethod|any|anyInt|anyLong|anyString|anyList|anyMap|anySet|eq|same|isNull|isNotNull|argThat|matches|contains|startsWith|endsWith|never|times|atLeast|atMost|only|timeout|after|inOrder|ignoreStubs|reset|clearInvocations|mockStatic|mockConstruction)$/i;

      const operatorPatterns = /^(plus|minus|times|div|rem|mod|rangeTo|rangeUntil|contains|get|set|invoke|compareTo|inc|dec|unaryPlus|unaryMinus|not|iterator|next|hasNext|getValue|setValue|provideDelegate|component\d+)$/;

      for (const [name, data] of sorted) {
        if (kotlinStdlib.test(name)) {
          categories['Kotlin stdlib']!.push([name, data]);
        } else if (javaStdlib.test(name)) {
          categories['Java stdlib']!.push([name, data]);
        } else if (frameworkPatterns.test(name)) {
          categories['Framework (Spring, etc.)']!.push([name, data]);
        } else if (operatorPatterns.test(name)) {
          categories['Operators/Special']!.push([name, data]);
        } else {
          categories['Other']!.push([name, data]);
        }
      }

      // Display each category
      for (const [category, items] of Object.entries(categories)) {
        if (items.length === 0) continue;

        const totalInCategory = items.reduce((sum, [, d]) => sum + d.count, 0);
        console.log('');
        console.log(`  📦 ${category} (${items.length} unique, ${totalInCategory} calls):`);

        // Show top 15 in each category
        for (const [name, data] of items.slice(0, 15)) {
          const receivers = data.receivers.size > 0 ? ` [receivers: ${[...data.receivers].slice(0, 3).join(', ')}${data.receivers.size > 3 ? '...' : ''}]` : '';
          log(`${name} (${data.count}x)${receivers}`, 2);
        }
        if (items.length > 15) {
          log(`... and ${items.length - 15} more`, 2);
        }
      }
      console.log('');
    }
  }

  // ==========================================================================
  // Step 4: Write to Neo4j
  // ==========================================================================
  if (dryRun) {
    console.log('┌─ Step 4: Skipped (--dry-run) ─────────────────────────────┐');
    info('Dry run mode - not writing to Neo4j');
    console.log('');
  } else {
    console.log('┌─ Step 4: Writing to Neo4j ─────────────────────────────────┐');

    // Connect to Neo4j
    info(`Connecting to ${NEO4J_URI}...`);
    const client = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

    try {
      await client.connect();
      success('Connected to Neo4j');
    } catch (err) {
      error(`Failed to connect to Neo4j: ${err instanceof Error ? err.message : String(err)}`);
      console.log('');
      info('Make sure Neo4j is running:');
      log('docker-compose up -d', 1);
      process.exit(1);
    }

    try {
      const writer = new Neo4jWriter(client, {
        batchSize: 500,
        clearBefore,
      });

      // Clear if requested
      if (clearBefore) {
        info('Clearing database...');
        const clearResult = await writer.clearGraph();
        success(`Cleared ${clearResult.nodesDeleted} nodes, ${clearResult.relationshipsDeleted} relationships`);
      }

      // Ensure constraints
      info('Ensuring constraints and indexes...');
      await writer.ensureConstraintsAndIndexes();
      success('Constraints ready');

      // Write files
      info('Writing graph...');
      const writeResult = await writer.writeFiles(resolvedFiles);

      console.log('');
      success('Graph written successfully!');
      console.log('');
      log(`Files processed: ${writeResult.filesProcessed}`, 1);
      log(`Nodes created: ${writeResult.nodesCreated}`, 1);
      log(`Relationships created: ${writeResult.relationshipsCreated}`, 1);

      if (writeResult.errors.length > 0) {
        console.log('');
        error(`${writeResult.errors.length} errors during write:`);
        for (const err of writeResult.errors.slice(0, 5)) {
          log(`${err.filePath}: ${err.message}`, 1);
        }
      }
    } finally {
      await client.close();
    }
  }

  // ==========================================================================
  // Done
  // ==========================================================================
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        Done!                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  if (!dryRun) {
    info('Explore your code graph at http://localhost:7474');
    console.log('');
    info('Example Cypher queries:');
    log('MATCH (c:Class) RETURN c.name, c.fqn LIMIT 10', 1);
    log('MATCH (f:Function)-[:CALLS]->(g:Function) RETURN f.name, g.name LIMIT 10', 1);
    log('MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface) RETURN c.name, i.name', 1);
  }
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
