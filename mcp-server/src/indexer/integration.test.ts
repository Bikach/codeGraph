/**
 * Integration Tests: Parser → Resolver Pipeline
 *
 * These tests validate that the Kotlin parser and symbol resolver work
 * together correctly, covering all the edge cases and ensuring coherent
 * data flow through the entire pipeline.
 */

import { describe, it, expect } from 'vitest';
import { kotlinParser } from './parsers/kotlin/index.js';
import {
  buildSymbolTable,
  resolveSymbols,
  getResolutionStats,
  lookupSymbol,
  findSymbols,
} from './resolver/index.js';
import type { ClassSymbol, FunctionSymbol, TypeAliasSymbol, PropertySymbol } from './resolver/types.js';
import type { ParsedFile } from './types.js';

describe('Parser → Resolver Integration', () => {
  describe('superclass/interface distinction', () => {
    it('should correctly resolve type hierarchy with superclass and interfaces', async () => {
      const source = `
        package com.example

        open class BaseService {
          open fun init() {}
        }

        interface Repository {
          fun save()
        }

        interface Closeable {
          fun close()
        }

        class UserService : BaseService(), Repository, Closeable {
          override fun init() {}
          override fun save() {}
          override fun close() {}
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/services.kt');
      const table = buildSymbolTable([parsed]);

      // Verify UserService has correct hierarchy
      const userService = lookupSymbol(table, 'com.example.UserService') as ClassSymbol;
      expect(userService).toBeDefined();
      expect(userService.superClass).toBe('BaseService');
      expect(userService.interfaces).toEqual(['Repository', 'Closeable']);

      // Verify type hierarchy was built correctly
      const hierarchy = table.typeHierarchy.get('com.example.UserService');
      expect(hierarchy).toBeDefined();
      expect(hierarchy).toContain('com.example.BaseService');
      expect(hierarchy).toContain('com.example.Repository');
      expect(hierarchy).toContain('com.example.Closeable');
    });

    it('should resolve inherited method calls through hierarchy', async () => {
      const baseFile = `
        package com.example

        open class BaseService {
          open fun log(message: String) {}
        }
      `;
      const childFile = `
        package com.example

        class UserService : BaseService() {
          fun process() {
            log("processing")
          }
        }
      `;

      const parsedBase = await kotlinParser.parse(baseFile, '/test/BaseService.kt');
      const parsedChild = await kotlinParser.parse(childFile, '/test/UserService.kt');
      const resolved = resolveSymbols([parsedBase, parsedChild]);

      // The call to log() should resolve to BaseService.log through hierarchy
      const userServiceFile = resolved.find((f) => f.filePath === '/test/UserService.kt')!;
      expect(userServiceFile.resolvedCalls).toHaveLength(1);
      expect(userServiceFile.resolvedCalls[0]!.toFqn).toBe('com.example.BaseService.log');
    });
  });

  describe('Kotlin metadata preservation', () => {
    it('should preserve data class metadata in resolver', async () => {
      const source = `
        package com.example
        data class User(val name: String, val age: Int)
      `;
      const parsed = await kotlinParser.parse(source, '/test/User.kt');
      const table = buildSymbolTable([parsed]);

      const user = lookupSymbol(table, 'com.example.User') as ClassSymbol;
      expect(user).toBeDefined();
      expect(user.isData).toBe(true);
    });

    it('should preserve sealed class metadata in resolver', async () => {
      const source = `
        package com.example
        sealed class Result
        data class Success(val value: Any) : Result()
        data class Error(val message: String) : Result()
      `;
      const parsed = await kotlinParser.parse(source, '/test/Result.kt');
      const table = buildSymbolTable([parsed]);

      const result = lookupSymbol(table, 'com.example.Result') as ClassSymbol;
      expect(result).toBeDefined();
      expect(result.isSealed).toBe(true);

      const success = lookupSymbol(table, 'com.example.Success') as ClassSymbol;
      expect(success.isData).toBe(true);
      expect(success.superClass).toBe('Result');
    });

    it('should preserve suspend function metadata in resolver', async () => {
      const source = `
        package com.example
        class UserRepository {
          suspend fun findUser(id: String): User? = null
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/UserRepository.kt');
      const table = buildSymbolTable([parsed]);

      const findUser = lookupSymbol(table, 'com.example.UserRepository.findUser') as FunctionSymbol;
      expect(findUser).toBeDefined();
      expect(findUser.isSuspend).toBe(true);
    });

    it('should preserve inline function metadata in resolver', async () => {
      const source = `
        package com.example
        inline fun <reified T> parseJson(json: String): T = TODO()
      `;
      const parsed = await kotlinParser.parse(source, '/test/utils.kt');
      const table = buildSymbolTable([parsed]);

      const parseJson = lookupSymbol(table, 'com.example.parseJson') as FunctionSymbol;
      expect(parseJson).toBeDefined();
      expect(parseJson.isInline).toBe(true);
    });
  });

  describe('type alias resolution', () => {
    it('should resolve method calls through type aliases', async () => {
      const source = `
        package com.example

        class UserList {
          fun add(user: String) {}
        }

        typealias Users = UserList

        fun process(users: Users) {
          users.add("test")
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/users.kt');
      const table = buildSymbolTable([parsed]);
      const resolved = resolveSymbols([parsed], table);

      // Verify type alias was indexed
      const usersAlias = lookupSymbol(table, 'com.example.Users') as TypeAliasSymbol;
      expect(usersAlias).toBeDefined();
      expect(usersAlias.kind).toBe('typealias');
      expect(usersAlias.aliasedType).toBe('UserList');

      // The call to add() on Users should resolve to UserList.add
      const resolvedFile = resolved[0]!;
      const addCall = resolvedFile.resolvedCalls.find((c) => c.toFqn.includes('add'));
      expect(addCall).toBeDefined();
      expect(addCall!.toFqn).toBe('com.example.UserList.add');
    });
  });

  describe('destructuring declarations', () => {
    it('should index destructuring components as properties', async () => {
      const source = `
        package com.example

        val (firstName, lastName) = Pair("John", "Doe")
      `;
      const parsed = await kotlinParser.parse(source, '/test/names.kt');
      const table = buildSymbolTable([parsed]);

      const firstName = lookupSymbol(table, 'com.example.firstName') as PropertySymbol;
      expect(firstName).toBeDefined();
      expect(firstName.kind).toBe('property');
      expect(firstName.isVal).toBe(true);

      const lastName = lookupSymbol(table, 'com.example.lastName') as PropertySymbol;
      expect(lastName).toBeDefined();
    });

    it('should skip underscore in destructuring', async () => {
      const source = `
        package com.example
        val (_, lastName) = Pair("John", "Doe")
      `;
      const parsed = await kotlinParser.parse(source, '/test/names.kt');
      const table = buildSymbolTable([parsed]);

      // _ should not be indexed
      const underscore = lookupSymbol(table, 'com.example._');
      expect(underscore).toBeUndefined();

      // lastName should be indexed
      const lastName = lookupSymbol(table, 'com.example.lastName');
      expect(lastName).toBeDefined();
    });
  });

  describe('object expressions', () => {
    it('should resolve calls inside object expressions', async () => {
      const source = `
        package com.example

        interface ClickListener {
          fun onClick()
        }

        class Logger {
          fun log(msg: String) {}
        }

        val logger = Logger()

        fun setup() {
          val listener = object : ClickListener {
            override fun onClick() {
              logger.log("clicked")
            }
          }
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/listeners.kt');
      const resolved = resolveSymbols([parsed]);

      // Should have resolved the log() call inside the object expression
      const resolvedFile = resolved[0]!;
      const logCall = resolvedFile.resolvedCalls.find((c) => c.toFqn.includes('log'));
      expect(logCall).toBeDefined();
      expect(logCall!.toFqn).toBe('com.example.Logger.log');
    });
  });

  describe('companion object resolution', () => {
    it('should resolve companion object method calls', async () => {
      const source = `
        package com.example

        class User {
          companion object {
            fun create(name: String): User = TODO()
          }
        }

        fun makeUser() {
          User.create("test")
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/User.kt');
      const table = buildSymbolTable([parsed]);
      const resolved = resolveSymbols([parsed], table);

      // Verify companion object is indexed correctly
      const companion = lookupSymbol(table, 'com.example.User.Companion');
      expect(companion).toBeDefined();

      const createMethod = lookupSymbol(table, 'com.example.User.Companion.create');
      expect(createMethod).toBeDefined();

      // The call to User.create() should resolve to User.Companion.create
      const resolvedFile = resolved[0]!;
      const createCall = resolvedFile.resolvedCalls.find((c) => c.toFqn.includes('create'));
      expect(createCall).toBeDefined();
      expect(createCall!.toFqn).toBe('com.example.User.Companion.create');
    });

    it('should handle named companion objects', async () => {
      const source = `
        package com.example

        class Config {
          companion object Factory {
            fun load(): Config = Config()
          }
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/Config.kt');
      const table = buildSymbolTable([parsed]);

      // Named companion should use its name, not "Companion"
      const factory = lookupSymbol(table, 'com.example.Config.Factory');
      expect(factory).toBeDefined();

      const loadMethod = lookupSymbol(table, 'com.example.Config.Factory.load');
      expect(loadMethod).toBeDefined();
    });
  });

  describe('extension function resolution', () => {
    it('should resolve extension function calls by receiver type', async () => {
      const source = `
        package com.example

        fun String.trimAndUpper(): String = this.trim().uppercase()

        fun process(input: String) {
          input.trimAndUpper()
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/extensions.kt');
      const table = buildSymbolTable([parsed]);
      const resolved = resolveSymbols([parsed], table);

      // Verify extension function is indexed
      const trimAndUpper = lookupSymbol(table, 'com.example.trimAndUpper') as FunctionSymbol;
      expect(trimAndUpper).toBeDefined();
      expect(trimAndUpper.isExtension).toBe(true);
      expect(trimAndUpper.receiverType).toBe('String');

      // The call should resolve
      const resolvedFile = resolved[0]!;
      const extCall = resolvedFile.resolvedCalls.find((c) => c.toFqn.includes('trimAndUpper'));
      expect(extCall).toBeDefined();
    });
  });

  describe('property type tracking', () => {
    it('should use property types for receiver inference', async () => {
      const source = `
        package com.example

        class UserRepository {
          fun findById(id: String): User? = null
        }

        class UserService {
          private val repository: UserRepository = UserRepository()

          fun getUser(id: String): User? {
            return repository.findById(id)
          }
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/UserService.kt');
      const table = buildSymbolTable([parsed]);
      const resolved = resolveSymbols([parsed], table);

      // Verify property type is indexed
      const repoProp = lookupSymbol(table, 'com.example.UserService.repository') as PropertySymbol;
      expect(repoProp).toBeDefined();
      expect(repoProp.type).toBe('UserRepository');

      // The call to repository.findById() should resolve
      const resolvedFile = resolved[0]!;
      const findByIdCall = resolvedFile.resolvedCalls.find((c) => c.toFqn.includes('findById'));
      expect(findByIdCall).toBeDefined();
      expect(findByIdCall!.toFqn).toBe('com.example.UserRepository.findById');
    });
  });

  describe('resolution statistics', () => {
    it('should calculate correct resolution statistics', async () => {
      const source = `
        package com.example

        class Helper {
          fun help() {}
        }

        class Service {
          private val helper: Helper = Helper()

          fun process() {
            helper.help()
            unknownFunction()
          }
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/Service.kt');
      const resolved = resolveSymbols([parsed]);
      const stats = getResolutionStats(resolved);

      // 2 calls total: helper.help() and unknownFunction()
      expect(stats.totalCalls).toBe(2);
      // Only helper.help() should resolve
      expect(stats.resolvedCalls).toBe(1);
      expect(stats.unresolvedCalls).toBe(1);
      expect(stats.resolutionRate).toBe(0.5);
    });
  });

  describe('cross-file resolution', () => {
    it('should resolve calls across multiple files', async () => {
      const file1 = `
        package com.example.domain

        class User(val name: String)
      `;
      const file2 = `
        package com.example.repository

        import com.example.domain.User

        class UserRepository {
          fun save(user: User): User = user
        }
      `;
      const file3 = `
        package com.example.service

        import com.example.repository.UserRepository
        import com.example.domain.User

        class UserService {
          private val repository: UserRepository = UserRepository()

          fun createUser(name: String): User {
            return repository.save(User(name))
          }
        }
      `;

      const parsed1 = await kotlinParser.parse(file1, '/test/domain/User.kt');
      const parsed2 = await kotlinParser.parse(file2, '/test/repository/UserRepository.kt');
      const parsed3 = await kotlinParser.parse(file3, '/test/service/UserService.kt');

      const resolved = resolveSymbols([parsed1, parsed2, parsed3]);
      const stats = getResolutionStats(resolved);

      // Should resolve repository.save() call
      const serviceFile = resolved.find((f) => f.filePath === '/test/service/UserService.kt')!;
      const saveCall = serviceFile.resolvedCalls.find((c) => c.toFqn.includes('save'));
      expect(saveCall).toBeDefined();
      expect(saveCall!.toFqn).toBe('com.example.repository.UserRepository.save');
    });
  });

  describe('findSymbols pattern matching', () => {
    it('should find symbols by pattern', async () => {
      const source = `
        package com.example

        class UserService {
          fun findUser() {}
          fun findAll() {}
        }

        class ProductService {
          fun findProduct() {}
        }
      `;
      const parsed = await kotlinParser.parse(source, '/test/services.kt');
      const table = buildSymbolTable([parsed]);

      // Find all functions starting with "find"
      const findFunctions = findSymbols(table, '*find*');
      expect(findFunctions.length).toBeGreaterThanOrEqual(3);
      expect(findFunctions.some((s) => s.name === 'findUser')).toBe(true);
      expect(findFunctions.some((s) => s.name === 'findAll')).toBe(true);
      expect(findFunctions.some((s) => s.name === 'findProduct')).toBe(true);

      // Find all services
      const services = findSymbols(table, '*Service');
      expect(services).toHaveLength(2);
    });
  });
});
