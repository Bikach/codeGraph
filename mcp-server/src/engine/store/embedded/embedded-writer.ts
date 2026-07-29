import { basename } from 'node:path';
import type { LbugValue, QueryResult } from '@ladybugdb/core';
import type {
  GraphWriteStore,
  WriteResult,
  WriterOptions,
  ClearResult,
} from '../graph-write-store.js';
import type { ResolvedFile, ParsedFunction } from '../../../indexer/types.js';
import type { GraphDomainAnalysis } from '../../../indexer/domain/index.js';
import { resolveTypeNames } from '../../../indexer/type-extraction.js';
import { topLevelSymbolFqn, stripFileQualifier } from '../../../indexer/fqn.js';
import {
  buildAllImportResolutionMaps,
  type ImportResolutionMap,
} from '../../../indexer/resolver/module-resolver/index.js';
import type { EmbeddedConnection } from './connection.js';
import { ensureSchema as applySchema } from './schema.js';
import { fqnOf, isTestPath, SYMBOL_TABLES, ALL_NODE_TABLES, REL_TABLES } from './shared.js';

export class EmbeddedWriter implements GraphWriteStore {
  constructor(private readonly cx: EmbeddedConnection) {}

  /** Forward to the shared connection so the moved method bodies keep using `this.run(...)` verbatim. */
  private run(statement: string, params?: Record<string, LbugValue>): Promise<QueryResult> {
    return this.cx.run(statement, params);
  }

  async ensureSchema(): Promise<void> {
    return applySchema(this.cx);
  }

  /** Map a parsed class kind to its node table (mirrors the writer's getClassLabel). */
  private classTable(kind: 'class' | 'interface' | 'object' | 'enum' | 'annotation'): string {
    if (kind === 'interface') return 'Interface';
    if (kind === 'object') return 'Object';
    return 'Class'; // class, enum, annotation
  }

  private async createFunctionNode(
    fqn: string,
    fn: { name: string; visibility: string; location: { filePath: string; startLine: number } },
    language: string
  ): Promise<void> {
    // MERGE (not CREATE): real code has FQN collisions (extension fns, overloads) that share an
    // fqn — collapse them onto one node, like the Neo4j writer.
    await this.run(
      'MERGE (f:Function {fqn: $fqn}) SET f.name = $name, f.visibility = $visibility, f.filePath = $filePath, f.lineNumber = $lineNumber, f.language = $language',
      { fqn, name: fn.name, visibility: fn.visibility, filePath: fn.location.filePath, lineNumber: fn.location.startLine, language }
    );
  }

  private async createPropertyNode(
    fqn: string,
    prop: { name: string; visibility: string; location: { filePath: string; startLine: number } },
    language: string
  ): Promise<void> {
    await this.run(
      'MERGE (p:Property {fqn: $fqn}) SET p.name = $name, p.visibility = $visibility, p.filePath = $filePath, p.lineNumber = $lineNumber, p.language = $language',
      { fqn, name: prop.name, visibility: prop.visibility, filePath: prop.location.filePath, lineNumber: prop.location.startLine, language }
    );
  }

  /**
   * Cypher constraint that pins a name-matched node (`alias`) to the SAME language and project as the
   * source — so a TS `User` never links to a Java `User`, and project A never links to project B's
   * homonyms. Mutates `params` with the bind values. `filePath STARTS WITH` reuses the existing column
   * (no project column needed); the language column was added for this. Project clause is skipped when
   * no projectPath is given (single in-memory graph — no cross-project risk).
   */
  private scopeClause(
    alias: string,
    language: string,
    projectPath: string | undefined,
    params: Record<string, LbugValue>
  ): string {
    params[`${alias}Lang`] = language;
    let clause = `${alias}.language = $${alias}Lang`;
    if (projectPath) {
      params[`${alias}Proj`] = projectPath;
      clause += ` AND ${alias}.filePath STARTS WITH $${alias}Proj`;
    }
    return clause;
  }

  /**
   * Derive + write USES edges from:
   *  - function parameter/receiver types  (Function -> type),
   *  - class property types               (Class/Interface/Object -> type, e.g. injected deps).
   * Reuses the shared `resolveTypeNames` (generics unwrap, primitive skip, import resolution).
   */
  private async writeUses(files: ResolvedFile[], projectPath?: string): Promise<number> {
    const importMaps = buildAllImportResolutionMaps(files);
    // sourceFqn = the function OR the class that uses the type; sourceTable = its node table.
    const usesData: { sourceFqn: string; sourceTable: string; typeName: string; typeFqn?: string; language: string }[] = [];

    const collectFn = (func: ParsedFunction, functionFqn: string, language: string, importMap?: ImportResolutionMap): void => {
      const push = (type: string | undefined): void => {
        for (const { name, fqn } of resolveTypeNames(type, importMap)) {
          usesData.push({ sourceFqn: functionFqn, sourceTable: 'Function', typeName: name, typeFqn: fqn, language });
        }
      };
      for (const param of func.parameters) {
        push(param.type);
        if (param.functionType) {
          for (const pt of param.functionType.parameterTypes) push(pt);
          push(param.functionType.returnType);
          push(param.functionType.receiverType);
        }
      }
      push(func.receiverType);
      // Return type too (e.g. `getDealer(): Dealer`, `find(): Promise<JobOrder>`). resolveTypeNames
      // unwraps generics, so the inner type (JobOrder) becomes the USES target. Without this,
      // data types only referenced as return/param-less results were invisible to get_impact.
      push(func.returnType);
    };

    for (const file of files) {
      const importMap = importMaps.get(file.filePath);
      for (const cls of file.classes) {
        const classFqn = topLevelSymbolFqn(file.packageName, file.filePath, cls.name);
        const classTable = this.classTable(cls.kind);
        for (const method of cls.functions) collectFn(method, `${classFqn}.${method.name}`, file.language, importMap);
        // Class property types (fields / constructor-injected dependencies).
        for (const prop of cls.properties) {
          for (const { name, fqn } of resolveTypeNames(prop.type, importMap)) {
            usesData.push({ sourceFqn: classFqn, sourceTable: classTable, typeName: name, typeFqn: fqn, language: file.language });
          }
        }
      }
      for (const fn of file.topLevelFunctions) collectFn(fn, topLevelSymbolFqn(file.packageName, file.filePath, fn.name), file.language, importMap);
    }

    // Deduplicate by source + resolved type.
    const unique = new Map<string, (typeof usesData)[number]>();
    for (const u of usesData) {
      const key = `${u.sourceFqn}:${u.typeFqn || u.typeName}`;
      if (!unique.has(key)) unique.set(key, u);
    }

    let created = 0;
    for (const u of unique.values()) {
      const target = await this.resolveType(u.typeName, u.typeFqn, u.language, projectPath);
      if (!target || (u.sourceTable === target.table && u.sourceFqn === target.fqn)) continue; // no self-USES
      await this.run(
        `MATCH (s:${u.sourceTable} {fqn: $sfqn}), (t:${target.table} {fqn: $tfqn}) CREATE (s)-[:USES]->(t)`,
        { sfqn: u.sourceFqn, tfqn: target.fqn }
      );
      created++;
    }
    return created;
  }

  /**
   * Resolve a type reference to a concrete (table, fqn): by FQN first, then by name. Both lookups are
   * scoped to the source's language (+ project) so a name like `User` never resolves to a homonym in
   * another language or another indexed project (cross-contamination).
   */
  private async resolveType(
    typeName: string,
    typeFqn: string | undefined,
    language: string,
    projectPath?: string
  ): Promise<{ table: string; fqn: string } | null> {
    if (typeFqn) {
      const params: Record<string, LbugValue> = { ref: typeFqn };
      const scope = this.scopeClause('t', language, projectPath, params);
      const result = await this.run(
        `MATCH (t:Class:Interface) WHERE t.fqn = $ref AND ${scope} RETURN label(t) AS tbl, t.fqn AS fqn`,
        params
      );
      const rows = await result.getAll();
      if (rows.length > 0) return { table: rows[0]!.tbl as string, fqn: rows[0]!.fqn as string };
    }
    const params: Record<string, LbugValue> = { ref: typeName };
    const scope = this.scopeClause('t', language, projectPath, params);
    const result = await this.run(
      `MATCH (t:Class:Interface) WHERE t.name = $ref AND ${scope} RETURN label(t) AS tbl, t.fqn AS fqn`,
      params
    );
    const rows = await result.getAll();
    if (rows.length > 0) return { table: rows[0]!.tbl as string, fqn: rows[0]!.fqn as string };
    return null;
  }

  async writeFiles(files: ResolvedFile[], options: WriterOptions = {}): Promise<WriteResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    // Project node (when a project path is given) — required by findProject. Name defaults to the
    // directory basename, like the Neo4j writer.
    if (options.projectPath) {
      await this.run('MERGE (p:Project {path: $path}) SET p.name = $name', {
        path: options.projectPath,
        name: options.projectName || basename(options.projectPath),
      });
      nodesCreated++;
    }

    // Nodes (+ DECLARES) first.
    for (const file of files) {
      // Top-level functions.
      for (const fn of file.topLevelFunctions) {
        await this.createFunctionNode(topLevelSymbolFqn(file.packageName, file.filePath, fn.name), fn, file.language);
        nodesCreated++;
      }
      // Top-level properties.
      for (const prop of file.topLevelProperties) {
        await this.createPropertyNode(fqnOf(file.packageName, prop.name), prop, file.language);
        nodesCreated++;
      }
      // Classes / interfaces / objects + their methods (DECLARES). Nested classes deferred.
      for (const cls of file.classes) {
        const table = this.classTable(cls.kind);
        const classFqn = topLevelSymbolFqn(file.packageName, file.filePath, cls.name);
        await this.run(
          `MERGE (c:${table} {fqn: $fqn}) SET c.name = $name, c.visibility = $visibility, c.filePath = $filePath, c.lineNumber = $lineNumber, c.language = $language`,
          {
            fqn: classFqn,
            name: cls.name,
            visibility: cls.visibility,
            filePath: cls.location.filePath,
            lineNumber: cls.location.startLine,
            language: file.language,
          }
        );
        nodesCreated++;

        for (const method of cls.functions) {
          const methodFqn = `${classFqn}.${method.name}`;
          await this.createFunctionNode(methodFqn, method, file.language);
          nodesCreated++;
          await this.run(
            `MATCH (c:${table} {fqn: $classFqn}), (f:Function {fqn: $methodFqn}) CREATE (c)-[:DECLARES]->(f)`,
            { classFqn, methodFqn }
          );
          relationshipsCreated++;
        }

        // Class properties (DECLARES Class->Property deferred; symbols only need the node).
        for (const prop of cls.properties) {
          await this.createPropertyNode(`${classFqn}.${prop.name}`, prop, file.language);
          nodesCreated++;
        }
      }
    }

    // Then CALLS relationships (resolved calls). A constructor call resolves to `<Class>.<init>` —
    // there is no Function node for `<init>`, so model it as a USES edge (the function instantiates,
    // i.e. depends on, that type). This keeps DI wiring (new XUseCase()) visible to get_neighbors /
    // god-nodes / module-overview, on the same edge set as the rest of the coupling.
    const CTOR_SUFFIX = '.<init>';
    for (const file of files) {
      for (const call of file.resolvedCalls) {
        if (call.toFqn.endsWith(CTOR_SUFFIX)) {
          // `new X()` instantiates a class. Single-label target: LadybugDB forbids CREATE of a rel
          // bound by a multi-label node.
          const classFqn = call.toFqn.slice(0, -CTOR_SUFFIX.length);
          // Simple name = last dotted segment of the file-qualifier-stripped fqn (B-9: a file-qualified
          // package-less class fqn embeds the file path, whose dots must not be split on here).
          const className = stripFileQualifier(classFqn).split('.').pop();
          const params: Record<string, LbugValue> = { from: call.fromFqn, classFqn, className: className ?? classFqn };
          const scope = this.scopeClause('b', file.language, options.projectPath, params);
          await this.run(
            `MATCH (a:Function {fqn: $from}), (b:Class)
             WHERE (b.fqn = $classFqn OR b.name = $className) AND ${scope}
             CREATE (a)-[:USES]->(b)`,
            params
          );
        } else {
          await this.run(
            'MATCH (a:Function {fqn: $from}), (b:Function {fqn: $to}) CREATE (a)-[:CALLS]->(b)',
            { from: call.fromFqn, to: call.toFqn }
          );
        }
        relationshipsCreated++;
      }
    }

    // Finally inheritance (EXTENDS/IMPLEMENTS), once all type nodes exist. Targets are resolved by
    // FQN or simple name (mirrors the Neo4j writer's fqn-or-name COALESCE lookup).
    for (const file of files) {
      for (const cls of file.classes) {
        const childTable = this.classTable(cls.kind);
        const childFqn = topLevelSymbolFqn(file.packageName, file.filePath, cls.name);

        // EXTENDS: parent lives in the same table family (Class->Class, Interface->Interface).
        if (cls.superClass && (childTable === 'Class' || childTable === 'Interface')) {
          const params: Record<string, LbugValue> = { childFqn, ref: cls.superClass };
          const scope = this.scopeClause('parent', file.language, options.projectPath, params);
          await this.run(
            `MATCH (child:${childTable} {fqn: $childFqn}), (parent:${childTable})
             WHERE (parent.fqn = $ref OR parent.name = $ref) AND ${scope}
             CREATE (child)-[:EXTENDS]->(parent)`,
            params
          );
          relationshipsCreated++;
        }

        // IMPLEMENTS: Class/Object -> Interface.
        if (childTable === 'Class' || childTable === 'Object') {
          for (const iface of cls.interfaces) {
            const params: Record<string, LbugValue> = { childFqn, ref: iface };
            const scope = this.scopeClause('iface', file.language, options.projectPath, params);
            await this.run(
              `MATCH (child:${childTable} {fqn: $childFqn}), (iface:Interface)
               WHERE (iface.fqn = $ref OR iface.name = $ref) AND ${scope}
               CREATE (child)-[:IMPLEMENTS]->(iface)`,
              params
            );
            relationshipsCreated++;
          }
        }
      }
    }

    // USES (Function -> type used in its parameters/receiver), once all nodes exist.
    relationshipsCreated += await this.writeUses(files, options.projectPath);

    return { nodesCreated, relationshipsCreated, filesProcessed: files.length, errors: [] };
  }

  /** Domain PK, scoped per project so domains of different projects never collide in a shared DB. */
  private domainId(projectPath: string, name: string): string {
    return `${projectPath}::${name}`;
  }

  /**
   * Persist the global domain analysis (§3bis-B): named Domain nodes + weighted DEPENDS_ON edges.
   * Per-domain file counts AND cross-domain dependency weights are derived from the PERSISTED graph
   * (the same CALLS/USES/EXTENDS/IMPLEMENTS edge set god-nodes reads — so DOMAIN_DEPS and HOTSPOTS
   * agree), split into all-vs-prod (test files excluded). Call AFTER writeFiles.
   */
  async writeDomains(
    analysis: GraphDomainAnalysis,
    projectPath: string
  ): Promise<{ domainsCreated: number; dependenciesCreated: number }> {
    const { domains, fileDomain, fileGroupKey } = analysis;

    // File counts per domain (all + prod) from the file → domain map.
    const fileCount = new Map<string, number>();
    const prodFileCount = new Map<string, number>();
    for (const [filePath, domain] of fileDomain) {
      fileCount.set(domain, (fileCount.get(domain) ?? 0) + 1);
      if (!isTestPath(filePath)) prodFileCount.set(domain, (prodFileCount.get(domain) ?? 0) + 1);
    }

    // Prod-only package set per domain (packages backed by ≥1 non-test file). Needs fileGroupKey;
    // without it we keep the full package list (don't filter what we can't classify).
    const prodPackages = new Map<string, Set<string>>();
    if (fileGroupKey) {
      for (const [filePath, groupKey] of fileGroupKey) {
        if (isTestPath(filePath)) continue;
        const domain = fileDomain.get(filePath);
        if (!domain) continue;
        if (!prodPackages.has(domain)) prodPackages.set(domain, new Set());
        prodPackages.get(domain)!.add(groupKey);
      }
    }

    let domainsCreated = 0;
    for (const domain of domains) {
      const prodPkgs = fileGroupKey
        ? [...(prodPackages.get(domain.name) ?? [])].sort()
        : domain.packages;
      await this.run(
        `MERGE (d:Domain {id: $id})
         SET d.name = $name, d.projectPath = $projectPath,
             d.fileCount = $fileCount, d.prodFileCount = $prodFileCount,
             d.packages = $packages, d.prodPackages = $prodPackages`,
        {
          id: this.domainId(projectPath, domain.name),
          name: domain.name,
          projectPath,
          fileCount: fileCount.get(domain.name) ?? 0,
          prodFileCount: prodFileCount.get(domain.name) ?? 0,
          packages: domain.packages.join(','),
          prodPackages: prodPkgs.join(','),
        }
      );
      domainsCreated++;
    }

    // Cross-domain dependency weights from the persisted semantic edges (all + prod).
    const edgeRows = await (
      await this.run(
        `MATCH (a:Class:Interface:Function:Object)-[:CALLS|USES|EXTENDS|IMPLEMENTS]->(b:Class:Interface:Function:Object)
         WHERE a <> b AND a.filePath STARTS WITH $projectPath AND b.filePath STARTS WITH $projectPath
         RETURN a.filePath AS fromFile, b.filePath AS toFile`,
        { projectPath }
      )
    ).getAll();

    const weight = new Map<string, number>();
    const prodWeight = new Map<string, number>();
    for (const r of edgeRows) {
      const fromFile = r.fromFile as string;
      const toFile = r.toFile as string;
      const from = fileDomain.get(fromFile);
      const to = fileDomain.get(toFile);
      if (!from || !to || from === to) continue;
      const key = `${from} ${to}`;
      weight.set(key, (weight.get(key) ?? 0) + 1);
      if (!isTestPath(fromFile) && !isTestPath(toFile)) {
        prodWeight.set(key, (prodWeight.get(key) ?? 0) + 1);
      }
    }

    let dependenciesCreated = 0;
    for (const [key, w] of weight) {
      const sep = key.indexOf(' ');
      const from = key.slice(0, sep);
      const to = key.slice(sep + 1);
      await this.run(
        `MATCH (a:Domain {id: $from}), (b:Domain {id: $to})
         CREATE (a)-[:DEPENDS_ON {weight: $weight, prodWeight: $prodWeight}]->(b)`,
        {
          from: this.domainId(projectPath, from),
          to: this.domainId(projectPath, to),
          weight: w,
          prodWeight: prodWeight.get(key) ?? 0,
        }
      );
      dependenciesCreated++;
    }

    return { domainsCreated, dependenciesCreated };
  }

  async clearGraph(projectPath?: string): Promise<ClearResult> {
    // No deletion counters on the result, so we diff totals before/after (also exact for the
    // project-scoped case, where DETACH DELETE cascades incident rels).
    const nodesBefore = await this.countNodes();
    const relsBefore = await this.countRels();

    if (projectPath) {
      // Code nodes belonging to the project (by filePath), then the Project node (exact path).
      for (const table of SYMBOL_TABLES) {
        await this.run(`MATCH (n:${table}) WHERE n.filePath STARTS WITH $projectPath DETACH DELETE n`, {
          projectPath,
        });
      }
      await this.run('MATCH (p:Project {path: $projectPath}) DETACH DELETE p', { projectPath });
      // Domains have no filePath — scope their deletion by projectPath.
      await this.run('MATCH (d:Domain) WHERE d.projectPath = $projectPath DETACH DELETE d', { projectPath });
    } else {
      await this.run(`MATCH (n:${ALL_NODE_TABLES.join(':')}) DETACH DELETE n`);
    }

    return {
      nodesDeleted: nodesBefore - (await this.countNodes()),
      relationshipsDeleted: relsBefore - (await this.countRels()),
    };
  }

  private async countNodes(): Promise<number> {
    let total = 0;
    for (const table of ALL_NODE_TABLES) {
      const result = await this.run(`MATCH (n:${table}) RETURN count(n) AS c`);
      total += Number((await result.getAll())[0]!.c);
    }
    return total;
  }

  private async countRels(): Promise<number> {
    let total = 0;
    for (const table of REL_TABLES) {
      const result = await this.run(`MATCH ()-[x:${table}]->() RETURN count(x) AS c`);
      total += Number((await result.getAll())[0]!.c);
    }
    return total;
  }
}
