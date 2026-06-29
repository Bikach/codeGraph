/**
 * EmbeddedReader — read-method parity tests (LadybugDB, in-memory, no Docker).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmbeddedConnection } from './connection.js';
import { EmbeddedReader } from './embedded-reader.js';
import { EmbeddedWriter } from './embedded-writer.js';
import { loc, param, fn, prop, cls, emptyFile, callGraphFile } from './fixtures.js';

describe('EmbeddedReader (LadybugDB)', () => {
  let cx: EmbeddedConnection;
  let reader: EmbeddedReader;
  let writer: EmbeddedWriter;

  beforeEach(async () => {
    cx = new EmbeddedConnection(); // in-memory
    await cx.open();
    writer = new EmbeddedWriter(cx);
    reader = new EmbeddedReader(cx);
    await writer.ensureSchema();
  });

  afterEach(async () => {
    await cx.close();
  });

  describe('getCallees', () => {
    it('returns direct + transitive callees, with className from DECLARES, ordered by depth', async () => {
      await writer.writeFiles([callGraphFile]);

      const callees = await reader.getCallees({ functionName: 'foo', depth: 2 });

      expect(callees).toEqual([
        { functionName: 'bar', className: 'Repo', filePath: '/app/Repo.kt', lineNumber: 10, depth: 1 },
        { functionName: 'baz', className: undefined, filePath: '/app/Util.kt', lineNumber: 20, depth: 2 },
      ]);
    });

    it('limits traversal when depth=1', async () => {
      await writer.writeFiles([callGraphFile]);

      const callees = await reader.getCallees({ functionName: 'foo', depth: 1 });

      expect(callees).toEqual([
        { functionName: 'bar', className: 'Repo', filePath: '/app/Repo.kt', lineNumber: 10, depth: 1 },
      ]);
    });
  });

  describe('getCallers', () => {
    it('returns direct + transitive callers, with className from DECLARES, ordered by depth', async () => {
      await writer.writeFiles([callGraphFile]);

      const callers = await reader.getCallers({ functionName: 'baz', depth: 2 });

      expect(callers).toEqual([
        { functionName: 'bar', className: 'Repo', filePath: '/app/Repo.kt', lineNumber: 10, depth: 1 },
        { functionName: 'foo', className: undefined, filePath: '/app/Service.kt', lineNumber: 5, depth: 2 },
      ]);
    });

    it('dedups a node reachable via several paths/depths, keeping its shortest depth', async () => {
      // Diamond: foo->bar->baz AND foo->baz. baz is reachable at depth 1 (direct) and depth 2 (via bar)
      // → it must appear ONCE, at depth 1 (not duplicated per depth).
      const diamond = emptyFile({
        topLevelFunctions: [fn('foo', '/app/F.kt', 1), fn('bar', '/app/F.kt', 2), fn('baz', '/app/F.kt', 3)],
        resolvedCalls: [
          { fromFqn: 'app.foo', toFqn: 'app.bar', location: loc('/app/F.kt', 1) },
          { fromFqn: 'app.bar', toFqn: 'app.baz', location: loc('/app/F.kt', 2) },
          { fromFqn: 'app.foo', toFqn: 'app.baz', location: loc('/app/F.kt', 1) },
        ],
      });
      await writer.writeFiles([diamond]);

      const callees = await reader.getCallees({ functionName: 'foo', depth: 3 });

      expect(callees).toEqual([
        { functionName: 'bar', className: undefined, filePath: '/app/F.kt', lineNumber: 2, depth: 1 },
        { functionName: 'baz', className: undefined, filePath: '/app/F.kt', lineNumber: 3, depth: 1 },
      ]);
    });

    it('bridges port↔adapter: querying the adapter surfaces callers of the port, labeled viaInterface', async () => {
      // DDD/hexagonal: FindDealer.execute calls the PORT (DealerGateway), not the adapter. Querying
      // the adapter (PostgresDealerGateway) must still find that caller, tagged via the interface.
      const hexFile = emptyFile({
        classes: [
          cls('DealerGateway', '/app/port.ts', 1, [fn('checkDealerExists', '/app/port.ts', 2)], { kind: 'interface' }),
          cls('PostgresDealerGateway', '/app/adapter.ts', 1, [fn('checkDealerExists', '/app/adapter.ts', 4)], {
            interfaces: ['DealerGateway'],
          }),
          cls('FindDealer', '/app/usecase.ts', 1, [fn('execute', '/app/usecase.ts', 3)]),
        ],
        resolvedCalls: [
          // The use case is typed against the port → the call resolves to the interface method.
          { fromFqn: 'app.FindDealer.execute', toFqn: 'app.DealerGateway.checkDealerExists', location: loc('/app/usecase.ts', 3) },
        ],
      });
      await writer.writeFiles([hexFile]);

      // No one calls the adapter directly; the bridge surfaces the port's caller, labeled.
      expect(await reader.getCallers({ functionName: 'checkDealerExists', className: 'PostgresDealerGateway', depth: 2 })).toEqual([
        { functionName: 'execute', className: 'FindDealer', filePath: '/app/usecase.ts', lineNumber: 3, depth: 1, viaInterface: 'DealerGateway' },
      ]);
    });
  });

  describe('getCallees / getCallers — className filter', () => {
    // Two classes share method name 'run'/'save'; className must disambiguate.
    const calleesFile = emptyFile({
      classes: [
        cls('A', '/app/A.kt', 1, [fn('run', '/app/A.kt', 2)]),
        cls('B', '/app/B.kt', 1, [fn('run', '/app/B.kt', 2)]),
      ],
      topLevelFunctions: [fn('helperA', '/app/A.kt', 10), fn('helperB', '/app/B.kt', 10)],
      resolvedCalls: [
        { fromFqn: 'app.A.run', toFqn: 'app.helperA', location: loc('/app/A.kt', 3) },
        { fromFqn: 'app.B.run', toFqn: 'app.helperB', location: loc('/app/B.kt', 3) },
      ],
    });

    it('getCallees restricts to the named class', async () => {
      await writer.writeFiles([calleesFile]);

      const callees = await reader.getCallees({ functionName: 'run', className: 'A', depth: 1 });

      expect(callees).toEqual([
        { functionName: 'helperA', className: undefined, filePath: '/app/A.kt', lineNumber: 10, depth: 1 },
      ]);
    });

    it('getCallees without className spans every same-named function', async () => {
      await writer.writeFiles([calleesFile]);

      const callees = await reader.getCallees({ functionName: 'run', depth: 1 });

      expect(callees.map((c) => c.functionName).sort()).toEqual(['helperA', 'helperB']);
    });

    it('getCallers restricts to the named class (filters the target)', async () => {
      await writer.writeFiles([
        emptyFile({
          classes: [
            cls('Repo', '/app/Repo.kt', 1, [fn('save', '/app/Repo.kt', 2)]),
            cls('Cache', '/app/Cache.kt', 1, [fn('save', '/app/Cache.kt', 2)]),
          ],
          topLevelFunctions: [fn('foo', '/app/F.kt', 5), fn('bar', '/app/F.kt', 6)],
          resolvedCalls: [
            { fromFqn: 'app.foo', toFqn: 'app.Repo.save', location: loc('/app/F.kt', 5) },
            { fromFqn: 'app.bar', toFqn: 'app.Cache.save', location: loc('/app/F.kt', 6) },
          ],
        }),
      ]);

      const callers = await reader.getCallers({ functionName: 'save', className: 'Repo', depth: 1 });

      expect(callers).toEqual([
        { functionName: 'foo', className: undefined, filePath: '/app/F.kt', lineNumber: 5, depth: 1 },
      ]);
    });
  });

  describe('findProject', () => {
    it('returns the covering project (STARTS WITH) for a sub-path', async () => {
      await writer.writeFiles([], { projectPath: '/app', projectName: 'app' });

      expect(await reader.findProject('/app/some/sub/path')).toEqual({ path: '/app', name: 'app' });
    });

    it('returns null when no project covers the path', async () => {
      await writer.writeFiles([], { projectPath: '/app', projectName: 'app' });

      expect(await reader.findProject('/elsewhere')).toBeNull();
    });
  });

  describe('getFileSymbols', () => {
    // Class User (with property `secret` + methods getName/helper) in User.kt; Class Other in Other.kt.
    const symbolsFile = emptyFile({
      classes: [
        cls('User', '/app/User.kt', 1, [fn('getName', '/app/User.kt', 5), fn('helper', '/app/User.kt', 8, 'private')], {
          properties: [prop('secret', '/app/User.kt', 3, 'private')],
        }),
        cls('Other', '/app/Other.kt', 1, []),
      ],
    });

    it('returns all symbols of the file ordered by line (private included by default)', async () => {
      await writer.writeFiles([symbolsFile]);

      const symbols = await reader.getFileSymbols({ filePath: '/app/User.kt' });

      expect(symbols).toEqual([
        { name: 'User', type: 'class', visibility: 'public', lineNumber: 1 },
        { name: 'secret', type: 'property', visibility: 'private', lineNumber: 3 },
        { name: 'getName', type: 'function', visibility: 'public', lineNumber: 5 },
        { name: 'helper', type: 'function', visibility: 'private', lineNumber: 8 },
      ]);
    });

    it('excludes private symbols when includePrivate=false', async () => {
      await writer.writeFiles([symbolsFile]);

      const symbols = await reader.getFileSymbols({ filePath: '/app/User.kt', includePrivate: false });

      expect(symbols).toEqual([
        { name: 'User', type: 'class', visibility: 'public', lineNumber: 1 },
        { name: 'getName', type: 'function', visibility: 'public', lineNumber: 5 },
      ]);
    });

    it('accepts a partial path (ENDS WITH) and returns only the matching file', async () => {
      await writer.writeFiles([symbolsFile]);

      const symbols = await reader.getFileSymbols({ filePath: 'User.kt' });

      expect(symbols.map((s) => s.name)).toEqual(['User', 'secret', 'getName', 'helper']);
    });

    it('returns an empty list for an unknown file', async () => {
      await writer.writeFiles([symbolsFile]);

      const symbols = await reader.getFileSymbols({ filePath: '/nope.kt' });

      expect(symbols).toEqual([]);
    });
  });

  describe('searchNodes', () => {
    const searchFile = emptyFile({
      classes: [
        cls('UserController', '/app/UserController.kt', 3, []),
        cls('UserRepository', '/app/UserRepository.kt', 5, [], { kind: 'interface' }),
        cls('UserService', '/app/UserService.kt', 10, []),
        cls('OrderService', '/app/OrderService.kt', 8, [], { visibility: 'internal' }),
      ],
    });

    it('matches by case-insensitive substring, ordered by name, all kinds by default', async () => {
      await writer.writeFiles([searchFile]);

      const nodes = await reader.searchNodes({ query: 'User' });

      expect(nodes).toEqual([
        { name: 'UserController', type: 'class', visibility: 'public', filePath: '/app/UserController.kt', lineNumber: 3 },
        { name: 'UserRepository', type: 'interface', visibility: 'public', filePath: '/app/UserRepository.kt', lineNumber: 5 },
        { name: 'UserService', type: 'class', visibility: 'public', filePath: '/app/UserService.kt', lineNumber: 10 },
      ]);
    });

    it('filters by nodeTypes', async () => {
      await writer.writeFiles([searchFile]);

      const nodes = await reader.searchNodes({ query: 'User', nodeTypes: ['class'] });

      expect(nodes.map((n) => n.name)).toEqual(['UserController', 'UserService']);
    });

    it('match=exact returns only the strictly equal name', async () => {
      await writer.writeFiles([searchFile]);

      const nodes = await reader.searchNodes({ query: 'UserService', match: 'exact' });

      expect(nodes.map((n) => n.name)).toEqual(['UserService']);
    });

    it('ranks exact match first, then src/main before src/test, before the limit', async () => {
      // Same name `save` in prod (port) and a `saveAll` partial; plus a backtick test function whose
      // name is an exact substring match. Codepoint alone would interleave them; relevance must not.
      const rankFile = emptyFile({
        classes: [
          cls('Repo', '/app/src/main/kotlin/Repo.kt', 1, [fn('save', '/app/src/main/kotlin/Repo.kt', 2)]),
          cls('RepoTest', '/app/src/test/kotlin/RepoTest.kt', 1, [
            fn('save', '/app/src/test/kotlin/RepoTest.kt', 5),
            fn('saveAll should persist', '/app/src/test/kotlin/RepoTest.kt', 9),
          ]),
        ],
      });
      await writer.writeFiles([rankFile]);

      const names = (await reader.searchNodes({ query: 'save' })).map((n) => `${n.name}@${n.filePath.includes('/test/') ? 'test' : 'main'}`);

      // Exact `save` from main first, then exact `save` from test, then the partial match.
      expect(names).toEqual(['save@main', 'save@test', 'saveAll should persist@test']);
    });
  });

  describe('getImplementations', () => {
    // Repository <- UserRepository, OrderRepository (direct);
    // SpecialUserRepository EXTENDS UserRepository (indirect).
    const hierarchyFile = emptyFile({
      classes: [
        cls('Repository', '/app/Repository.kt', 1, [], { kind: 'interface' }),
        cls('UserRepository', '/app/UserRepository.kt', 5, [], { interfaces: ['Repository'] }),
        cls('OrderRepository', '/app/OrderRepository.kt', 7, [], { interfaces: ['Repository'] }),
        cls('SpecialUserRepository', '/app/SpecialUserRepository.kt', 9, [], { superClass: 'UserRepository' }),
      ],
    });

    it('returns direct implementations only by default, ordered by name', async () => {
      await writer.writeFiles([hierarchyFile]);

      const impls = await reader.getImplementations({ interfaceName: 'Repository' });

      expect(impls).toEqual([
        { name: 'OrderRepository', filePath: '/app/OrderRepository.kt', lineNumber: 7, isDirect: true },
        { name: 'UserRepository', filePath: '/app/UserRepository.kt', lineNumber: 5, isDirect: true },
      ]);
    });

    it('adds indirect implementations when includeIndirect=true', async () => {
      await writer.writeFiles([hierarchyFile]);

      const impls = await reader.getImplementations({ interfaceName: 'Repository', includeIndirect: true });

      expect(impls).toEqual([
        { name: 'OrderRepository', filePath: '/app/OrderRepository.kt', lineNumber: 7, isDirect: true },
        { name: 'UserRepository', filePath: '/app/UserRepository.kt', lineNumber: 5, isDirect: true },
        { name: 'SpecialUserRepository', filePath: '/app/SpecialUserRepository.kt', lineNumber: 9, isDirect: false },
      ]);
    });

    it('finds subclasses of a (non-interface) base class via EXTENDS', async () => {
      await writer.writeFiles([hierarchyFile]);

      // UserRepository is a CLASS; SpecialUserRepository extends it. This used to return [] because
      // the query matched only `:Interface` targets — the central Java abstract-base-class case.
      const impls = await reader.getImplementations({ interfaceName: 'UserRepository' });

      expect(impls).toEqual([
        { name: 'SpecialUserRepository', filePath: '/app/SpecialUserRepository.kt', lineNumber: 9, isDirect: true },
      ]);
    });
  });

  describe('getNeighbors', () => {
    // UserService EXTENDS BaseService; UserService.find(repo: UserRepository) -> USES UserRepository;
    // UserController.handle(svc: UserService) -> USES UserService. Lonely is isolated.
    const neighborsFile = emptyFile({
      classes: [
        cls('UserService', '/app/UserService.kt', 1, [fn('find', '/app/UserService.kt', 5, 'public', [param('repo', 'UserRepository')])], {
          superClass: 'BaseService',
        }),
        cls('BaseService', '/app/BaseService.kt', 1, []),
        cls('UserRepository', '/app/UserRepository.kt', 1, [], { kind: 'interface' }),
        cls('UserController', '/app/UserController.kt', 1, [fn('handle', '/app/UserController.kt', 5, 'public', [param('svc', 'UserService')])]),
        cls('Lonely', '/app/Lonely.kt', 1, []),
      ],
    });

    it('returns outgoing (direct + via USES) then incoming, with capitalized type', async () => {
      await writer.writeFiles([neighborsFile]);

      const neighbors = await reader.getNeighbors({ nodeName: 'UserService', direction: 'both' });

      expect(neighbors).toEqual([
        { name: 'BaseService', type: 'Class', direction: 'outgoing', depth: 1, filePath: '/app/BaseService.kt' },
        { name: 'UserRepository', type: 'Interface', direction: 'outgoing', depth: 1, filePath: '/app/UserRepository.kt' },
        { name: 'UserController', type: 'Class', direction: 'incoming', depth: 1, filePath: '/app/UserController.kt' },
      ]);
    });

    it('returns an empty list for an isolated node', async () => {
      await writer.writeFiles([neighborsFile]);

      expect(await reader.getNeighbors({ nodeName: 'Lonely', direction: 'both' })).toEqual([]);
    });

    it('surfaces injected dependencies (class property types), both directions', async () => {
      // Service has no method params, only a constructor-injected `repo: Repo` (clean-arch DI).
      const injectedDepFile = emptyFile({
        classes: [
          cls('Repo', '/app/Repo.kt', 1, [], { kind: 'interface' }),
          cls('Service', '/app/Service.kt', 1, [], {
            properties: [prop('repo', '/app/Service.kt', 2, 'private', 'Repo')],
          }),
        ],
      });
      await writer.writeFiles([injectedDepFile]);

      expect(await reader.getNeighbors({ nodeName: 'Service', direction: 'outgoing' })).toEqual([
        { name: 'Repo', type: 'Interface', direction: 'outgoing', depth: 1, filePath: '/app/Repo.kt' },
      ]);
      expect(await reader.getNeighbors({ nodeName: 'Repo', direction: 'incoming' })).toEqual([
        { name: 'Service', type: 'Class', direction: 'incoming', depth: 1, filePath: '/app/Service.kt' },
      ]);
    });

    it('traverses multiple hops when depth>1 (neighbors of neighbors), reporting the hop distance', async () => {
      // Chain: A -USES-> B -USES-> C (via property types). depth=2 from A should reach B (1) then C (2).
      const chainFile = emptyFile({
        classes: [
          cls('A', '/app/A.kt', 1, [], { properties: [prop('b', '/app/A.kt', 2, 'private', 'B')] }),
          cls('B', '/app/B.kt', 1, [], { properties: [prop('c', '/app/B.kt', 2, 'private', 'C')] }),
          cls('C', '/app/C.kt', 1, []),
        ],
      });
      await writer.writeFiles([chainFile]);

      // depth=1 (default) stays single-hop — only the direct neighbor.
      expect(await reader.getNeighbors({ nodeName: 'A', direction: 'outgoing' })).toEqual([
        { name: 'B', type: 'Class', direction: 'outgoing', depth: 1, filePath: '/app/B.kt' },
      ]);

      // depth=2 reaches C through B, with C reported at depth 2.
      expect(await reader.getNeighbors({ nodeName: 'A', direction: 'outgoing', depth: 2 })).toEqual([
        { name: 'B', type: 'Class', direction: 'outgoing', depth: 1, filePath: '/app/B.kt' },
        { name: 'C', type: 'Class', direction: 'outgoing', depth: 2, filePath: '/app/C.kt' },
      ]);
    });
  });

  describe('findPath', () => {
    // A --EXTENDS--> B --IMPLEMENTS--> C (interface). D isolated.
    // (A Class-USES->Class edge would be forbidden by our typed schema; this schema-valid
    // variant exercises the same findPath logic: shortest path, mixed rel/node types.)
    const pathFile = emptyFile({
      classes: [
        cls('A', '/app/A.kt', 1, [], { superClass: 'B' }),
        cls('B', '/app/B.kt', 2, [], { interfaces: ['C'] }),
        cls('C', '/app/C.kt', 3, [], { kind: 'interface' }),
        cls('D', '/app/D.kt', 4, []),
      ],
    });

    it('returns the shortest path as ordered steps with relationship types', async () => {
      await writer.writeFiles([pathFile]);

      const steps = await reader.findPath({ fromNode: 'A', toNode: 'C', maxDepth: 5 });

      expect(steps).toEqual([
        { step: 0, type: 'class', name: 'A', relationship: '-', filePath: '/app/A.kt', lineNumber: 1 },
        { step: 1, type: 'class', name: 'B', relationship: 'EXTENDS', filePath: '/app/B.kt', lineNumber: 2 },
        { step: 2, type: 'interface', name: 'C', relationship: 'IMPLEMENTS', filePath: '/app/C.kt', lineNumber: 3 },
      ]);
    });

    it('returns null when no path exists', async () => {
      await writer.writeFiles([pathFile]);

      expect(await reader.findPath({ fromNode: 'A', toNode: 'D', maxDepth: 5 })).toBeNull();
    });

    it('is directed by default; directed=false finds reverse connectivity', async () => {
      await writer.writeFiles([pathFile]);

      // A -EXTENDS-> B -IMPLEMENTS-> C. C does NOT reach A following edge direction.
      expect(await reader.findPath({ fromNode: 'C', toNode: 'A', maxDepth: 5 })).toBeNull();

      // Undirected: they are connected (path traverses the edges backwards).
      const undirected = await reader.findPath({ fromNode: 'C', toNode: 'A', maxDepth: 5, directed: false });
      expect(undirected?.map((s) => s.name)).toEqual(['C', 'B', 'A']);
    });
  });

  describe('getImpact', () => {
    it('node_type=function returns callers', async () => {
      // handlerA(), handlerB() both CALLS process()
      await writer.writeFiles([
        emptyFile({
          topLevelFunctions: [fn('handlerA', '/app/A.kt', 1), fn('handlerB', '/app/B.kt', 3), fn('process', '/app/P.kt', 2)],
          resolvedCalls: [
            { fromFqn: 'app.handlerA', toFqn: 'app.process', location: loc('/app/A.kt', 1) },
            { fromFqn: 'app.handlerB', toFqn: 'app.process', location: loc('/app/B.kt', 3) },
          ],
        }),
      ]);

      const impact = await reader.getImpact({ nodeName: 'process', nodeType: 'function', depth: 3 });

      expect(impact).toEqual([
        { name: 'handlerA', type: 'function', impactType: 'caller', depth: 1, filePath: '/app/A.kt', lineNumber: 1 },
        { name: 'handlerB', type: 'function', impactType: 'caller', depth: 1, filePath: '/app/B.kt', lineNumber: 3 },
      ]);
    });

    it('node_type=interface returns dependents (capitalized type) then implementors', async () => {
      // UserRepository IMPLEMENTS Repository; Service.find(repo: Repository) USES Repository
      await writer.writeFiles([
        emptyFile({
          classes: [
            cls('Repository', '/app/Repo.kt', 1, [], { kind: 'interface' }),
            cls('UserRepository', '/app/UserRepository.kt', 2, [], { interfaces: ['Repository'] }),
            cls('Service', '/app/Service.kt', 3, [fn('find', '/app/Service.kt', 4, 'public', [param('repo', 'Repository')])]),
          ],
        }),
      ]);

      const impact = await reader.getImpact({ nodeName: 'Repository', nodeType: 'interface', depth: 3 });

      expect(impact).toEqual([
        { name: 'Service', type: 'Class', impactType: 'dependent', depth: 1, filePath: '/app/Service.kt', lineNumber: 3 },
        { name: 'UserRepository', type: 'class', impactType: 'implementor', depth: 1, filePath: '/app/UserRepository.kt', lineNumber: 2 },
      ]);
    });

    it('node_type=class returns dependents then children', async () => {
      // ChildService EXTENDS BaseService; UserController.handle(svc: BaseService) USES BaseService
      await writer.writeFiles([
        emptyFile({
          classes: [
            cls('BaseService', '/app/Base.kt', 1, []),
            cls('ChildService', '/app/Child.kt', 2, [], { superClass: 'BaseService' }),
            cls('UserController', '/app/Ctrl.kt', 3, [fn('handle', '/app/Ctrl.kt', 4, 'public', [param('svc', 'BaseService')])]),
          ],
        }),
      ]);

      const impact = await reader.getImpact({ nodeName: 'BaseService', nodeType: 'class', depth: 3 });

      expect(impact).toEqual([
        { name: 'UserController', type: 'Class', impactType: 'dependent', depth: 1, filePath: '/app/Ctrl.kt', lineNumber: 3 },
        { name: 'ChildService', type: 'class', impactType: 'child', depth: 1, filePath: '/app/Child.kt', lineNumber: 2 },
      ]);
    });

    it('dependents include constructor-injected deps (class property types), not just param types', async () => {
      // Service has a constructor-injected `repo: Repository` (no method param references it) —
      // it must still surface as a dependent of Repository (§3bis A consistency with get_neighbors).
      await writer.writeFiles([
        emptyFile({
          classes: [
            cls('Repository', '/app/Repo.kt', 1, [], { kind: 'interface' }),
            cls('Service', '/app/Service.kt', 2, [], {
              properties: [prop('repo', '/app/Service.kt', 3, 'private', 'Repository')],
            }),
          ],
        }),
      ]);

      const impact = await reader.getImpact({ nodeName: 'Repository', nodeType: 'interface', depth: 3 });

      expect(impact).toEqual([
        { name: 'Service', type: 'Class', impactType: 'dependent', depth: 1, filePath: '/app/Service.kt', lineNumber: 2 },
      ]);
    });

    it('dependents include types referenced only as a return type (e.g. a returned DTO)', async () => {
      // GetJobOrder.execute(): JobOrder — JobOrder is only a RETURN type, no param/property/call.
      // It must still surface as a dependent (BUG-3: return-type USES).
      await writer.writeFiles([
        emptyFile({
          classes: [
            cls('JobOrder', '/app/job.ts', 1, [], { kind: 'interface' }),
            cls('GetJobOrder', '/app/uc.ts', 1, [fn('execute', '/app/uc.ts', 2, 'public', [], 'JobOrder')]),
          ],
        }),
      ]);

      const impact = await reader.getImpact({ nodeName: 'JobOrder', nodeType: 'interface', depth: 3 });

      expect(impact).toEqual([
        { name: 'GetJobOrder', type: 'Class', impactType: 'dependent', depth: 1, filePath: '/app/uc.ts', lineNumber: 1 },
      ]);
    });
  });

  describe('getGodNodes', () => {
    // Hub is the hotspot: it EXTENDS Base, IMPLEMENTS Ia/Ib, and has Dep1/Dep2 as property types
    // (class-level USES out), while A and B inject Hub as a property (USES in). Hub.run() is reached
    // only via DECLARES — which must NOT count, otherwise `run` would itself gain a degree.
    //   Hub: out = {Base, Ia, Ib, Dep1, Dep2} = 5 ; in = {A, B} = 2 ; degree = 7
    //   every other node has degree 1 ; `run` (DECLARES-only) has degree 0 → absent
    const hubFile = emptyFile({
      classes: [
        cls('Hub', '/app/Hub.ts', 1, [fn('run', '/app/Hub.ts', 2)], {
          superClass: 'Base',
          interfaces: ['Ia', 'Ib'],
          properties: [prop('d1', '/app/Hub.ts', 3, 'private', 'Dep1'), prop('d2', '/app/Hub.ts', 4, 'private', 'Dep2')],
        }),
        cls('Base', '/app/Base.ts', 1, []),
        cls('Ia', '/app/Ia.ts', 1, [], { kind: 'interface' }),
        cls('Ib', '/app/Ib.ts', 1, [], { kind: 'interface' }),
        cls('Dep1', '/app/Dep1.ts', 1, []),
        cls('Dep2', '/app/Dep2.ts', 1, []),
        cls('A', '/app/A.ts', 1, [], { properties: [prop('hub', '/app/A.ts', 2, 'private', 'Hub')] }),
        cls('B', '/app/B.ts', 1, [], { properties: [prop('hub', '/app/B.ts', 2, 'private', 'Hub')] }),
      ],
    });

    it('ranks by total degree (in + out) when sort_by=degree, with role from in/out balance', async () => {
      await writer.writeFiles([hubFile]);

      const top = await reader.getGodNodes({ topN: 3, sortBy: 'degree' });

      // Hub dominates; out (5) ≥ 2×in (2) → role 'fanout'. The rest are degree 1 (A before B).
      expect(top[0]).toEqual({
        name: 'Hub',
        type: 'class',
        role: 'fanout',
        degree: 7,
        inDegree: 2,
        outDegree: 5,
        filePath: '/app/Hub.ts',
        lineNumber: 1,
      });
      expect(top.map((n) => n.name)).toEqual(['Hub', 'A', 'B']);
    });

    it('exclude_accessors drops property-backed getters but keeps real methods', async () => {
      // Owner has a property `name`; getName() is a trivial accessor, getUserByLogin() is a real method.
      // Both are called once (so both bear a degree), so only the accessor filter can tell them apart.
      const accessorFile = emptyFile({
        classes: [
          cls('Owner', '/app/Owner.kt', 1, [fn('getName', '/app/Owner.kt', 2), fn('getUserByLogin', '/app/Owner.kt', 3)], {
            properties: [prop('name', '/app/Owner.kt', 4, 'private', 'String')],
          }),
        ],
        topLevelFunctions: [fn('caller', '/app/Caller.kt', 1)],
        resolvedCalls: [
          { fromFqn: 'app.caller', toFqn: 'app.Owner.getName', location: loc('/app/Caller.kt', 1) },
          { fromFqn: 'app.caller', toFqn: 'app.Owner.getUserByLogin', location: loc('/app/Caller.kt', 2) },
        ],
      });
      await writer.writeFiles([accessorFile]);

      const withAccessors = await reader.getGodNodes({ topN: 10, scope: 'all' });
      expect(withAccessors.map((n) => n.name)).toContain('getName');

      const without = await reader.getGodNodes({ topN: 10, scope: 'all', excludeAccessors: true });
      expect(without.map((n) => n.name)).not.toContain('getName'); // property-backed → dropped
      expect(without.map((n) => n.name)).toContain('getUserByLogin'); // no property → kept
    });

    it('defaults to sort_by=in (ripple) — depended-upon nodes rank above pure consumers', async () => {
      await writer.writeFiles([hubFile]);

      const top = await reader.getGodNodes({ topN: 5 });

      // By incoming: Hub(2), then the in=1 nodes by name; A/B (in=0, pure fanout) drop out of the top.
      expect(top.map((n) => n.name)).toEqual(['Hub', 'Base', 'Dep1', 'Dep2', 'Ia']);
      expect(top.every((n) => n.name !== 'A' && n.name !== 'B')).toBe(true);
    });

    it('excludes DECLARES from the degree (structural, not coupling)', async () => {
      await writer.writeFiles([hubFile]);

      const all = await reader.getGodNodes({ topN: 100, scope: 'all' });

      // `run` is only reachable via Hub-[:DECLARES]->run → degree 0 → never a god node.
      expect(all.find((n) => n.name === 'run')).toBeUndefined();
    });

    describe('scope', () => {
      // Prod edge Service→Repo, a test→prod edge (ServiceTest→Repo) and a test→test edge
      // (ServiceTest→Helper). `scope` keeps only edges whose BOTH endpoints match.
      const scopeFile = emptyFile({
        classes: [
          cls('Service', '/app/Service.ts', 1, [], { properties: [prop('r', '/app/Service.ts', 2, 'private', 'Repo')] }),
          cls('Repo', '/app/Repo.ts', 1, []),
          cls('ServiceTest', '/app/Service.test.ts', 1, [], {
            properties: [prop('r', '/app/Service.test.ts', 2, 'private', 'Repo'), prop('h', '/app/Service.test.ts', 3, 'private', 'Helper')],
          }),
          cls('Helper', '/app/Helper.test.ts', 1, []),
        ],
      });

      it("'main' (default) keeps the prod sub-graph: drops test nodes and test→prod edges", async () => {
        await writer.writeFiles([scopeFile]);

        const main = await reader.getGodNodes({ topN: 50, scope: 'main' });

        // Repo loses its test caller → in=1 (Service only); test nodes are absent entirely.
        expect(main.find((n) => n.name === 'Repo')).toMatchObject({ inDegree: 1, role: 'ripple' });
        expect(main.find((n) => n.name === 'Service')).toMatchObject({ outDegree: 1, role: 'fanout' });
        expect(main.some((n) => n.name === 'ServiceTest' || n.name === 'Helper')).toBe(false);
      });

      it("'test' keeps the test sub-graph only", async () => {
        await writer.writeFiles([scopeFile]);

        const test = await reader.getGodNodes({ topN: 50, scope: 'test' });

        // Only the test→test edge survives (ServiceTest→Helper); prod nodes are absent.
        expect(test.find((n) => n.name === 'Helper')).toMatchObject({ inDegree: 1 });
        expect(test.some((n) => n.name === 'Service' || n.name === 'Repo')).toBe(false);
      });

      it("'all' counts every edge regardless of test/prod", async () => {
        await writer.writeFiles([scopeFile]);

        const all = await reader.getGodNodes({ topN: 50, scope: 'all' });

        // Repo is depended on by BOTH Service and ServiceTest.
        expect(all.find((n) => n.name === 'Repo')).toMatchObject({ inDegree: 2 });
      });
    });
  });

  describe('getModuleOverview', () => {
    // A cross-domain coupling carried ONLY by USES (a hook holding a use-case as a property), plus
    // the same edge from a TEST file. There is NO call between the two → with the old CALLS-only dep
    // calc this would be invisible. Proves DOMAIN_DEPS now counts the full god-nodes edge set.
    const hooksFile = emptyFile({
      filePath: '/proj/src/hooks/useApi.ts',
      language: 'typescript',
      packageName: undefined,
      classes: [
        cls('UseApi', '/proj/src/hooks/useApi.ts', 1, [], {
          properties: [prop('uc', '/proj/src/hooks/useApi.ts', 2, 'private', 'OrderUseCase')],
        }),
      ],
    });
    const businessFile = emptyFile({
      filePath: '/proj/src/business/OrderUseCase.ts',
      language: 'typescript',
      packageName: undefined,
      classes: [cls('OrderUseCase', '/proj/src/business/OrderUseCase.ts', 1, [])],
    });
    const hooksTestFile = emptyFile({
      filePath: '/proj/src/hooks/useApi.test.ts',
      language: 'typescript',
      packageName: undefined,
      classes: [
        cls('UseApiTest', '/proj/src/hooks/useApi.test.ts', 1, [], {
          properties: [prop('uc', '/proj/src/hooks/useApi.test.ts', 2, 'private', 'OrderUseCase')],
        }),
      ],
    });
    const fileDomain = new Map([
      ['/proj/src/hooks/useApi.ts', 'Hooks'],
      ['/proj/src/business/OrderUseCase.ts', 'Business'],
      ['/proj/src/hooks/useApi.test.ts', 'Hooks'],
    ]);
    const analysis = {
      domains: [
        { name: 'Hooks', packages: ['hooks'] },
        { name: 'Business', packages: ['business'] },
      ],
      fileDomain,
    };

    it("'main' (default): deps from USES edges, prod-only counts, hotspots fused", async () => {
      await writer.writeFiles([hooksFile, businessFile, hooksTestFile]);
      await writer.writeDomains(analysis, '/proj');

      const overview = await reader.getModuleOverview({ topN: 5, projectPath: '/proj' });

      // prodFileCount: Hooks=1 (test excluded), Business=1 → both kept, ordered by name.
      expect(overview.domains).toEqual([
        { name: 'Business', fileCount: 1, packages: ['business'] },
        { name: 'Hooks', fileCount: 1, packages: ['hooks'] },
      ]);
      // The Hooks→Business USES edge is counted (the bug fix); the test→business edge is excluded.
      expect(overview.dependencies).toEqual([{ from: 'Hooks', to: 'Business', weight: 1 }]);
      // One-directional dependency → no cycle.
      expect(overview.cycles).toEqual([]);
      // Hotspots reuse god-nodes (prod): OrderUseCase is depended-upon.
      expect(overview.hotspots.find((n) => n.name === 'OrderUseCase')).toMatchObject({ role: 'ripple' });
    });

    it("'all' includes test files in counts and dependency weights", async () => {
      await writer.writeFiles([hooksFile, businessFile, hooksTestFile]);
      await writer.writeDomains(analysis, '/proj');

      const overview = await reader.getModuleOverview({ topN: 5, scope: 'all', projectPath: '/proj' });

      // fileCount: Hooks=2 (incl. the test file) → ranks first.
      expect(overview.domains).toEqual([
        { name: 'Hooks', fileCount: 2, packages: ['hooks'] },
        { name: 'Business', fileCount: 1, packages: ['business'] },
      ]);
      // Both USES edges (prod + test) counted.
      expect(overview.dependencies).toEqual([{ from: 'Hooks', to: 'Business', weight: 2 }]);
    });

    it('surfaces a 2-cycle when two domains depend on each other (A↔B)', async () => {
      // Alpha.A holds a Beta.B property AND Beta.B holds an Alpha.A property → mutual USES coupling.
      const alpha = emptyFile({
        filePath: '/proj/src/alpha/A.ts',
        language: 'typescript',
        packageName: undefined,
        classes: [cls('A', '/proj/src/alpha/A.ts', 1, [], { properties: [prop('b', '/proj/src/alpha/A.ts', 2, 'private', 'B')] })],
      });
      const beta = emptyFile({
        filePath: '/proj/src/beta/B.ts',
        language: 'typescript',
        packageName: undefined,
        classes: [cls('B', '/proj/src/beta/B.ts', 1, [], { properties: [prop('a', '/proj/src/beta/B.ts', 2, 'private', 'A')] })],
      });
      await writer.writeFiles([alpha, beta]);
      await writer.writeDomains(
        {
          domains: [
            { name: 'Alpha', packages: ['alpha'] },
            { name: 'Beta', packages: ['beta'] },
          ],
          fileDomain: new Map([
            ['/proj/src/alpha/A.ts', 'Alpha'],
            ['/proj/src/beta/B.ts', 'Beta'],
          ]),
        },
        '/proj'
      );

      const overview = await reader.getModuleOverview({ topN: 5, projectPath: '/proj' });

      // Canonical orientation a < b: Alpha ↔ Beta, one edge each way.
      expect(overview.cycles).toEqual([{ a: 'Alpha', b: 'Beta', weightAtoB: 1, weightBtoA: 1 }]);
    });

    it('scopes domains by project (id is project-prefixed)', async () => {
      await writer.writeDomains({ domains: [{ name: 'A', packages: ['a'] }], fileDomain: new Map([['/p1/a.ts', 'A']]) }, '/p1');
      await writer.writeDomains({ domains: [{ name: 'B', packages: ['b'] }], fileDomain: new Map([['/p2/b.ts', 'B']]) }, '/p2');

      const p1 = await reader.getModuleOverview({ topN: 5, scope: 'all', projectPath: '/p1' });

      expect(p1.domains.map((d) => d.name)).toEqual(['A']);
    });

    it("scope 'main' lists only prod packages (drops test-only group keys)", async () => {
      await writer.writeDomains(
        {
          domains: [{ name: 'Notif', packages: ['notif', 'notif.test'] }],
          fileDomain: new Map([
            ['/app/notif/A.kt', 'Notif'],
            ['/app/notif/test/B.kt', 'Notif'],
          ]),
          fileGroupKey: new Map([
            ['/app/notif/A.kt', 'notif'],
            ['/app/notif/test/B.kt', 'notif.test'],
          ]),
        },
        '/proj'
      );

      const main = await reader.getModuleOverview({ topN: 5, scope: 'main', projectPath: '/proj' });
      expect(main.domains).toEqual([{ name: 'Notif', fileCount: 1, packages: ['notif'] }]);

      const all = await reader.getModuleOverview({ topN: 5, scope: 'all', projectPath: '/proj' });
      expect(all.domains).toEqual([{ name: 'Notif', fileCount: 2, packages: ['notif', 'notif.test'] }]);
    });
  });

  describe('constructor calls → USES', () => {
    it('models `new X()` (resolved to X.<init>) as a USES edge, not a dropped CALLS', async () => {
      // A DI hook instantiates a use case: there is no Function node for the constructor, so the
      // call must become a USES edge so the coupling stays visible (god-nodes / module-overview).
      const hook = emptyFile({
        filePath: '/proj/src/hooks/useApi.ts',
        language: 'typescript',
        packageName: undefined,
        topLevelFunctions: [fn('useApi', '/proj/src/hooks/useApi.ts', 1)],
        resolvedCalls: [{ fromFqn: '/proj/src/hooks/useApi.ts::useApi', toFqn: 'OrderUseCase.<init>', location: loc('/proj/src/hooks/useApi.ts', 2) }],
      });
      const business = emptyFile({
        filePath: '/proj/src/business/OrderUseCase.ts',
        language: 'typescript',
        packageName: undefined,
        classes: [cls('OrderUseCase', '/proj/src/business/OrderUseCase.ts', 1, [])],
      });
      await writer.writeFiles([hook, business]);

      const nodes = await reader.getGodNodes({ topN: 10, scope: 'all' });

      // The constructor call is now an outgoing USES from useApi to the instantiated class.
      expect(nodes.find((n) => n.name === 'OrderUseCase')).toMatchObject({ inDegree: 1 });
      expect(nodes.find((n) => n.name === 'useApi')).toMatchObject({ outDegree: 1 });
      // It is a USES edge, not a CALLS one → get_callees sees nothing.
      expect(await reader.getCallees({ functionName: 'useApi', depth: 2 })).toEqual([]);
    });
  });

  describe('getCallers / getCallees — scope', () => {
    // Three separate files (one prod caller, one test caller, one callee). Modeled as distinct
    // ParsedFiles because a top-level function's node FQN is qualified by its FILE path (B-8), so each
    // must carry its own file.filePath; cramming them into one file would give them all one prefix.
    const callScopeFiles = [
      emptyFile({ filePath: '/app/Repo.ts', packageName: undefined, topLevelFunctions: [fn('target', '/app/Repo.ts', 1)] }),
      emptyFile({
        filePath: '/app/Service.ts',
        packageName: undefined,
        topLevelFunctions: [fn('prodCaller', '/app/Service.ts', 1)],
        resolvedCalls: [{ fromFqn: '/app/Service.ts::prodCaller', toFqn: '/app/Repo.ts::target', location: loc('/app/Service.ts', 2) }],
      }),
      emptyFile({
        filePath: '/app/Service.test.ts',
        packageName: undefined,
        topLevelFunctions: [fn('testCaller', '/app/Service.test.ts', 1)],
        resolvedCalls: [{ fromFqn: '/app/Service.test.ts::testCaller', toFqn: '/app/Repo.ts::target', location: loc('/app/Service.test.ts', 2) }],
      }),
    ];

    it("scope 'all' (default) keeps test callers; 'main' drops them", async () => {
      await writer.writeFiles(callScopeFiles);

      const all = await reader.getCallers({ functionName: 'target', depth: 1, scope: 'all' });
      expect(all.map((c) => c.functionName).sort()).toEqual(['prodCaller', 'testCaller']);

      const main = await reader.getCallers({ functionName: 'target', depth: 1, scope: 'main' });
      expect(main.map((c) => c.functionName)).toEqual(['prodCaller']);
    });

    it("getImpact scope 'main' drops impacted nodes in test files", async () => {
      await writer.writeFiles(callScopeFiles);

      const all = await reader.getImpact({ nodeName: 'target', nodeType: 'function', depth: 1, scope: 'all' });
      expect(all.map((i) => i.name).sort()).toEqual(['prodCaller', 'testCaller']);

      const main = await reader.getImpact({ nodeName: 'target', nodeType: 'function', depth: 1, scope: 'main' });
      expect(main.map((i) => i.name)).toEqual(['prodCaller']);
    });

    it("getNeighbors scope 'main' drops dependents in test files", async () => {
      await writer.writeFiles([
        emptyFile({
          packageName: undefined,
          classes: [
            cls('Target', '/app/Target.ts', 1, []),
            cls('ProdSub', '/app/ProdSub.ts', 1, [], { superClass: 'Target' }),
            cls('TestSub', '/app/TestSub.test.ts', 1, [], { superClass: 'Target' }),
          ],
        }),
      ]);

      const all = await reader.getNeighbors({ nodeName: 'Target', direction: 'incoming', scope: 'all' });
      expect(all.map((n) => n.name).sort()).toEqual(['ProdSub', 'TestSub']);

      const main = await reader.getNeighbors({ nodeName: 'Target', direction: 'incoming', scope: 'main' });
      expect(main.map((n) => n.name)).toEqual(['ProdSub']);
    });
  });

  describe('getCallers / getCallees — file_path disambiguation (B-10)', () => {
    // `buildVm` and `sink` are each defined as free functions in two files; file_path pins one.
    const homonyms = [
      emptyFile({
        filePath: '/app/A.ts',
        packageName: undefined,
        topLevelFunctions: [fn('buildVm', '/app/A.ts', 1), fn('sink', '/app/A.ts', 2)],
        resolvedCalls: [{ fromFqn: '/app/A.ts::buildVm', toFqn: '/app/A.ts::sink', location: loc('/app/A.ts', 1) }],
      }),
      emptyFile({
        filePath: '/app/B.ts',
        packageName: undefined,
        topLevelFunctions: [fn('buildVm', '/app/B.ts', 1), fn('sink', '/app/B.ts', 2)],
        resolvedCalls: [{ fromFqn: '/app/B.ts::buildVm', toFqn: '/app/B.ts::sink', location: loc('/app/B.ts', 1) }],
      }),
    ];

    it('getCallees by name alone spans every homonymous definition', async () => {
      await writer.writeFiles(homonyms);
      const callees = await reader.getCallees({ functionName: 'buildVm', depth: 1 });
      expect(callees.map((c) => c.filePath).sort()).toEqual(['/app/A.ts', '/app/B.ts']);
    });

    it('getCallees with file_path targets a single definition', async () => {
      await writer.writeFiles(homonyms);
      const callees = await reader.getCallees({ functionName: 'buildVm', depth: 1, filePath: '/app/A.ts' });
      expect(callees.map((c) => c.filePath)).toEqual(['/app/A.ts']);
    });

    it('getCallers with file_path targets a single definition', async () => {
      await writer.writeFiles(homonyms);
      const all = await reader.getCallers({ functionName: 'sink', depth: 1 });
      expect(all.map((c) => c.filePath).sort()).toEqual(['/app/A.ts', '/app/B.ts']);

      const oneFile = await reader.getCallers({ functionName: 'sink', depth: 1, filePath: '/app/B.ts' });
      expect(oneFile.map((c) => c.filePath)).toEqual(['/app/B.ts']);
    });
  });

  describe('getNeighbors — deterministic order', () => {
    it('returns neighbors sorted by depth then name (not DB/insertion order)', async () => {
      await writer.writeFiles([
        emptyFile({
          classes: [
            cls('Target', '/app/Target.ts', 1, []),
            cls('Zeta', '/app/Zeta.ts', 1, [], { superClass: 'Target' }),
            cls('Alpha', '/app/Alpha.ts', 1, [], { superClass: 'Target' }),
            cls('Mid', '/app/Mid.ts', 1, [], { superClass: 'Target' }),
          ],
        }),
      ]);

      // Asserted WITHOUT sorting in the test: the reader must already return a stable, name-sorted list.
      const n = await reader.getNeighbors({ nodeName: 'Target', direction: 'incoming' });
      expect(n.map((x) => x.name)).toEqual(['Alpha', 'Mid', 'Zeta']);
    });

    it('search_nodes orders homonyms by filePath, not DB row order', async () => {
      // Same class name in three files (package-less → distinct nodes). Exact/test rank tie on all
      // three, so without a filePath tiebreak their order would shuffle between runs.
      await writer.writeFiles([
        emptyFile({ filePath: '/app/zzz.ts', packageName: undefined, classes: [cls('Config', '/app/zzz.ts', 1, [])] }),
        emptyFile({ filePath: '/app/aaa.ts', packageName: undefined, classes: [cls('Config', '/app/aaa.ts', 1, [])] }),
        emptyFile({ filePath: '/app/mmm.ts', packageName: undefined, classes: [cls('Config', '/app/mmm.ts', 1, [])] }),
      ]);

      const r = await reader.searchNodes({ query: 'Config', match: 'exact', nodeTypes: ['class'] });
      expect(r.map((n) => n.filePath)).toEqual(['/app/aaa.ts', '/app/mmm.ts', '/app/zzz.ts']);
    });
  });
});
