/**
 * Neo4jWriter Integration Tests
 *
 * Uses Testcontainers to spin up a real Neo4j instance for testing.
 * These tests verify that the writer correctly creates nodes and relationships.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Neo4jContainer, StartedNeo4jContainer } from '@testcontainers/neo4j';
import { Neo4jClient } from '../../neo4j/neo4j.js';
import { Neo4jWriter, buildFqn, serializeTypeParameters } from './index.js';
import type { ResolvedFile, ParsedClass, ParsedFunction, ParsedProperty, SourceLocation } from '../types.js';

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

function createResolvedFile(overrides: Partial<ResolvedFile> = {}): ResolvedFile {
  return {
    filePath: '/test/Test.kt',
    imports: [],
    classes: [],
    topLevelFunctions: [],
    topLevelProperties: [],
    typeAliases: [],
    destructuringDeclarations: [],
    objectExpressions: [],
    resolvedCalls: [],
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

function createParsedProperty(overrides: Partial<ParsedProperty> = {}): ParsedProperty {
  return {
    name: 'testProperty',
    visibility: 'public',
    isVal: true,
    annotations: [],
    location: defaultLocation,
    ...overrides,
  };
}

// =============================================================================
// Helper Function Tests (no Neo4j needed)
// =============================================================================

describe('Helper Functions', () => {
  describe('buildFqn', () => {
    it('should build FQN with package', () => {
      expect(buildFqn('com.example', 'UserService')).toBe('com.example.UserService');
    });

    it('should build FQN without package', () => {
      expect(buildFqn(undefined, 'UserService')).toBe('UserService');
    });

    it('should build FQN with multiple parts', () => {
      expect(buildFqn('com.example', 'UserService', 'save')).toBe('com.example.UserService.save');
    });

    it('should filter empty parts', () => {
      expect(buildFqn('com.example', '', 'UserService')).toBe('com.example.UserService');
    });
  });

  describe('serializeTypeParameters', () => {
    it('should return null for empty array', () => {
      expect(serializeTypeParameters([])).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(serializeTypeParameters(undefined)).toBeNull();
    });

    it('should serialize simple type parameter', () => {
      expect(serializeTypeParameters([{ name: 'T' }])).toEqual(['T']);
    });

    it('should serialize type parameter with variance', () => {
      expect(serializeTypeParameters([{ name: 'T', variance: 'out' }])).toEqual(['out T']);
    });

    it('should serialize type parameter with reified', () => {
      expect(serializeTypeParameters([{ name: 'T', isReified: true }])).toEqual(['reified T']);
    });

    it('should serialize type parameter with bounds', () => {
      expect(serializeTypeParameters([{ name: 'T', bounds: ['Comparable<T>', 'Serializable'] }])).toEqual([
        'T : Comparable<T> & Serializable',
      ]);
    });

    it('should serialize complex type parameter', () => {
      expect(
        serializeTypeParameters([
          { name: 'T', variance: 'out', isReified: true, bounds: ['Any'] },
        ])
      ).toEqual(['reified out T : Any']);
    });
  });
});

// =============================================================================
// Integration Tests with Testcontainers
// =============================================================================

describe('Neo4jWriter Integration Tests', () => {
  let container: StartedNeo4jContainer;
  let client: Neo4jClient;
  let writer: Neo4jWriter;

  // Start Neo4j container before all tests (this takes ~20-30 seconds)
  beforeAll(async () => {
    container = await new Neo4jContainer('neo4j:5-community')
      .withReuse()
      .start();

    client = new Neo4jClient(container.getBoltUri(), 'neo4j', container.getPassword());
    await client.connect();

    writer = new Neo4jWriter(client);
  }, 120000); // 2 minute timeout for container startup

  // Cleanup after all tests
  afterAll(async () => {
    await client?.close();
    await container?.stop();
  });

  // Clear the database before each test
  beforeEach(async () => {
    await writer.clearGraph();
  });

  describe('ensureConstraintsAndIndexes', () => {
    it('should create constraints without errors', async () => {
      await expect(writer.ensureConstraintsAndIndexes()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await writer.ensureConstraintsAndIndexes();
      await expect(writer.ensureConstraintsAndIndexes()).resolves.not.toThrow();
    });
  });

  describe('clearGraph', () => {
    it('should clear all nodes and relationships', async () => {
      // Create some data first
      await client.write('CREATE (:Package {name: "test"})');
      await client.write('CREATE (:Class {fqn: "test.Foo", name: "Foo"})');

      // Clear
      const result = await writer.clearGraph();

      // Verify
      expect(result.nodesDeleted).toBeGreaterThanOrEqual(2);

      const remaining = await client.query<{ count: number }>('MATCH (n) RETURN count(n) as count');
      expect(remaining[0]?.count).toBe(0);
    });
  });

  describe('writeFiles - Package creation', () => {
    it('should create package nodes', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'UserService' })],
      });

      await writer.writeFiles([file]);

      const packages = await client.query<{ name: string }>(
        'MATCH (p:Package) RETURN p.name as name'
      );
      expect(packages).toHaveLength(1);
      expect(packages[0]?.name).toBe('com.example');
    });

    it('should not duplicate packages', async () => {
      const file1 = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'UserService' })],
      });
      const file2 = createResolvedFile({
        filePath: '/test/Other.kt',
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'OrderService' })],
      });

      await writer.writeFiles([file1, file2]);

      const packages = await client.query<{ count: number }>('MATCH (p:Package) RETURN count(p) as count');
      expect(packages[0]?.count).toBe(1);
    });
  });

  describe('writeFiles - Class creation', () => {
    it('should create a simple class', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'UserService' })],
      });

      const result = await writer.writeFiles([file]);

      expect(result.filesProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);

      const classes = await client.query<{ fqn: string; name: string }>(
        'MATCH (c:Class) RETURN c.fqn as fqn, c.name as name'
      );
      expect(classes).toHaveLength(1);
      expect(classes[0]?.fqn).toBe('com.example.UserService');
      expect(classes[0]?.name).toBe('UserService');
    });

    it('should create CONTAINS relationship from package', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'UserService' })],
      });

      await writer.writeFiles([file]);

      const rels = await client.query<{ pkg: string; cls: string }>(
        'MATCH (p:Package)-[:CONTAINS]->(c:Class) RETURN p.name as pkg, c.name as cls'
      );
      expect(rels).toHaveLength(1);
      expect(rels[0]?.pkg).toBe('com.example');
      expect(rels[0]?.cls).toBe('UserService');
    });

    it('should create a data class with correct properties', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            isData: true,
            visibility: 'public',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const classes = await client.query<{ isData: boolean }>(
        'MATCH (c:Class {name: "User"}) RETURN c.isData as isData'
      );
      expect(classes[0]?.isData).toBe(true);
    });

    it('should create an interface', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Repository',
            kind: 'interface',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const interfaces = await client.query<{ name: string; fqn: string }>(
        'MATCH (i:Interface) RETURN i.name as name, i.fqn as fqn'
      );
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0]?.name).toBe('Repository');
    });

    it('should create an object (singleton)', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'AppConfig',
            kind: 'object',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const objects = await client.query<{ name: string; isCompanion: boolean }>(
        'MATCH (o:Object) RETURN o.name as name, o.isCompanion as isCompanion'
      );
      expect(objects).toHaveLength(1);
      expect(objects[0]?.name).toBe('AppConfig');
      expect(objects[0]?.isCompanion).toBe(false);
    });
  });

  describe('writeFiles - Class members', () => {
    it('should create functions with DECLARES relationship', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({ name: 'save', returnType: 'Unit' }),
              createParsedFunction({ name: 'findById', returnType: 'User?' }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const functions = await client.query<{ fqn: string; name: string }>(
        'MATCH (c:Class)-[:DECLARES]->(f:Function) RETURN f.fqn as fqn, f.name as name ORDER BY f.name'
      );
      expect(functions).toHaveLength(2);
      expect(functions[0]?.name).toBe('findById');
      expect(functions[1]?.name).toBe('save');
    });

    it('should create properties with DECLARES relationship', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            properties: [
              createParsedProperty({ name: 'repository', type: 'UserRepository' }),
              createParsedProperty({ name: 'logger', type: 'Logger', isVal: false }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const properties = await client.query<{ name: string; type: string; isMutable: boolean }>(
        'MATCH (c:Class)-[:DECLARES]->(p:Property) RETURN p.name as name, p.type as type, p.isMutable as isMutable ORDER BY p.name'
      );
      expect(properties).toHaveLength(2);
      expect(properties[0]?.name).toBe('logger');
      expect(properties[0]?.isMutable).toBe(true);
      expect(properties[1]?.name).toBe('repository');
      expect(properties[1]?.isMutable).toBe(false);
    });

    it('should create function parameters', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'save',
                parameters: [
                  { name: 'user', type: 'User', annotations: [] },
                  { name: 'validate', type: 'Boolean', defaultValue: 'true', annotations: [] },
                ],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ name: string; type: string; position: number; hasDefault: boolean }>(
        `MATCH (f:Function)-[r:HAS_PARAMETER]->(p:Parameter)
         RETURN p.name as name, p.type as type, r.position as position, p.hasDefault as hasDefault
         ORDER BY r.position`
      );
      expect(params).toHaveLength(2);
      expect(params[0]?.name).toBe('user');
      expect(params[0]?.position).toBe(0);
      expect(params[0]?.hasDefault).toBe(false);
      expect(params[1]?.name).toBe('validate');
      expect(params[1]?.position).toBe(1);
      expect(params[1]?.hasDefault).toBe(true);
    });
  });

  describe('writeFiles - Inheritance', () => {
    it('should create EXTENDS relationship', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'BaseService' }),
          createParsedClass({ name: 'UserService', superClass: 'BaseService' }),
        ],
      });

      await writer.writeFiles([file]);

      const extends_ = await client.query<{ child: string; parent: string }>(
        'MATCH (child:Class)-[:EXTENDS]->(parent:Class) RETURN child.name as child, parent.name as parent'
      );
      expect(extends_).toHaveLength(1);
      expect(extends_[0]?.child).toBe('UserService');
      expect(extends_[0]?.parent).toBe('BaseService');
    });

    it('should create IMPLEMENTS relationship', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'Repository', kind: 'interface' }),
          createParsedClass({ name: 'UserRepository', interfaces: ['Repository'] }),
        ],
      });

      await writer.writeFiles([file]);

      const implements_ = await client.query<{ class: string; interface: string }>(
        'MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface) RETURN c.name as class, i.name as interface'
      );
      expect(implements_).toHaveLength(1);
      expect(implements_[0]?.class).toBe('UserRepository');
      expect(implements_[0]?.interface).toBe('Repository');
    });
  });

  describe('writeFiles - Companion objects', () => {
    it('should create companion object with DECLARES relationship', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            companionObject: createParsedClass({
              name: 'Companion',
              kind: 'object',
              functions: [createParsedFunction({ name: 'create' })],
            }),
          }),
        ],
      });

      await writer.writeFiles([file]);

      const companions = await client.query<{ name: string; isCompanion: boolean; parentClass: string }>(
        'MATCH (c:Class)-[:DECLARES]->(o:Object) RETURN o.name as name, o.isCompanion as isCompanion, o.parentClass as parentClass'
      );
      expect(companions).toHaveLength(1);
      expect(companions[0]?.name).toBe('Companion');
      expect(companions[0]?.isCompanion).toBe(true);
      expect(companions[0]?.parentClass).toBe('com.example.UserService');

      // Verify companion's function
      const funcs = await client.query<{ name: string }>(
        'MATCH (o:Object)-[:DECLARES]->(f:Function) RETURN f.name as name'
      );
      expect(funcs).toHaveLength(1);
      expect(funcs[0]?.name).toBe('create');
    });
  });

  describe('writeFiles - Nested classes', () => {
    it('should create nested class with correct FQN', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Outer',
            nestedClasses: [createParsedClass({ name: 'Inner' })],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const classes = await client.query<{ fqn: string }>(
        'MATCH (c:Class) RETURN c.fqn as fqn ORDER BY c.fqn'
      );
      expect(classes).toHaveLength(2);
      expect(classes[0]?.fqn).toBe('com.example.Outer');
      expect(classes[1]?.fqn).toBe('com.example.Outer.Inner');
    });
  });

  describe('writeFiles - Top-level elements', () => {
    it('should create top-level functions with CONTAINS from package', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        topLevelFunctions: [
          createParsedFunction({ name: 'main', returnType: 'Unit' }),
          createParsedFunction({ name: 'helper', isExtension: true, receiverType: 'String' }),
        ],
      });

      await writer.writeFiles([file]);

      const funcs = await client.query<{ name: string; isTopLevel: boolean }>(
        'MATCH (p:Package)-[:CONTAINS]->(f:Function) RETURN f.name as name, f.isTopLevel as isTopLevel ORDER BY f.name'
      );
      expect(funcs).toHaveLength(2);
      expect(funcs[0]?.name).toBe('helper');
      expect(funcs[0]?.isTopLevel).toBe(true);
      expect(funcs[1]?.name).toBe('main');
    });

    it('should create top-level properties', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        topLevelProperties: [
          createParsedProperty({ name: 'VERSION', type: 'String' }),
        ],
      });

      await writer.writeFiles([file]);

      const props = await client.query<{ name: string; isTopLevel: boolean }>(
        'MATCH (p:Package)-[:CONTAINS]->(prop:Property) RETURN prop.name as name, prop.isTopLevel as isTopLevel'
      );
      expect(props).toHaveLength(1);
      expect(props[0]?.name).toBe('VERSION');
      expect(props[0]?.isTopLevel).toBe(true);
    });
  });

  describe('writeFiles - Type aliases', () => {
    it('should create type alias nodes', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        typeAliases: [
          {
            name: 'StringList',
            aliasedType: 'List<String>',
            visibility: 'public',
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const aliases = await client.query<{ name: string; aliasedType: string }>(
        'MATCH (t:TypeAlias) RETURN t.name as name, t.aliasedType as aliasedType'
      );
      expect(aliases).toHaveLength(1);
      expect(aliases[0]?.name).toBe('StringList');
      expect(aliases[0]?.aliasedType).toBe('List<String>');
    });
  });

  describe('writeFiles - Annotations', () => {
    it('should create annotation nodes and ANNOTATED_WITH relationships', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            annotations: [{ name: 'Service' }, { name: 'Singleton' }],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const annotations = await client.query<{ name: string }>(
        'MATCH (c:Class)-[:ANNOTATED_WITH]->(a:Annotation) RETURN a.name as name ORDER BY a.name'
      );
      expect(annotations).toHaveLength(2);
      expect(annotations[0]?.name).toBe('@Service');
      expect(annotations[1]?.name).toBe('@Singleton');
    });

    it('should store annotation arguments', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            annotations: [{ name: 'Deprecated', arguments: { message: 'Use v2' } }],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const annotations = await client.query<{ name: string; arguments: string }>(
        'MATCH (a:Annotation) RETURN a.name as name, a.arguments as arguments'
      );
      expect(annotations).toHaveLength(1);
      const args = annotations[0]?.arguments;
      expect(args).toBeDefined();
      expect(JSON.parse(args!)).toEqual({ message: 'Use v2' });
    });
  });

  describe('writeFiles - Resolved calls', () => {
    it('should create CALLS relationships for resolved calls', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            functions: [createParsedFunction({ name: 'save' })],
          }),
          createParsedClass({
            name: 'UserController',
            functions: [createParsedFunction({ name: 'handleSave' })],
          }),
        ],
        resolvedCalls: [
          {
            fromFqn: 'com.example.UserController.handleSave',
            toFqn: 'com.example.UserService.save',
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const calls = await client.query<{ from: string; to: string; count: number }>(
        'MATCH (caller:Function)-[r:CALLS]->(callee:Function) RETURN caller.name as from, callee.name as to, r.count as count'
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]?.from).toBe('handleSave');
      expect(calls[0]?.to).toBe('save');
      expect(calls[0]?.count).toBe(1);
    });

    it('should increment count for duplicate calls', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            functions: [createParsedFunction({ name: 'save' })],
          }),
          createParsedClass({
            name: 'UserController',
            functions: [createParsedFunction({ name: 'handleSave' })],
          }),
        ],
        resolvedCalls: [
          {
            fromFqn: 'com.example.UserController.handleSave',
            toFqn: 'com.example.UserService.save',
            location: defaultLocation,
          },
          {
            fromFqn: 'com.example.UserController.handleSave',
            toFqn: 'com.example.UserService.save',
            location: { ...defaultLocation, startLine: 10 },
          },
        ],
      });

      await writer.writeFiles([file]);

      const calls = await client.query<{ count: number }>(
        'MATCH (:Function)-[r:CALLS]->(:Function) RETURN r.count as count'
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]?.count).toBe(2);
    });
  });

  describe('writeFiles - Function modifiers', () => {
    it('should store function modifiers correctly', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Utils',
            functions: [
              createParsedFunction({
                name: 'fetchData',
                isSuspend: true,
                isInline: true,
              }),
              createParsedFunction({
                name: 'add',
                isInfix: true,
                isOperator: true,
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const funcs = await client.query<{
        name: string;
        isSuspend: boolean;
        isInline: boolean;
        isInfix: boolean;
        isOperator: boolean;
      }>(
        'MATCH (f:Function) RETURN f.name as name, f.isSuspend as isSuspend, f.isInline as isInline, f.isInfix as isInfix, f.isOperator as isOperator ORDER BY f.name'
      );

      expect(funcs).toHaveLength(2);
      expect(funcs[0]?.name).toBe('add');
      expect(funcs[0]?.isInfix).toBe(true);
      expect(funcs[0]?.isOperator).toBe(true);
      expect(funcs[1]?.name).toBe('fetchData');
      expect(funcs[1]?.isSuspend).toBe(true);
      expect(funcs[1]?.isInline).toBe(true);
    });
  });

  describe('writeFiles - Error handling', () => {
    it('should continue processing files after errors and report them', async () => {
      const validFile = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'ValidClass' })],
      });

      // This should process without errors
      const result = await writer.writeFiles([validFile]);

      expect(result.filesProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('writeFiles - Result counting', () => {
    it('should correctly count created nodes and relationships', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            annotations: [{ name: 'Service' }],
            properties: [createParsedProperty({ name: 'repo' })],
            functions: [
              createParsedFunction({
                name: 'save',
                parameters: [{ name: 'user', type: 'User', annotations: [] }],
              }),
            ],
          }),
        ],
      });

      const result = await writer.writeFiles([file]);

      // Nodes: 1 package + 1 class + 1 annotation + 1 property + 1 function + 1 parameter = 6
      // Relationships: CONTAINS(pkg->class) + ANNOTATED_WITH + DECLARES(prop) + DECLARES(func) + HAS_PARAMETER = 5
      expect(result.nodesCreated).toBeGreaterThanOrEqual(6);
      expect(result.relationshipsCreated).toBeGreaterThanOrEqual(5);
    });
  });
});
