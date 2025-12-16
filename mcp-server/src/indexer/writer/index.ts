/**
 * Neo4j Graph Writer
 *
 * Writes resolved Kotlin code structures to Neo4j graph database.
 * Uses batch processing for performance and transactions for consistency.
 *
 * Node types: Package, Class, Interface, Object, Function, Property, Parameter, Annotation, TypeAlias, Constructor
 * Relationship types: CONTAINS, DECLARES, EXTENDS, IMPLEMENTS, CALLS, USES, RETURNS, HAS_PARAMETER, ANNOTATED_WITH
 */

import neo4j from 'neo4j-driver';
import type { Neo4jClient } from '../../neo4j/neo4j.js';
import type {
  ResolvedFile,
  ParsedClass,
  ParsedFunction,
  ParsedProperty,
  ParsedParameter,
  ParsedAnnotation,
  ParsedTypeParameter,
  ParsedTypeAlias,
  ParsedConstructor,
  ParsedDestructuringDeclaration,
} from '../types.js';
import type { WriteResult, WriterOptions, ClearResult, NodeRelResult } from './types.js';

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Build a fully qualified name from package and parts.
 */
export function buildFqn(packageName: string | undefined, ...parts: string[]): string {
  const allParts = packageName ? [packageName, ...parts] : parts;
  return allParts.filter(Boolean).join('.');
}

/**
 * Extract simple type names from a type string.
 * Handles generics, nullability, and nested types.
 * e.g., "List<User>" -> ["List", "User"], "Map<String, User?>" -> ["Map", "String", "User"]
 */
export function extractTypeNames(typeStr: string | undefined): string[] {
  if (!typeStr) return [];

  const types: string[] = [];
  // Remove nullable markers and extract type names
  const cleaned = typeStr.replace(/\?/g, '');

  // Match type identifiers (capitalized words that are likely type names)
  // This regex matches PascalCase identifiers
  const typePattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;
  let match;
  while ((match = typePattern.exec(cleaned)) !== null) {
    const typeName = match[1]!;
    // Skip common primitive/built-in types that don't need USES relationships
    const builtinTypes = [
      'Unit',
      'Nothing',
      'Any',
      'Boolean',
      'Byte',
      'Short',
      'Int',
      'Long',
      'Float',
      'Double',
      'Char',
      'String',
      'Array',
      'List',
      'Set',
      'Map',
      'Collection',
      'Iterable',
      'Sequence',
      'Pair',
      'Triple',
      'Result',
      'Comparable',
      'Number',
      'Enum',
      'Object',
      'Throwable',
      'Exception',
      'Error',
      'RuntimeException',
    ];
    if (!builtinTypes.includes(typeName)) {
      types.push(typeName);
    }
  }

  return [...new Set(types)]; // Remove duplicates
}

/**
 * Serialize type parameters for storage in Neo4j.
 */
export function serializeTypeParameters(typeParams?: ParsedTypeParameter[]): string[] | null {
  if (!typeParams || typeParams.length === 0) return null;
  return typeParams.map((tp) => {
    let result = tp.name;
    if (tp.variance) result = `${tp.variance} ${result}`;
    if (tp.isReified) result = `reified ${result}`;
    if (tp.bounds && tp.bounds.length > 0) {
      result += ` : ${tp.bounds.join(' & ')}`;
    }
    return result;
  });
}

// =============================================================================
// Neo4jWriter Class
// =============================================================================

export class Neo4jWriter {
  private client: Neo4jClient;
  private batchSize: number;

  constructor(client: Neo4jClient, options: WriterOptions = {}) {
    this.client = client;
    this.batchSize = options.batchSize ?? 100;
  }

  /**
   * Create necessary constraints and indexes for optimal performance.
   * Should be called once before writing data.
   */
  async ensureConstraintsAndIndexes(): Promise<void> {
    const constraints = [
      // Uniqueness constraints (FQN-based for most types)
      'CREATE CONSTRAINT class_fqn_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.fqn IS UNIQUE',
      'CREATE CONSTRAINT interface_fqn_unique IF NOT EXISTS FOR (i:Interface) REQUIRE i.fqn IS UNIQUE',
      'CREATE CONSTRAINT object_fqn_unique IF NOT EXISTS FOR (o:Object) REQUIRE o.fqn IS UNIQUE',
      'CREATE CONSTRAINT function_fqn_unique IF NOT EXISTS FOR (f:Function) REQUIRE f.fqn IS UNIQUE',
      'CREATE CONSTRAINT property_fqn_unique IF NOT EXISTS FOR (p:Property) REQUIRE p.fqn IS UNIQUE',
      'CREATE CONSTRAINT package_name_unique IF NOT EXISTS FOR (p:Package) REQUIRE p.name IS UNIQUE',
      'CREATE CONSTRAINT typealias_fqn_unique IF NOT EXISTS FOR (t:TypeAlias) REQUIRE t.fqn IS UNIQUE',
      'CREATE CONSTRAINT constructor_fqn_unique IF NOT EXISTS FOR (c:Constructor) REQUIRE c.fqn IS UNIQUE',
      // Annotation uniqueness by name (annotations are shared across elements)
      'CREATE CONSTRAINT annotation_name_unique IF NOT EXISTS FOR (a:Annotation) REQUIRE a.name IS UNIQUE',
    ];

    const indexes = [
      // Name indexes for fast lookups
      'CREATE INDEX class_name_index IF NOT EXISTS FOR (c:Class) ON (c.name)',
      'CREATE INDEX interface_name_index IF NOT EXISTS FOR (i:Interface) ON (i.name)',
      'CREATE INDEX object_name_index IF NOT EXISTS FOR (o:Object) ON (o.name)',
      'CREATE INDEX function_name_index IF NOT EXISTS FOR (f:Function) ON (f.name)',
      'CREATE INDEX property_name_index IF NOT EXISTS FOR (p:Property) ON (p.name)',
      'CREATE INDEX constructor_declaring_index IF NOT EXISTS FOR (c:Constructor) ON (c.declaringClass)',
      // File path indexes for file-based queries
      'CREATE INDEX class_file_index IF NOT EXISTS FOR (c:Class) ON (c.filePath)',
      'CREATE INDEX interface_file_index IF NOT EXISTS FOR (i:Interface) ON (i.filePath)',
      'CREATE INDEX function_file_index IF NOT EXISTS FOR (f:Function) ON (f.filePath)',
      // Visibility indexes
      'CREATE INDEX class_visibility_index IF NOT EXISTS FOR (c:Class) ON (c.visibility)',
      'CREATE INDEX function_visibility_index IF NOT EXISTS FOR (f:Function) ON (f.visibility)',
    ];

    // Execute constraints first
    for (const constraint of constraints) {
      await this.client.write(constraint);
    }

    // Then create indexes
    for (const index of indexes) {
      await this.client.write(index);
    }
  }

  /**
   * Clear all code graph data from the database.
   * Useful before a full re-index.
   */
  async clearGraph(): Promise<ClearResult> {
    const deleteQuery = `
      MATCH (n)
      WHERE n:Package OR n:Class OR n:Interface OR n:Object
         OR n:Function OR n:Property OR n:Parameter OR n:Annotation OR n:TypeAlias
         OR n:Constructor
      DETACH DELETE n
    `;

    const result = await this.client.execute(deleteQuery, {}, neo4j.routing.WRITE);

    return {
      nodesDeleted: result.summary.counters.nodesDeleted || 0,
      relationshipsDeleted: result.summary.counters.relationshipsDeleted || 0,
    };
  }

  /**
   * Write multiple resolved files to Neo4j.
   * Main entry point for the indexer.
   */
  async writeFiles(files: ResolvedFile[], options: WriterOptions = {}): Promise<WriteResult> {
    const result: WriteResult = {
      nodesCreated: 0,
      relationshipsCreated: 0,
      filesProcessed: 0,
      errors: [],
    };

    if (options.ensureSchema !== false) {
      await this.ensureConstraintsAndIndexes();
    }

    if (options.clearBefore) {
      await this.clearGraph();
    }

    // Collect all packages first
    const packages = new Set<string>();
    for (const file of files) {
      if (file.packageName) {
        packages.add(file.packageName);
      }
    }

    // Create all packages
    const packageResult = await this.writePackages(Array.from(packages));
    result.nodesCreated += packageResult;

    // Process each file
    for (const file of files) {
      try {
        const fileResult = await this.writeFile(file);
        result.nodesCreated += fileResult.nodesCreated;
        result.relationshipsCreated += fileResult.relationshipsCreated;
        result.filesProcessed++;
      } catch (error) {
        result.errors.push({
          filePath: file.filePath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Write cross-file relationships (CALLS)
    const callsResult = await this.writeResolvedCalls(files);
    result.relationshipsCreated += callsResult;

    // Write USES relationships (Function -> types used in parameters)
    const usesResult = await this.writeUsesRelationships(files);
    result.relationshipsCreated += usesResult;

    // Write RETURNS relationships (Function -> return type)
    const returnsResult = await this.writeReturnsRelationships(files);
    result.relationshipsCreated += returnsResult;

    return result;
  }

  /**
   * Write a single resolved file to Neo4j.
   */
  private async writeFile(file: ResolvedFile): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    // Write classes (includes interfaces, objects, enums, annotations)
    for (const cls of file.classes) {
      const classResult = await this.writeClass(cls, file.packageName, file.filePath);
      nodesCreated += classResult.nodesCreated;
      relationshipsCreated += classResult.relationshipsCreated;
    }

    // Write top-level functions
    for (const func of file.topLevelFunctions) {
      const funcResult = await this.writeTopLevelFunction(func, file.packageName, file.filePath);
      nodesCreated += funcResult.nodesCreated;
      relationshipsCreated += funcResult.relationshipsCreated;
    }

    // Write top-level properties
    for (const prop of file.topLevelProperties) {
      const propResult = await this.writeTopLevelProperty(prop, file.packageName, file.filePath);
      nodesCreated += propResult.nodesCreated;
      relationshipsCreated += propResult.relationshipsCreated;
    }

    // Write type aliases
    for (const typeAlias of file.typeAliases) {
      const aliasResult = await this.writeTypeAlias(typeAlias, file.packageName, file.filePath);
      nodesCreated += aliasResult.nodesCreated;
      relationshipsCreated += aliasResult.relationshipsCreated;
    }

    // Write destructuring declarations as properties
    for (const destructuring of file.destructuringDeclarations) {
      const destructResult = await this.writeDestructuringDeclaration(
        destructuring,
        file.packageName,
        file.filePath
      );
      nodesCreated += destructResult.nodesCreated;
      relationshipsCreated += destructResult.relationshipsCreated;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write packages to Neo4j.
   */
  private async writePackages(packages: string[]): Promise<number> {
    if (packages.length === 0) return 0;

    const query = `
      UNWIND $packages AS pkg
      MERGE (p:Package {name: pkg})
      RETURN count(p) AS created
    `;

    await this.client.write(query, { packages });
    return packages.length;
  }

  /**
   * Write a class/interface/object/enum to Neo4j with all its members.
   */
  private async writeClass(
    cls: ParsedClass,
    packageName: string | undefined,
    filePath: string,
    parentFqn?: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const fqn = parentFqn ? `${parentFqn}.${cls.name}` : buildFqn(packageName, cls.name);

    // Determine the correct Neo4j label based on kind
    const label = this.getClassLabel(cls.kind);

    // Build properties object
    const props: Record<string, unknown> = {
      fqn,
      name: cls.name,
      visibility: cls.visibility,
      filePath,
      lineNumber: cls.location.startLine,
    };

    // Add kind-specific properties
    if (cls.kind === 'class') {
      props.isAbstract = cls.isAbstract;
      props.isData = cls.isData;
      props.isSealed = cls.isSealed;
      if (cls.superClass) props.superClass = cls.superClass;
      if (cls.interfaces.length > 0) props.interfaces = cls.interfaces;
    } else if (cls.kind === 'interface') {
      props.isSealed = cls.isSealed;
      if (cls.interfaces.length > 0) props.interfaces = cls.interfaces;
    } else if (cls.kind === 'object') {
      props.isCompanion = false;
    } else if (cls.kind === 'enum') {
      props.isEnum = true;
    } else if (cls.kind === 'annotation') {
      props.isAnnotationClass = true;
    }

    // Add type parameters if present
    const typeParams = serializeTypeParameters(cls.typeParameters);
    if (typeParams) props.typeParameters = typeParams;

    // Create the node with appropriate label
    const createNodeQuery = `
      MERGE (n:${label} {fqn: $fqn})
      SET n += $props
      RETURN n
    `;
    await this.client.write(createNodeQuery, { fqn, props });
    nodesCreated++;

    // Create CONTAINS relationship from package
    if (packageName && !parentFqn) {
      const containsQuery = `
        MATCH (pkg:Package {name: $packageName})
        MATCH (n:${label} {fqn: $fqn})
        MERGE (pkg)-[:CONTAINS]->(n)
      `;
      await this.client.write(containsQuery, { packageName, fqn });
      relationshipsCreated++;
    }

    // Write annotations
    const annotationResult = await this.writeAnnotations(cls.annotations, fqn, label);
    nodesCreated += annotationResult.nodesCreated;
    relationshipsCreated += annotationResult.relationshipsCreated;

    // Write EXTENDS relationship
    if (cls.superClass) {
      const extendsResult = await this.writeExtendsRelationship(fqn, cls.superClass, label);
      relationshipsCreated += extendsResult;
    }

    // Write IMPLEMENTS relationships
    for (const iface of cls.interfaces) {
      const implementsResult = await this.writeImplementsRelationship(fqn, iface, label);
      relationshipsCreated += implementsResult;
    }

    // Write properties
    for (const prop of cls.properties) {
      const propResult = await this.writeProperty(prop, fqn, filePath);
      nodesCreated += propResult.nodesCreated;
      relationshipsCreated += propResult.relationshipsCreated;
    }

    // Write functions
    for (const func of cls.functions) {
      const funcResult = await this.writeFunction(func, fqn, filePath);
      nodesCreated += funcResult.nodesCreated;
      relationshipsCreated += funcResult.relationshipsCreated;
    }

    // Write nested classes
    for (const nested of cls.nestedClasses) {
      const nestedResult = await this.writeClass(nested, packageName, filePath, fqn);
      nodesCreated += nestedResult.nodesCreated;
      relationshipsCreated += nestedResult.relationshipsCreated;
    }

    // Write companion object if present
    if (cls.companionObject) {
      const companionResult = await this.writeCompanionObject(cls.companionObject, fqn, filePath);
      nodesCreated += companionResult.nodesCreated;
      relationshipsCreated += companionResult.relationshipsCreated;
    }

    // Write secondary constructors
    if (cls.secondaryConstructors && cls.secondaryConstructors.length > 0) {
      for (let i = 0; i < cls.secondaryConstructors.length; i++) {
        const ctor = cls.secondaryConstructors[i]!;
        const ctorResult = await this.writeSecondaryConstructor(ctor, fqn, filePath, i);
        nodesCreated += ctorResult.nodesCreated;
        relationshipsCreated += ctorResult.relationshipsCreated;
      }
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Get the Neo4j label for a class kind.
   */
  private getClassLabel(kind: ParsedClass['kind']): string {
    switch (kind) {
      case 'interface':
        return 'Interface';
      case 'object':
        return 'Object';
      case 'enum':
        return 'Class'; // Enums are stored as Class with isEnum property
      case 'annotation':
        return 'Class'; // Annotations are stored as Class with isAnnotationClass property
      default:
        return 'Class';
    }
  }

  /**
   * Write a companion object.
   */
  private async writeCompanionObject(
    companion: ParsedClass,
    parentFqn: string,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const companionName = companion.name || 'Companion';
    const fqn = `${parentFqn}.${companionName}`;

    const props: Record<string, unknown> = {
      fqn,
      name: companionName,
      visibility: companion.visibility,
      isCompanion: true,
      parentClass: parentFqn,
      filePath,
      lineNumber: companion.location.startLine,
    };

    // Create the companion object node
    const createQuery = `
      MERGE (o:Object {fqn: $fqn})
      SET o += $props
      RETURN o
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create DECLARES relationship from parent
    const declaresQuery = `
      MATCH (parent {fqn: $parentFqn})
      MATCH (o:Object {fqn: $fqn})
      MERGE (parent)-[:DECLARES]->(o)
    `;
    await this.client.write(declaresQuery, { parentFqn, fqn });
    relationshipsCreated++;

    // Write companion's properties
    for (const prop of companion.properties) {
      const propResult = await this.writeProperty(prop, fqn, filePath);
      nodesCreated += propResult.nodesCreated;
      relationshipsCreated += propResult.relationshipsCreated;
    }

    // Write companion's functions
    for (const func of companion.functions) {
      const funcResult = await this.writeFunction(func, fqn, filePath);
      nodesCreated += funcResult.nodesCreated;
      relationshipsCreated += funcResult.relationshipsCreated;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a function to Neo4j.
   */
  private async writeFunction(
    func: ParsedFunction,
    declaringTypeFqn: string,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const fqn = `${declaringTypeFqn}.${func.name}`;

    const props: Record<string, unknown> = {
      fqn,
      name: func.name,
      visibility: func.visibility,
      isAbstract: func.isAbstract,
      isSuspend: func.isSuspend,
      isExtension: func.isExtension,
      isInline: func.isInline ?? false,
      isInfix: func.isInfix ?? false,
      isOperator: func.isOperator ?? false,
      declaringType: declaringTypeFqn,
      filePath,
      lineNumber: func.location.startLine,
    };

    if (func.returnType) props.returnType = func.returnType;
    if (func.receiverType) props.receiverType = func.receiverType;

    const typeParams = serializeTypeParameters(func.typeParameters);
    if (typeParams) props.typeParameters = typeParams;

    // Create function node
    const createQuery = `
      MERGE (f:Function {fqn: $fqn})
      SET f += $props
      RETURN f
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create DECLARES relationship
    const declaresQuery = `
      MATCH (parent {fqn: $declaringTypeFqn})
      MATCH (f:Function {fqn: $fqn})
      MERGE (parent)-[:DECLARES]->(f)
    `;
    await this.client.write(declaresQuery, { declaringTypeFqn, fqn });
    relationshipsCreated++;

    // Write annotations
    const annotationResult = await this.writeAnnotations(func.annotations, fqn, 'Function');
    nodesCreated += annotationResult.nodesCreated;
    relationshipsCreated += annotationResult.relationshipsCreated;

    // Write parameters
    for (const [i, param] of func.parameters.entries()) {
      const paramResult = await this.writeParameter(param, fqn, i);
      nodesCreated += paramResult.nodesCreated;
      relationshipsCreated += paramResult.relationshipsCreated;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a top-level function to Neo4j.
   */
  private async writeTopLevelFunction(
    func: ParsedFunction,
    packageName: string | undefined,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const fqn = buildFqn(packageName, func.name);

    const props: Record<string, unknown> = {
      fqn,
      name: func.name,
      visibility: func.visibility,
      isAbstract: func.isAbstract,
      isSuspend: func.isSuspend,
      isExtension: func.isExtension,
      isInline: func.isInline ?? false,
      isInfix: func.isInfix ?? false,
      isOperator: func.isOperator ?? false,
      isTopLevel: true,
      filePath,
      lineNumber: func.location.startLine,
    };

    if (func.returnType) props.returnType = func.returnType;
    if (func.receiverType) props.receiverType = func.receiverType;

    const typeParams = serializeTypeParameters(func.typeParameters);
    if (typeParams) props.typeParameters = typeParams;

    // Create function node
    const createQuery = `
      MERGE (f:Function {fqn: $fqn})
      SET f += $props
      RETURN f
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create CONTAINS relationship from package
    if (packageName) {
      const containsQuery = `
        MATCH (pkg:Package {name: $packageName})
        MATCH (f:Function {fqn: $fqn})
        MERGE (pkg)-[:CONTAINS]->(f)
      `;
      await this.client.write(containsQuery, { packageName, fqn });
      relationshipsCreated++;
    }

    // Write annotations
    const annotationResult = await this.writeAnnotations(func.annotations, fqn, 'Function');
    nodesCreated += annotationResult.nodesCreated;
    relationshipsCreated += annotationResult.relationshipsCreated;

    // Write parameters
    for (const [i, param] of func.parameters.entries()) {
      const paramResult = await this.writeParameter(param, fqn, i);
      nodesCreated += paramResult.nodesCreated;
      relationshipsCreated += paramResult.relationshipsCreated;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a property to Neo4j.
   */
  private async writeProperty(
    prop: ParsedProperty,
    declaringTypeFqn: string,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const fqn = `${declaringTypeFqn}.${prop.name}`;

    const props: Record<string, unknown> = {
      fqn,
      name: prop.name,
      visibility: prop.visibility,
      isMutable: !prop.isVal,
      declaringType: declaringTypeFqn,
      filePath,
      lineNumber: prop.location.startLine,
    };

    if (prop.type) props.type = prop.type;
    if (prop.initializer) props.initializer = prop.initializer;

    // Create property node
    const createQuery = `
      MERGE (p:Property {fqn: $fqn})
      SET p += $props
      RETURN p
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create DECLARES relationship
    const declaresQuery = `
      MATCH (parent {fqn: $declaringTypeFqn})
      MATCH (p:Property {fqn: $fqn})
      MERGE (parent)-[:DECLARES]->(p)
    `;
    await this.client.write(declaresQuery, { declaringTypeFqn, fqn });
    relationshipsCreated++;

    // Write annotations
    const annotationResult = await this.writeAnnotations(prop.annotations, fqn, 'Property');
    nodesCreated += annotationResult.nodesCreated;
    relationshipsCreated += annotationResult.relationshipsCreated;

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a top-level property to Neo4j.
   */
  private async writeTopLevelProperty(
    prop: ParsedProperty,
    packageName: string | undefined,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const fqn = buildFqn(packageName, prop.name);

    const props: Record<string, unknown> = {
      fqn,
      name: prop.name,
      visibility: prop.visibility,
      isMutable: !prop.isVal,
      isTopLevel: true,
      filePath,
      lineNumber: prop.location.startLine,
    };

    if (prop.type) props.type = prop.type;
    if (prop.initializer) props.initializer = prop.initializer;

    // Create property node
    const createQuery = `
      MERGE (p:Property {fqn: $fqn})
      SET p += $props
      RETURN p
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create CONTAINS relationship from package
    if (packageName) {
      const containsQuery = `
        MATCH (pkg:Package {name: $packageName})
        MATCH (p:Property {fqn: $fqn})
        MERGE (pkg)-[:CONTAINS]->(p)
      `;
      await this.client.write(containsQuery, { packageName, fqn });
      relationshipsCreated++;
    }

    // Write annotations
    const annotationResult = await this.writeAnnotations(prop.annotations, fqn, 'Property');
    nodesCreated += annotationResult.nodesCreated;
    relationshipsCreated += annotationResult.relationshipsCreated;

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a parameter to Neo4j.
   */
  private async writeParameter(
    param: ParsedParameter,
    functionFqn: string,
    position: number
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const props: Record<string, unknown> = {
      name: param.name,
      hasDefault: !!param.defaultValue,
    };

    if (param.type) props.type = param.type;
    if (param.isCrossinline) props.isCrossinline = true;
    if (param.isNoinline) props.isNoinline = true;

    // Store function type info if present
    if (param.functionType) {
      props.functionType = JSON.stringify(param.functionType);
    }

    // Create parameter node with unique identity based on function + position
    const createQuery = `
      MATCH (f:Function {fqn: $functionFqn})
      MERGE (f)-[rel:HAS_PARAMETER {position: $position}]->(p:Parameter {name: $name})
      SET p += $props
      RETURN p
    `;
    await this.client.write(createQuery, { functionFqn, position, name: param.name, props });
    nodesCreated++;
    relationshipsCreated++;

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a type alias to Neo4j.
   */
  private async writeTypeAlias(
    typeAlias: ParsedTypeAlias,
    packageName: string | undefined,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const fqn = buildFqn(packageName, typeAlias.name);

    const props: Record<string, unknown> = {
      fqn,
      name: typeAlias.name,
      aliasedType: typeAlias.aliasedType,
      visibility: typeAlias.visibility,
      filePath,
      lineNumber: typeAlias.location.startLine,
    };

    const typeParams = serializeTypeParameters(typeAlias.typeParameters);
    if (typeParams) props.typeParameters = typeParams;

    // Create type alias node
    const createQuery = `
      MERGE (t:TypeAlias {fqn: $fqn})
      SET t += $props
      RETURN t
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create CONTAINS relationship from package
    if (packageName) {
      const containsQuery = `
        MATCH (pkg:Package {name: $packageName})
        MATCH (t:TypeAlias {fqn: $fqn})
        MERGE (pkg)-[:CONTAINS]->(t)
      `;
      await this.client.write(containsQuery, { packageName, fqn });
      relationshipsCreated++;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write annotations to Neo4j.
   */
  private async writeAnnotations(
    annotations: ParsedAnnotation[],
    targetFqn: string,
    targetLabel: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    for (const annotation of annotations) {
      // Create annotation node (MERGE since annotations are shared)
      const annotationName = annotation.name.startsWith('@') ? annotation.name : `@${annotation.name}`;

      const props: Record<string, unknown> = {
        name: annotationName,
      };

      if (annotation.arguments && Object.keys(annotation.arguments).length > 0) {
        props.arguments = JSON.stringify(annotation.arguments);
      }

      const createQuery = `
        MERGE (a:Annotation {name: $name})
        SET a.arguments = COALESCE($arguments, a.arguments)
        RETURN a
      `;
      await this.client.write(createQuery, {
        name: annotationName,
        arguments: props.arguments ?? null,
      });
      nodesCreated++;

      // Create ANNOTATED_WITH relationship
      const annotatedWithQuery = `
        MATCH (target:${targetLabel} {fqn: $targetFqn})
        MATCH (a:Annotation {name: $annotationName})
        MERGE (target)-[:ANNOTATED_WITH]->(a)
      `;
      await this.client.write(annotatedWithQuery, { targetFqn, annotationName });
      relationshipsCreated++;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write EXTENDS relationship.
   */
  private async writeExtendsRelationship(
    childFqn: string,
    parentName: string,
    childLabel: string
  ): Promise<number> {
    // Try to find the parent class by FQN or simple name
    const extendsQuery = `
      MATCH (child:${childLabel} {fqn: $childFqn})
      OPTIONAL MATCH (parentByFqn:Class {fqn: $parentName})
      OPTIONAL MATCH (parentByName:Class {name: $parentName})
      WITH child, COALESCE(parentByFqn, parentByName) AS parent
      WHERE parent IS NOT NULL
      MERGE (child)-[:EXTENDS]->(parent)
    `;
    await this.client.write(extendsQuery, { childFqn, parentName });
    return 1;
  }

  /**
   * Write IMPLEMENTS relationship.
   */
  private async writeImplementsRelationship(
    classFqn: string,
    interfaceName: string,
    classLabel: string
  ): Promise<number> {
    // Try to find the interface by FQN or simple name
    const implementsQuery = `
      MATCH (class:${classLabel} {fqn: $classFqn})
      OPTIONAL MATCH (ifaceByFqn:Interface {fqn: $interfaceName})
      OPTIONAL MATCH (ifaceByName:Interface {name: $interfaceName})
      WITH class, COALESCE(ifaceByFqn, ifaceByName) AS iface
      WHERE iface IS NOT NULL
      MERGE (class)-[:IMPLEMENTS]->(iface)
    `;
    await this.client.write(implementsQuery, { classFqn, interfaceName });
    return 1;
  }

  /**
   * Write all resolved CALLS relationships in batch.
   */
  private async writeResolvedCalls(files: ResolvedFile[]): Promise<number> {
    // Collect all resolved calls
    const allCalls: { fromFqn: string; toFqn: string }[] = [];

    for (const file of files) {
      for (const call of file.resolvedCalls) {
        allCalls.push({
          fromFqn: call.fromFqn,
          toFqn: call.toFqn,
        });
      }
    }

    if (allCalls.length === 0) return 0;

    // Process in batches
    let totalCreated = 0;

    for (let i = 0; i < allCalls.length; i += this.batchSize) {
      const batch = allCalls.slice(i, i + this.batchSize);

      const callsQuery = `
        UNWIND $calls AS call
        MATCH (caller:Function {fqn: call.fromFqn})
        MATCH (callee:Function {fqn: call.toFqn})
        MERGE (caller)-[r:CALLS]->(callee)
        ON CREATE SET r.count = 1
        ON MATCH SET r.count = r.count + 1
        RETURN count(r) AS created
      `;

      const result = await this.client.write<{ created: number }>(callsQuery, { calls: batch });
      const firstResult = result[0];
      if (firstResult?.created) {
        totalCreated += firstResult.created;
      }
    }

    return totalCreated;
  }

  /**
   * Write USES relationships for functions to types they use in parameters.
   * Collects all parameter types from functions and creates USES relationships.
   */
  private async writeUsesRelationships(files: ResolvedFile[]): Promise<number> {
    const usesData: { functionFqn: string; typeName: string; context: string }[] = [];

    // Helper to collect uses from a function
    const collectFunctionUses = (func: ParsedFunction, functionFqn: string) => {
      // Collect from parameter types
      for (const param of func.parameters) {
        const types = extractTypeNames(param.type);
        for (const typeName of types) {
          usesData.push({ functionFqn, typeName, context: 'parameter' });
        }
        // Also check function types (lambdas)
        if (param.functionType) {
          for (const paramType of param.functionType.parameterTypes) {
            const types = extractTypeNames(paramType);
            for (const typeName of types) {
              usesData.push({ functionFqn, typeName, context: 'parameter' });
            }
          }
          const returnTypes = extractTypeNames(param.functionType.returnType);
          for (const typeName of returnTypes) {
            usesData.push({ functionFqn, typeName, context: 'parameter' });
          }
          if (param.functionType.receiverType) {
            const receiverTypes = extractTypeNames(param.functionType.receiverType);
            for (const typeName of receiverTypes) {
              usesData.push({ functionFqn, typeName, context: 'parameter' });
            }
          }
        }
      }

      // Collect from receiver type (extension functions)
      if (func.receiverType) {
        const types = extractTypeNames(func.receiverType);
        for (const typeName of types) {
          usesData.push({ functionFqn, typeName, context: 'receiver' });
        }
      }
    };

    // Helper to process class functions
    const processClass = (cls: ParsedClass, packageName: string | undefined, parentFqn?: string) => {
      const classFqn = parentFqn ? `${parentFqn}.${cls.name}` : buildFqn(packageName, cls.name);

      for (const func of cls.functions) {
        const functionFqn = `${classFqn}.${func.name}`;
        collectFunctionUses(func, functionFqn);
      }

      // Process nested classes
      for (const nested of cls.nestedClasses) {
        processClass(nested, packageName, classFqn);
      }

      // Process companion object
      if (cls.companionObject) {
        const companionFqn = `${classFqn}.${cls.companionObject.name || 'Companion'}`;
        for (const func of cls.companionObject.functions) {
          const functionFqn = `${companionFqn}.${func.name}`;
          collectFunctionUses(func, functionFqn);
        }
      }
    };

    // Collect all USES data from files
    for (const file of files) {
      // Process classes
      for (const cls of file.classes) {
        processClass(cls, file.packageName);
      }

      // Process top-level functions
      for (const func of file.topLevelFunctions) {
        const functionFqn = buildFqn(file.packageName, func.name);
        collectFunctionUses(func, functionFqn);
      }
    }

    if (usesData.length === 0) return 0;

    // Deduplicate
    const uniqueUses = new Map<string, { functionFqn: string; typeName: string; context: string }>();
    for (const use of usesData) {
      const key = `${use.functionFqn}:${use.typeName}`;
      if (!uniqueUses.has(key)) {
        uniqueUses.set(key, use);
      }
    }

    // Process in batches
    let totalCreated = 0;
    const uniqueUsesArray = Array.from(uniqueUses.values());

    for (let i = 0; i < uniqueUsesArray.length; i += this.batchSize) {
      const batch = uniqueUsesArray.slice(i, i + this.batchSize);

      const usesQuery = `
        UNWIND $uses AS use
        MATCH (f:Function {fqn: use.functionFqn})
        OPTIONAL MATCH (cByName:Class {name: use.typeName})
        OPTIONAL MATCH (iByName:Interface {name: use.typeName})
        WITH f, use, COALESCE(cByName, iByName) AS target
        WHERE target IS NOT NULL
        MERGE (f)-[r:USES]->(target)
        ON CREATE SET r.context = use.context
        RETURN count(r) AS created
      `;

      const result = await this.client.write<{ created: number }>(usesQuery, { uses: batch });
      const firstResult = result[0];
      if (firstResult?.created) {
        totalCreated += firstResult.created;
      }
    }

    return totalCreated;
  }

  /**
   * Write RETURNS relationships for functions to their return types.
   */
  private async writeReturnsRelationships(files: ResolvedFile[]): Promise<number> {
    const returnsData: { functionFqn: string; typeName: string }[] = [];

    // Helper to collect return type from a function
    const collectFunctionReturns = (func: ParsedFunction, functionFqn: string) => {
      if (func.returnType) {
        const types = extractTypeNames(func.returnType);
        for (const typeName of types) {
          returnsData.push({ functionFqn, typeName });
        }
      }
    };

    // Helper to process class functions
    const processClass = (cls: ParsedClass, packageName: string | undefined, parentFqn?: string) => {
      const classFqn = parentFqn ? `${parentFqn}.${cls.name}` : buildFqn(packageName, cls.name);

      for (const func of cls.functions) {
        const functionFqn = `${classFqn}.${func.name}`;
        collectFunctionReturns(func, functionFqn);
      }

      // Process nested classes
      for (const nested of cls.nestedClasses) {
        processClass(nested, packageName, classFqn);
      }

      // Process companion object
      if (cls.companionObject) {
        const companionFqn = `${classFqn}.${cls.companionObject.name || 'Companion'}`;
        for (const func of cls.companionObject.functions) {
          const functionFqn = `${companionFqn}.${func.name}`;
          collectFunctionReturns(func, functionFqn);
        }
      }
    };

    // Collect all RETURNS data from files
    for (const file of files) {
      // Process classes
      for (const cls of file.classes) {
        processClass(cls, file.packageName);
      }

      // Process top-level functions
      for (const func of file.topLevelFunctions) {
        const functionFqn = buildFqn(file.packageName, func.name);
        collectFunctionReturns(func, functionFqn);
      }
    }

    if (returnsData.length === 0) return 0;

    // Deduplicate
    const uniqueReturns = new Map<string, { functionFqn: string; typeName: string }>();
    for (const ret of returnsData) {
      const key = `${ret.functionFqn}:${ret.typeName}`;
      if (!uniqueReturns.has(key)) {
        uniqueReturns.set(key, ret);
      }
    }

    // Process in batches
    let totalCreated = 0;
    const uniqueReturnsArray = Array.from(uniqueReturns.values());

    for (let i = 0; i < uniqueReturnsArray.length; i += this.batchSize) {
      const batch = uniqueReturnsArray.slice(i, i + this.batchSize);

      const returnsQuery = `
        UNWIND $returns AS ret
        MATCH (f:Function {fqn: ret.functionFqn})
        OPTIONAL MATCH (cByName:Class {name: ret.typeName})
        OPTIONAL MATCH (iByName:Interface {name: ret.typeName})
        WITH f, COALESCE(cByName, iByName) AS target
        WHERE target IS NOT NULL
        MERGE (f)-[:RETURNS]->(target)
        RETURN count(*) AS created
      `;

      const result = await this.client.write<{ created: number }>(returnsQuery, { returns: batch });
      const firstResult = result[0];
      if (firstResult?.created) {
        totalCreated += firstResult.created;
      }
    }

    return totalCreated;
  }

  /**
   * Write a secondary constructor to Neo4j.
   */
  private async writeSecondaryConstructor(
    ctor: ParsedConstructor,
    declaringClassFqn: string,
    filePath: string,
    index: number
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    // Create a unique FQN for the constructor using index
    const fqn = `${declaringClassFqn}.<init>${index > 0 ? index : ''}`;

    const props: Record<string, unknown> = {
      fqn,
      visibility: ctor.visibility,
      declaringClass: declaringClassFqn,
      filePath,
      lineNumber: ctor.location.startLine,
      parameterCount: ctor.parameters.length,
    };

    if (ctor.delegatesTo) {
      props.delegatesTo = ctor.delegatesTo;
    }

    // Create constructor node
    const createQuery = `
      MERGE (c:Constructor {fqn: $fqn})
      SET c += $props
      RETURN c
    `;
    await this.client.write(createQuery, { fqn, props });
    nodesCreated++;

    // Create DECLARES relationship from class
    const declaresQuery = `
      MATCH (cls {fqn: $declaringClassFqn})
      MATCH (c:Constructor {fqn: $fqn})
      MERGE (cls)-[:DECLARES]->(c)
    `;
    await this.client.write(declaresQuery, { declaringClassFqn, fqn });
    relationshipsCreated++;

    // Write annotations
    const annotationResult = await this.writeAnnotations(ctor.annotations, fqn, 'Constructor');
    nodesCreated += annotationResult.nodesCreated;
    relationshipsCreated += annotationResult.relationshipsCreated;

    // Write parameters
    for (const [i, param] of ctor.parameters.entries()) {
      const paramResult = await this.writeConstructorParameter(param, fqn, i);
      nodesCreated += paramResult.nodesCreated;
      relationshipsCreated += paramResult.relationshipsCreated;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a constructor parameter to Neo4j.
   */
  private async writeConstructorParameter(
    param: ParsedParameter,
    constructorFqn: string,
    position: number
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    const props: Record<string, unknown> = {
      name: param.name,
      hasDefault: !!param.defaultValue,
    };

    if (param.type) props.type = param.type;

    // Create parameter node with unique identity based on constructor + position
    const createQuery = `
      MATCH (c:Constructor {fqn: $constructorFqn})
      MERGE (c)-[rel:HAS_PARAMETER {position: $position}]->(p:Parameter {name: $name})
      SET p += $props
      RETURN p
    `;
    await this.client.write(createQuery, { constructorFqn, position, name: param.name, props });
    nodesCreated++;
    relationshipsCreated++;

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Write a destructuring declaration as multiple properties.
   */
  private async writeDestructuringDeclaration(
    destructuring: ParsedDestructuringDeclaration,
    packageName: string | undefined,
    filePath: string
  ): Promise<NodeRelResult> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    // Create a Property node for each component
    for (let i = 0; i < destructuring.componentNames.length; i++) {
      const componentName = destructuring.componentNames[i]!;
      const componentType = destructuring.componentTypes?.[i];

      const fqn = buildFqn(packageName, componentName);

      const props: Record<string, unknown> = {
        fqn,
        name: componentName,
        visibility: destructuring.visibility,
        isMutable: !destructuring.isVal,
        isTopLevel: true,
        isDestructured: true,
        destructuringIndex: i,
        filePath,
        lineNumber: destructuring.location.startLine,
      };

      if (componentType) props.type = componentType;
      if (destructuring.initializer) props.initializer = destructuring.initializer;

      // Create property node
      const createQuery = `
        MERGE (p:Property {fqn: $fqn})
        SET p += $props
        RETURN p
      `;
      await this.client.write(createQuery, { fqn, props });
      nodesCreated++;

      // Create CONTAINS relationship from package
      if (packageName) {
        const containsQuery = `
          MATCH (pkg:Package {name: $packageName})
          MATCH (p:Property {fqn: $fqn})
          MERGE (pkg)-[:CONTAINS]->(p)
        `;
        await this.client.write(containsQuery, { packageName, fqn });
        relationshipsCreated++;
      }
    }

    return { nodesCreated, relationshipsCreated };
  }
}

// Re-export types
export type { WriteResult, WriteError, WriterOptions, ClearResult, NodeRelResult } from './types.js';
