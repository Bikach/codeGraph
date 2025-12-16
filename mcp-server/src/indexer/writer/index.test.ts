/**
 * Neo4jWriter Integration Tests
 *
 * Uses Testcontainers to spin up a real Neo4j instance for testing.
 * These tests verify that the writer correctly creates nodes and relationships.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Neo4jContainer, StartedNeo4jContainer } from '@testcontainers/neo4j';
import { Neo4jClient } from '../../neo4j/neo4j.js';
import { Neo4jWriter, buildFqn, serializeTypeParameters, extractTypeNames } from './index.js';
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

  describe('extractTypeNames', () => {
    it('should return empty array for undefined', () => {
      expect(extractTypeNames(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(extractTypeNames('')).toEqual([]);
    });

    it('should extract simple type name', () => {
      expect(extractTypeNames('User')).toEqual(['User']);
    });

    it('should extract type from generic', () => {
      expect(extractTypeNames('List<User>')).toEqual(['User']);
    });

    it('should extract multiple types from Map', () => {
      const types = extractTypeNames('Map<UserId, UserData>');
      expect(types).toContain('UserId');
      expect(types).toContain('UserData');
    });

    it('should handle nullable types', () => {
      expect(extractTypeNames('User?')).toEqual(['User']);
    });

    it('should handle nested generics', () => {
      const types = extractTypeNames('List<Pair<User, Order>>');
      expect(types).toContain('User');
      expect(types).toContain('Order');
    });

    it('should filter built-in types', () => {
      expect(extractTypeNames('String')).toEqual([]);
      expect(extractTypeNames('Int')).toEqual([]);
      expect(extractTypeNames('List<String>')).toEqual([]);
      expect(extractTypeNames('Map<String, Int>')).toEqual([]);
    });

    it('should extract user types while filtering built-ins', () => {
      const types = extractTypeNames('Map<String, User>');
      expect(types).toEqual(['User']);
    });

    it('should not duplicate types', () => {
      const types = extractTypeNames('Pair<User, User>');
      expect(types).toEqual(['User']);
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

  // ===========================================================================
  // Additional tests for previously uncovered cases
  // ===========================================================================

  describe('writeFiles - Enum classes', () => {
    it('should create enum as Class with isEnum property', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Status',
            kind: 'enum',
            visibility: 'public',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const enums = await client.query<{ name: string; isEnum: boolean; fqn: string }>(
        'MATCH (c:Class {name: "Status"}) RETURN c.name as name, c.isEnum as isEnum, c.fqn as fqn'
      );
      expect(enums).toHaveLength(1);
      expect(enums[0]?.name).toBe('Status');
      expect(enums[0]?.isEnum).toBe(true);
      expect(enums[0]?.fqn).toBe('com.example.Status');
    });

    it('should create enum with functions and properties', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Color',
            kind: 'enum',
            properties: [createParsedProperty({ name: 'hex', type: 'String' })],
            functions: [createParsedFunction({ name: 'toRgb', returnType: 'IntArray' })],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const members = await client.query<{ propName: string; funcName: string }>(
        `MATCH (c:Class {name: "Color"})-[:DECLARES]->(p:Property)
         MATCH (c)-[:DECLARES]->(f:Function)
         RETURN p.name as propName, f.name as funcName`
      );
      expect(members).toHaveLength(1);
      expect(members[0]?.propName).toBe('hex');
      expect(members[0]?.funcName).toBe('toRgb');
    });
  });

  describe('writeFiles - Annotation classes', () => {
    it('should create annotation class with isAnnotationClass property', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'MyAnnotation',
            kind: 'annotation',
            visibility: 'public',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const annotations = await client.query<{ name: string; isAnnotationClass: boolean }>(
        'MATCH (c:Class {name: "MyAnnotation"}) RETURN c.name as name, c.isAnnotationClass as isAnnotationClass'
      );
      expect(annotations).toHaveLength(1);
      expect(annotations[0]?.name).toBe('MyAnnotation');
      expect(annotations[0]?.isAnnotationClass).toBe(true);
    });

    it('should create annotation class with properties (annotation parameters)', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Deprecated',
            kind: 'annotation',
            properties: [
              createParsedProperty({ name: 'message', type: 'String' }),
              createParsedProperty({ name: 'level', type: 'DeprecationLevel' }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const props = await client.query<{ name: string }>(
        'MATCH (c:Class {name: "Deprecated"})-[:DECLARES]->(p:Property) RETURN p.name as name ORDER BY p.name'
      );
      expect(props).toHaveLength(2);
      expect(props[0]?.name).toBe('level');
      expect(props[1]?.name).toBe('message');
    });
  });

  describe('writeFiles - Sealed classes and interfaces', () => {
    it('should create sealed class with isSealed property', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Result',
            kind: 'class',
            isSealed: true,
            visibility: 'public',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const sealed = await client.query<{ name: string; isSealed: boolean }>(
        'MATCH (c:Class {name: "Result"}) RETURN c.name as name, c.isSealed as isSealed'
      );
      expect(sealed).toHaveLength(1);
      expect(sealed[0]?.isSealed).toBe(true);
    });

    it('should create sealed interface with isSealed property', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'State',
            kind: 'interface',
            isSealed: true,
            visibility: 'public',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const sealed = await client.query<{ name: string; isSealed: boolean }>(
        'MATCH (i:Interface {name: "State"}) RETURN i.name as name, i.isSealed as isSealed'
      );
      expect(sealed).toHaveLength(1);
      expect(sealed[0]?.isSealed).toBe(true);
    });

    it('should create sealed class hierarchy', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Result',
            kind: 'class',
            isSealed: true,
            nestedClasses: [
              createParsedClass({ name: 'Success', superClass: 'Result' }),
              createParsedClass({ name: 'Error', superClass: 'Result' }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const hierarchy = await client.query<{ parent: string; child: string }>(
        'MATCH (child:Class)-[:EXTENDS]->(parent:Class {name: "Result"}) RETURN parent.name as parent, child.name as child ORDER BY child.name'
      );
      expect(hierarchy).toHaveLength(2);
      expect(hierarchy[0]?.child).toBe('Error');
      expect(hierarchy[1]?.child).toBe('Success');
    });
  });

  describe('writeFiles - Type parameters', () => {
    it('should store type parameters on class', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Container',
            typeParameters: [
              { name: 'T' },
              { name: 'R', bounds: ['Comparable<R>'] },
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const classes = await client.query<{ name: string; typeParameters: string[] }>(
        'MATCH (c:Class {name: "Container"}) RETURN c.name as name, c.typeParameters as typeParameters'
      );
      expect(classes).toHaveLength(1);
      expect(classes[0]?.typeParameters).toEqual(['T', 'R : Comparable<R>']);
    });

    it('should store type parameters with variance on interface', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Producer',
            kind: 'interface',
            typeParameters: [{ name: 'T', variance: 'out' }],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const interfaces = await client.query<{ typeParameters: string[] }>(
        'MATCH (i:Interface {name: "Producer"}) RETURN i.typeParameters as typeParameters'
      );
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0]?.typeParameters).toEqual(['out T']);
    });

    it('should store type parameters on function', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Utils',
            functions: [
              createParsedFunction({
                name: 'transform',
                typeParameters: [
                  { name: 'T', isReified: true },
                  { name: 'R', bounds: ['Any'] },
                ],
                returnType: 'R',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const funcs = await client.query<{ typeParameters: string[] }>(
        'MATCH (f:Function {name: "transform"}) RETURN f.typeParameters as typeParameters'
      );
      expect(funcs).toHaveLength(1);
      expect(funcs[0]?.typeParameters).toEqual(['reified T', 'R : Any']);
    });

    it('should store type parameters on type alias', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        typeAliases: [
          {
            name: 'Mapper',
            aliasedType: '(T) -> R',
            visibility: 'public',
            typeParameters: [{ name: 'T' }, { name: 'R' }],
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const aliases = await client.query<{ typeParameters: string[] }>(
        'MATCH (t:TypeAlias {name: "Mapper"}) RETURN t.typeParameters as typeParameters'
      );
      expect(aliases).toHaveLength(1);
      expect(aliases[0]?.typeParameters).toEqual(['T', 'R']);
    });
  });

  describe('writeFiles - Extension functions', () => {
    it('should store receiverType on extension function in class', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'StringExtensions',
            functions: [
              createParsedFunction({
                name: 'capitalizeFirst',
                isExtension: true,
                receiverType: 'String',
                returnType: 'String',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const funcs = await client.query<{ name: string; isExtension: boolean; receiverType: string }>(
        'MATCH (f:Function {name: "capitalizeFirst"}) RETURN f.name as name, f.isExtension as isExtension, f.receiverType as receiverType'
      );
      expect(funcs).toHaveLength(1);
      expect(funcs[0]?.isExtension).toBe(true);
      expect(funcs[0]?.receiverType).toBe('String');
    });

    it('should store receiverType on top-level extension function', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        topLevelFunctions: [
          createParsedFunction({
            name: 'isBlank',
            isExtension: true,
            receiverType: 'String?',
            returnType: 'Boolean',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const funcs = await client.query<{ isExtension: boolean; receiverType: string; isTopLevel: boolean }>(
        'MATCH (f:Function {name: "isBlank"}) RETURN f.isExtension as isExtension, f.receiverType as receiverType, f.isTopLevel as isTopLevel'
      );
      expect(funcs).toHaveLength(1);
      expect(funcs[0]?.isExtension).toBe(true);
      expect(funcs[0]?.receiverType).toBe('String?');
      expect(funcs[0]?.isTopLevel).toBe(true);
    });
  });

  describe('writeFiles - clearBefore option', () => {
    it('should clear existing data when clearBefore is true', async () => {
      // First, create some data
      const file1 = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'OldClass' })],
      });
      await writer.writeFiles([file1]);

      // Verify data exists
      let classes = await client.query<{ count: number }>('MATCH (c:Class) RETURN count(c) as count');
      expect(classes[0]?.count).toBe(1);

      // Now write with clearBefore
      const file2 = createResolvedFile({
        packageName: 'com.other',
        classes: [createParsedClass({ name: 'NewClass' })],
      });
      await writer.writeFiles([file2], { clearBefore: true });

      // Verify old data is gone and new data exists
      classes = await client.query<{ count: number }>('MATCH (c:Class) RETURN count(c) as count');
      expect(classes[0]?.count).toBe(1);

      const names = await client.query<{ name: string }>('MATCH (c:Class) RETURN c.name as name');
      expect(names[0]?.name).toBe('NewClass');
    });

    it('should preserve existing data when clearBefore is false', async () => {
      // First, create some data
      const file1 = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'OldClass' })],
      });
      await writer.writeFiles([file1]);

      // Write more data without clearing
      const file2 = createResolvedFile({
        packageName: 'com.other',
        classes: [createParsedClass({ name: 'NewClass' })],
      });
      await writer.writeFiles([file2], { clearBefore: false });

      // Both should exist
      const classes = await client.query<{ name: string }>('MATCH (c:Class) RETURN c.name as name ORDER BY c.name');
      expect(classes).toHaveLength(2);
      expect(classes[0]?.name).toBe('NewClass');
      expect(classes[1]?.name).toBe('OldClass');
    });
  });

  describe('writeFiles - batchSize configuration', () => {
    it('should process calls in batches', async () => {
      // Create many calls to test batching (more than default batch size of 100)
      const functions: ReturnType<typeof createParsedFunction>[] = [];
      const resolvedCalls: ResolvedFile['resolvedCalls'] = [];

      // Create 10 functions
      for (let i = 0; i < 10; i++) {
        functions.push(createParsedFunction({ name: `func${i}` }));
      }

      // Create 50 calls (5 calls from each function to different targets)
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          const targetIdx = (i + j + 1) % 10;
          resolvedCalls.push({
            fromFqn: `com.example.Service.func${i}`,
            toFqn: `com.example.Service.func${targetIdx}`,
            location: defaultLocation,
          });
        }
      }

      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'Service',
            functions,
          }),
        ],
        resolvedCalls,
      });

      // Use small batch size to force multiple batches
      const smallBatchWriter = new Neo4jWriter(client, { batchSize: 10 });
      const result = await smallBatchWriter.writeFiles([file]);

      expect(result.errors).toHaveLength(0);
      expect(result.relationshipsCreated).toBeGreaterThan(0);

      // Verify all calls were created
      const callCount = await client.query<{ count: number }>(
        'MATCH (:Function)-[r:CALLS]->(:Function) RETURN count(r) as count'
      );
      expect(callCount[0]?.count).toBeGreaterThan(0);
    });
  });

  describe('writeFiles - Lambda parameters with functionType', () => {
    it('should store functionType on lambda parameter', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'CollectionUtils',
            functions: [
              createParsedFunction({
                name: 'map',
                parameters: [
                  { name: 'list', type: 'List<T>', annotations: [] },
                  {
                    name: 'transform',
                    type: '(T) -> R',
                    annotations: [],
                    functionType: {
                      parameterTypes: ['T'],
                      returnType: 'R',
                      isSuspend: false,
                    },
                  },
                ],
                returnType: 'List<R>',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ name: string; functionType: string }>(
        `MATCH (f:Function {name: "map"})-[:HAS_PARAMETER]->(p:Parameter {name: "transform"})
         RETURN p.name as name, p.functionType as functionType`
      );
      expect(params).toHaveLength(1);
      expect(params[0]?.functionType).toBeDefined();
      const ft = JSON.parse(params[0]!.functionType);
      expect(ft.parameterTypes).toEqual(['T']);
      expect(ft.returnType).toBe('R');
      expect(ft.isSuspend).toBe(false);
    });

    it('should store suspend functionType on lambda parameter', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'AsyncUtils',
            functions: [
              createParsedFunction({
                name: 'retry',
                parameters: [
                  {
                    name: 'block',
                    type: 'suspend () -> T',
                    annotations: [],
                    functionType: {
                      parameterTypes: [],
                      returnType: 'T',
                      isSuspend: true,
                    },
                  },
                ],
                isSuspend: true,
                returnType: 'T',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ functionType: string }>(
        `MATCH (f:Function {name: "retry"})-[:HAS_PARAMETER]->(p:Parameter {name: "block"})
         RETURN p.functionType as functionType`
      );
      expect(params).toHaveLength(1);
      const ft = JSON.parse(params[0]!.functionType);
      expect(ft.isSuspend).toBe(true);
    });

    it('should store functionType with receiver on lambda parameter', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'BuilderUtils',
            functions: [
              createParsedFunction({
                name: 'build',
                parameters: [
                  {
                    name: 'init',
                    type: 'StringBuilder.() -> Unit',
                    annotations: [],
                    functionType: {
                      parameterTypes: [],
                      returnType: 'Unit',
                      isSuspend: false,
                      receiverType: 'StringBuilder',
                    },
                  },
                ],
                returnType: 'String',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ functionType: string }>(
        `MATCH (f:Function {name: "build"})-[:HAS_PARAMETER]->(p:Parameter {name: "init"})
         RETURN p.functionType as functionType`
      );
      expect(params).toHaveLength(1);
      const ft = JSON.parse(params[0]!.functionType);
      expect(ft.receiverType).toBe('StringBuilder');
    });
  });

  describe('writeFiles - Parameter modifiers (crossinline/noinline)', () => {
    it('should store crossinline modifier on parameter', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'InlineUtils',
            functions: [
              createParsedFunction({
                name: 'runSafe',
                isInline: true,
                parameters: [
                  {
                    name: 'block',
                    type: '() -> Unit',
                    annotations: [],
                    isCrossinline: true,
                  },
                ],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ name: string; isCrossinline: boolean }>(
        `MATCH (f:Function {name: "runSafe"})-[:HAS_PARAMETER]->(p:Parameter)
         RETURN p.name as name, p.isCrossinline as isCrossinline`
      );
      expect(params).toHaveLength(1);
      expect(params[0]?.isCrossinline).toBe(true);
    });

    it('should store noinline modifier on parameter', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'InlineUtils',
            functions: [
              createParsedFunction({
                name: 'measure',
                isInline: true,
                parameters: [
                  {
                    name: 'action',
                    type: '() -> T',
                    annotations: [],
                    isNoinline: true,
                  },
                ],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ name: string; isNoinline: boolean }>(
        `MATCH (f:Function {name: "measure"})-[:HAS_PARAMETER]->(p:Parameter)
         RETURN p.name as name, p.isNoinline as isNoinline`
      );
      expect(params).toHaveLength(1);
      expect(params[0]?.isNoinline).toBe(true);
    });
  });

  describe('writeFiles - Abstract functions and classes', () => {
    it('should store isAbstract on class and function', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'BaseRepository',
            isAbstract: true,
            functions: [
              createParsedFunction({
                name: 'findAll',
                isAbstract: true,
                returnType: 'List<T>',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const classes = await client.query<{ isAbstract: boolean }>(
        'MATCH (c:Class {name: "BaseRepository"}) RETURN c.isAbstract as isAbstract'
      );
      expect(classes[0]?.isAbstract).toBe(true);

      const funcs = await client.query<{ isAbstract: boolean }>(
        'MATCH (f:Function {name: "findAll"}) RETURN f.isAbstract as isAbstract'
      );
      expect(funcs[0]?.isAbstract).toBe(true);
    });
  });

  describe('writeFiles - Visibility modifiers', () => {
    it('should store different visibility modifiers', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'MixedVisibility',
            visibility: 'public',
            functions: [
              createParsedFunction({ name: 'publicFn', visibility: 'public' }),
              createParsedFunction({ name: 'privateFn', visibility: 'private' }),
              createParsedFunction({ name: 'protectedFn', visibility: 'protected' }),
              createParsedFunction({ name: 'internalFn', visibility: 'internal' }),
            ],
            properties: [
              createParsedProperty({ name: 'publicProp', visibility: 'public' }),
              createParsedProperty({ name: 'privateProp', visibility: 'private' }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const funcs = await client.query<{ name: string; visibility: string }>(
        'MATCH (f:Function) RETURN f.name as name, f.visibility as visibility ORDER BY f.name'
      );
      expect(funcs).toHaveLength(4);
      expect(funcs.find(f => f.name === 'privateFn')?.visibility).toBe('private');
      expect(funcs.find(f => f.name === 'protectedFn')?.visibility).toBe('protected');
      expect(funcs.find(f => f.name === 'internalFn')?.visibility).toBe('internal');

      const props = await client.query<{ name: string; visibility: string }>(
        'MATCH (p:Property) RETURN p.name as name, p.visibility as visibility ORDER BY p.name'
      );
      expect(props.find(p => p.name === 'privateProp')?.visibility).toBe('private');
    });
  });

  describe('writeFiles - ensureSchema option', () => {
    it('should skip schema creation when ensureSchema is false', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'TestClass' })],
      });

      // This should work without creating constraints (they already exist from earlier tests)
      const result = await writer.writeFiles([file], { ensureSchema: false });

      expect(result.errors).toHaveLength(0);
      expect(result.filesProcessed).toBe(1);
    });
  });

  // ===========================================================================
  // NEW FEATURE TESTS: USES, RETURNS, Secondary Constructors, Destructuring
  // ===========================================================================

  describe('writeFiles - USES relationship', () => {
    it('should create USES relationship from function parameter type', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'User' }),
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'save',
                parameters: [{ name: 'user', type: 'User', annotations: [] }],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const uses = await client.query<{ func: string; used: string; context: string }>(
        'MATCH (f:Function)-[r:USES]->(c:Class) RETURN f.name as func, c.name as used, r.context as context'
      );
      expect(uses).toHaveLength(1);
      expect(uses[0]?.func).toBe('save');
      expect(uses[0]?.used).toBe('User');
      expect(uses[0]?.context).toBe('parameter');
    });

    it('should create USES relationship from extension function receiver', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [createParsedClass({ name: 'CustomType' })],
        topLevelFunctions: [
          createParsedFunction({
            name: 'doSomething',
            isExtension: true,
            receiverType: 'CustomType',
          }),
        ],
      });

      await writer.writeFiles([file]);

      const uses = await client.query<{ func: string; used: string; context: string }>(
        'MATCH (f:Function)-[r:USES]->(c:Class) RETURN f.name as func, c.name as used, r.context as context'
      );
      expect(uses).toHaveLength(1);
      expect(uses[0]?.func).toBe('doSomething');
      expect(uses[0]?.used).toBe('CustomType');
      expect(uses[0]?.context).toBe('receiver');
    });

    it('should create USES relationship to interface', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'Repository', kind: 'interface' }),
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'setRepo',
                parameters: [{ name: 'repo', type: 'Repository', annotations: [] }],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const uses = await client.query<{ func: string; used: string }>(
        'MATCH (f:Function)-[:USES]->(i:Interface) RETURN f.name as func, i.name as used'
      );
      expect(uses).toHaveLength(1);
      expect(uses[0]?.func).toBe('setRepo');
      expect(uses[0]?.used).toBe('Repository');
    });

    it('should not create USES for built-in types like String, Int', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'process',
                parameters: [
                  { name: 'name', type: 'String', annotations: [] },
                  { name: 'count', type: 'Int', annotations: [] },
                ],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const uses = await client.query<{ count: number }>(
        'MATCH (:Function)-[r:USES]->() RETURN count(r) as count'
      );
      expect(uses[0]?.count).toBe(0);
    });

    it('should extract types from generic parameters', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'User' }),
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'saveAll',
                parameters: [{ name: 'users', type: 'List<User>', annotations: [] }],
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const uses = await client.query<{ used: string }>(
        'MATCH (:Function)-[:USES]->(c:Class) RETURN c.name as used'
      );
      expect(uses).toHaveLength(1);
      expect(uses[0]?.used).toBe('User');
    });
  });

  describe('writeFiles - RETURNS relationship', () => {
    it('should create RETURNS relationship from function return type', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'User' }),
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'findById',
                returnType: 'User',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const returns = await client.query<{ func: string; returned: string }>(
        'MATCH (f:Function)-[:RETURNS]->(c:Class) RETURN f.name as func, c.name as returned'
      );
      expect(returns).toHaveLength(1);
      expect(returns[0]?.func).toBe('findById');
      expect(returns[0]?.returned).toBe('User');
    });

    it('should create RETURNS relationship to interface', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'Repository', kind: 'interface' }),
          createParsedClass({
            name: 'ServiceFactory',
            functions: [
              createParsedFunction({
                name: 'createRepo',
                returnType: 'Repository',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const returns = await client.query<{ func: string; returned: string }>(
        'MATCH (f:Function)-[:RETURNS]->(i:Interface) RETURN f.name as func, i.name as returned'
      );
      expect(returns).toHaveLength(1);
      expect(returns[0]?.func).toBe('createRepo');
      expect(returns[0]?.returned).toBe('Repository');
    });

    it('should extract return types from generic wrappers', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'User' }),
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'findAll',
                returnType: 'List<User>',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const returns = await client.query<{ returned: string }>(
        'MATCH (:Function)-[:RETURNS]->(c:Class) RETURN c.name as returned'
      );
      expect(returns).toHaveLength(1);
      expect(returns[0]?.returned).toBe('User');
    });

    it('should handle nullable return types', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({ name: 'User' }),
          createParsedClass({
            name: 'UserService',
            functions: [
              createParsedFunction({
                name: 'findById',
                returnType: 'User?',
              }),
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const returns = await client.query<{ returned: string }>(
        'MATCH (:Function)-[:RETURNS]->(c:Class) RETURN c.name as returned'
      );
      expect(returns).toHaveLength(1);
      expect(returns[0]?.returned).toBe('User');
    });
  });

  describe('writeFiles - Secondary constructors', () => {
    it('should create Constructor node for secondary constructor', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            secondaryConstructors: [
              {
                parameters: [{ name: 'name', type: 'String', annotations: [] }],
                visibility: 'public',
                annotations: [],
                location: defaultLocation,
              },
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const constructors = await client.query<{ fqn: string; declaringClass: string; paramCount: number }>(
        'MATCH (c:Constructor) RETURN c.fqn as fqn, c.declaringClass as declaringClass, c.parameterCount as paramCount'
      );
      expect(constructors).toHaveLength(1);
      expect(constructors[0]?.fqn).toBe('com.example.User.<init>');
      expect(constructors[0]?.declaringClass).toBe('com.example.User');
      expect(constructors[0]?.paramCount).toBe(1);
    });

    it('should create DECLARES relationship from class to constructor', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            secondaryConstructors: [
              {
                parameters: [],
                visibility: 'public',
                annotations: [],
                location: defaultLocation,
              },
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const declares = await client.query<{ className: string; ctorFqn: string }>(
        'MATCH (cls:Class)-[:DECLARES]->(c:Constructor) RETURN cls.name as className, c.fqn as ctorFqn'
      );
      expect(declares).toHaveLength(1);
      expect(declares[0]?.className).toBe('User');
    });

    it('should create multiple secondary constructors with unique FQNs', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            secondaryConstructors: [
              {
                parameters: [{ name: 'name', type: 'String', annotations: [] }],
                visibility: 'public',
                annotations: [],
                location: defaultLocation,
              },
              {
                parameters: [
                  { name: 'name', type: 'String', annotations: [] },
                  { name: 'age', type: 'Int', annotations: [] },
                ],
                visibility: 'public',
                annotations: [],
                location: { ...defaultLocation, startLine: 10 },
              },
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const constructors = await client.query<{ fqn: string; paramCount: number }>(
        'MATCH (c:Constructor) RETURN c.fqn as fqn, c.parameterCount as paramCount ORDER BY c.fqn'
      );
      expect(constructors).toHaveLength(2);
      expect(constructors[0]?.fqn).toBe('com.example.User.<init>');
      expect(constructors[0]?.paramCount).toBe(1);
      expect(constructors[1]?.fqn).toBe('com.example.User.<init>1');
      expect(constructors[1]?.paramCount).toBe(2);
    });

    it('should store delegatesTo property', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            secondaryConstructors: [
              {
                parameters: [{ name: 'name', type: 'String', annotations: [] }],
                visibility: 'public',
                delegatesTo: 'this',
                annotations: [],
                location: defaultLocation,
              },
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const constructors = await client.query<{ delegatesTo: string }>(
        'MATCH (c:Constructor) RETURN c.delegatesTo as delegatesTo'
      );
      expect(constructors).toHaveLength(1);
      expect(constructors[0]?.delegatesTo).toBe('this');
    });

    it('should create parameters for constructor', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        classes: [
          createParsedClass({
            name: 'User',
            secondaryConstructors: [
              {
                parameters: [
                  { name: 'name', type: 'String', annotations: [] },
                  { name: 'age', type: 'Int', defaultValue: '0', annotations: [] },
                ],
                visibility: 'public',
                annotations: [],
                location: defaultLocation,
              },
            ],
          }),
        ],
      });

      await writer.writeFiles([file]);

      const params = await client.query<{ name: string; type: string; position: number; hasDefault: boolean }>(
        `MATCH (c:Constructor)-[r:HAS_PARAMETER]->(p:Parameter)
         RETURN p.name as name, p.type as type, r.position as position, p.hasDefault as hasDefault
         ORDER BY r.position`
      );
      expect(params).toHaveLength(2);
      expect(params[0]?.name).toBe('name');
      expect(params[0]?.position).toBe(0);
      expect(params[0]?.hasDefault).toBe(false);
      expect(params[1]?.name).toBe('age');
      expect(params[1]?.position).toBe(1);
      expect(params[1]?.hasDefault).toBe(true);
    });
  });

  describe('writeFiles - Destructuring declarations', () => {
    it('should create Property nodes for destructuring components', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['first', 'second'],
            visibility: 'public',
            isVal: true,
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const props = await client.query<{ name: string; isDestructured: boolean; destructuringIndex: number }>(
        'MATCH (p:Property {isDestructured: true}) RETURN p.name as name, p.isDestructured as isDestructured, p.destructuringIndex as destructuringIndex ORDER BY p.destructuringIndex'
      );
      expect(props).toHaveLength(2);
      expect(props[0]?.name).toBe('first');
      expect(props[0]?.destructuringIndex).toBe(0);
      expect(props[1]?.name).toBe('second');
      expect(props[1]?.destructuringIndex).toBe(1);
    });

    it('should store component types when available', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['name', 'age'],
            componentTypes: ['String', 'Int'],
            visibility: 'public',
            isVal: true,
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const props = await client.query<{ name: string; type: string }>(
        'MATCH (p:Property {isDestructured: true}) RETURN p.name as name, p.type as type ORDER BY p.destructuringIndex'
      );
      expect(props).toHaveLength(2);
      expect(props[0]?.type).toBe('String');
      expect(props[1]?.type).toBe('Int');
    });

    it('should mark destructured properties as var when isVal is false', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['x', 'y'],
            visibility: 'private',
            isVal: false,
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const props = await client.query<{ isMutable: boolean; visibility: string }>(
        'MATCH (p:Property {isDestructured: true}) RETURN p.isMutable as isMutable, p.visibility as visibility LIMIT 1'
      );
      expect(props).toHaveLength(1);
      expect(props[0]?.isMutable).toBe(true);
      expect(props[0]?.visibility).toBe('private');
    });

    it('should create CONTAINS relationship from package', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['a', 'b'],
            visibility: 'public',
            isVal: true,
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const contains = await client.query<{ pkg: string; prop: string }>(
        'MATCH (pkg:Package)-[:CONTAINS]->(p:Property {isDestructured: true}) RETURN pkg.name as pkg, p.name as prop ORDER BY p.name'
      );
      expect(contains).toHaveLength(2);
      expect(contains[0]?.pkg).toBe('com.example');
    });

    it('should store initializer expression', async () => {
      const file = createResolvedFile({
        packageName: 'com.example',
        destructuringDeclarations: [
          {
            componentNames: ['key', 'value'],
            initializer: 'Pair("hello", 42)',
            visibility: 'public',
            isVal: true,
            location: defaultLocation,
          },
        ],
      });

      await writer.writeFiles([file]);

      const props = await client.query<{ initializer: string }>(
        'MATCH (p:Property {isDestructured: true}) RETURN p.initializer as initializer LIMIT 1'
      );
      expect(props).toHaveLength(1);
      expect(props[0]?.initializer).toBe('Pair("hello", 42)');
    });
  });
});
