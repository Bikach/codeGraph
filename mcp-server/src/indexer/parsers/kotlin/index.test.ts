import { describe, it, expect } from 'vitest';
import { kotlinParser } from './index.js';

describe('kotlinParser', () => {
  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(kotlinParser.language).toBe('kotlin');
    });

    it('should handle .kt and .kts extensions', () => {
      expect(kotlinParser.extensions).toContain('.kt');
      expect(kotlinParser.extensions).toContain('.kts');
    });
  });

  describe('package extraction', () => {
    it('should extract package name', async () => {
      const source = `
        package com.example.service

        class MyClass
      `;
      const result = await kotlinParser.parse(source, '/test/MyClass.kt');
      expect(result.packageName).toBe('com.example.service');
    });

    it('should handle files without package', async () => {
      const source = `class MyClass`;
      const result = await kotlinParser.parse(source, '/test/MyClass.kt');
      expect(result.packageName).toBeUndefined();
    });
  });

  describe('import extraction', () => {
    it('should extract simple imports', async () => {
      const source = `
        package com.example

        import com.example.domain.User
        import com.example.repository.UserRepository

        class MyClass
      `;
      const result = await kotlinParser.parse(source, '/test/MyClass.kt');
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]!.path).toBe('com.example.domain.User');
      expect(result.imports[1]!.path).toBe('com.example.repository.UserRepository');
    });

    it('should detect wildcard imports', async () => {
      const source = `
        import com.example.domain.*

        class MyClass
      `;
      const result = await kotlinParser.parse(source, '/test/MyClass.kt');
      expect(result.imports[0]!.isWildcard).toBe(true);
    });

    it('should extract import alias', async () => {
      const source = `
        import com.example.domain.User as AppUser
        import com.example.util.Logger as Log

        class MyClass
      `;
      const result = await kotlinParser.parse(source, '/test/MyClass.kt');
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]!.path).toBe('com.example.domain.User');
      expect(result.imports[0]!.alias).toBe('AppUser');
      expect(result.imports[1]!.path).toBe('com.example.util.Logger');
      expect(result.imports[1]!.alias).toBe('Log');
    });
  });

  describe('class extraction', () => {
    it('should extract class name', async () => {
      const source = `class UserService`;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('UserService');
      expect(result.classes[0]!.kind).toBe('class');
    });

    it('should extract interface', async () => {
      const source = `interface UserRepository`;
      const result = await kotlinParser.parse(source, '/test/UserRepository.kt');
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('UserRepository');
      expect(result.classes[0]!.kind).toBe('interface');
    });

    it('should extract object', async () => {
      const source = `object Singleton`;
      const result = await kotlinParser.parse(source, '/test/Singleton.kt');
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Singleton');
      expect(result.classes[0]!.kind).toBe('object');
    });

    it('should extract data class', async () => {
      const source = `data class User(val id: String, val name: String)`;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('User');
      expect(result.classes[0]!.isData).toBe(true);
    });

    it('should extract enum class', async () => {
      const source = `enum class Status { PENDING, ACTIVE, DONE }`;
      const result = await kotlinParser.parse(source, '/test/Status.kt');
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('Status');
      expect(result.classes[0]!.kind).toBe('enum');
    });

    it('should extract enum class with properties', async () => {
      const source = `
        enum class Priority(val level: Int) {
          HIGH(1),
          MEDIUM(2),
          LOW(3)
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Priority.kt');
      expect(result.classes[0]!.name).toBe('Priority');
      expect(result.classes[0]!.kind).toBe('enum');
    });

    it('should extract annotation class', async () => {
      const source = `annotation class MyAnnotation`;
      const result = await kotlinParser.parse(source, '/test/MyAnnotation.kt');
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.name).toBe('MyAnnotation');
      expect(result.classes[0]!.kind).toBe('annotation');
    });

    it('should extract annotation class with target', async () => {
      const source = `
        @Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
        @Retention(AnnotationRetention.RUNTIME)
        annotation class Validated
      `;
      const result = await kotlinParser.parse(source, '/test/Validated.kt');
      expect(result.classes[0]!.name).toBe('Validated');
      expect(result.classes[0]!.kind).toBe('annotation');
      expect(result.classes[0]!.annotations.map((a) => a.name)).toContain('Target');
      expect(result.classes[0]!.annotations.map((a) => a.name)).toContain('Retention');
    });

    it('should extract visibility modifiers', async () => {
      const source = `
        public class PublicClass
        private class PrivateClass
        internal class InternalClass
        protected class ProtectedClass
      `;
      const result = await kotlinParser.parse(source, '/test/Classes.kt');
      expect(result.classes).toHaveLength(4);
      expect(result.classes[0]!.visibility).toBe('public');
      expect(result.classes[1]!.visibility).toBe('private');
      expect(result.classes[2]!.visibility).toBe('internal');
      expect(result.classes[3]!.visibility).toBe('protected');
    });

    it('should extract annotations', async () => {
      const source = `
        @Service
        @Deprecated
        class MyService
      `;
      const result = await kotlinParser.parse(source, '/test/MyService.kt');
      expect(result.classes[0]!.annotations).toHaveLength(2);
      expect(result.classes[0]!.annotations.map((a) => a.name)).toContain('Service');
      expect(result.classes[0]!.annotations.map((a) => a.name)).toContain('Deprecated');
    });

    it('should extract sealed class modifier', async () => {
      const source = `sealed class Result`;
      const result = await kotlinParser.parse(source, '/test/Result.kt');
      expect(result.classes[0]!.isSealed).toBe(true);
    });

    it('should extract sealed interface modifier', async () => {
      const source = `sealed interface Response`;
      const result = await kotlinParser.parse(source, '/test/Response.kt');
      expect(result.classes[0]!.kind).toBe('interface');
      expect(result.classes[0]!.isSealed).toBe(true);
    });

    it('should extract abstract class modifier', async () => {
      const source = `abstract class Repository`;
      const result = await kotlinParser.parse(source, '/test/Repository.kt');
      expect(result.classes[0]!.isAbstract).toBe(true);
    });

    it('should extract abstract function modifier', async () => {
      const source = `
        abstract class Repository {
          abstract fun find(): Entity
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Repository.kt');
      expect(result.classes[0]!.isAbstract).toBe(true);
      expect(result.classes[0]!.functions[0]!.isAbstract).toBe(true);
    });
  });

  describe('inheritance extraction', () => {
    it('should extract class implementing interface', async () => {
      const source = `class UserRepositoryImpl : UserRepository`;
      const result = await kotlinParser.parse(source, '/test/UserRepositoryImpl.kt');
      expect(result.classes[0]!.interfaces).toContain('UserRepository');
    });

    it('should extract class extending class with constructor call', async () => {
      const source = `class AdminService : BaseService()`;
      const result = await kotlinParser.parse(source, '/test/AdminService.kt');
      expect(result.classes[0]!.interfaces).toContain('BaseService');
    });

    it('should extract multiple interfaces', async () => {
      const source = `class UserService : UserRepository, Serializable, Closeable`;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      expect(result.classes[0]!.interfaces).toHaveLength(3);
      expect(result.classes[0]!.interfaces).toContain('UserRepository');
      expect(result.classes[0]!.interfaces).toContain('Serializable');
      expect(result.classes[0]!.interfaces).toContain('Closeable');
    });

    it('should extract interface extending interfaces', async () => {
      const source = `interface UserRepository : Repository, Auditable`;
      const result = await kotlinParser.parse(source, '/test/UserRepository.kt');
      expect(result.classes[0]!.interfaces).toContain('Repository');
      expect(result.classes[0]!.interfaces).toContain('Auditable');
    });
  });

  describe('function extraction', () => {
    it('should extract class functions', async () => {
      const source = `
        class UserService {
          fun findUser(id: String): User? = null
          fun saveUser(user: User): User = user
        }
      `;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      expect(result.classes[0]!.functions).toHaveLength(2);
      expect(result.classes[0]!.functions[0]!.name).toBe('findUser');
      expect(result.classes[0]!.functions[1]!.name).toBe('saveUser');
    });

    it('should extract suspend functions', async () => {
      const source = `
        class UserService {
          suspend fun fetchUser(id: String): User? = null
        }
      `;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      expect(result.classes[0]!.functions[0]!.isSuspend).toBe(true);
    });

    it('should extract function parameters', async () => {
      const source = `
        class UserService {
          fun createUser(name: String, email: String): User = User()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      const fn = result.classes[0]!.functions[0]!;
      expect(fn.parameters).toHaveLength(2);
      expect(fn.parameters[0]!.name).toBe('name');
      expect(fn.parameters[1]!.name).toBe('email');
    });

    it('should extract parameter types', async () => {
      const source = `
        class Service {
          fun process(id: String, count: Int, user: User?): Unit {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      const params = result.classes[0]!.functions[0]!.parameters;
      expect(params[0]!.type).toBe('String');
      expect(params[1]!.type).toBe('Int');
      expect(params[2]!.type).toBe('User?');
    });

    // Note: Default values in Kotlin AST are siblings of parameters, not children
    // This is a limitation of tree-sitter-kotlin grammar structure
    // The extractParameters function would need enhancement to handle this edge case

    it('should extract function return type', async () => {
      const source = `
        class Service {
          fun getUser(id: String): User = User()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.functions[0]!.returnType).toBe('User');
    });

    it('should extract nullable return type', async () => {
      const source = `
        class Service {
          fun findUser(id: String): User? = null
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.functions[0]!.returnType).toBe('User?');
    });

    it('should extract top-level functions', async () => {
      const source = `
        fun greet(name: String): String = "Hello, $name"
      `;
      const result = await kotlinParser.parse(source, '/test/utils.kt');
      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.name).toBe('greet');
    });

    it('should extract function annotations', async () => {
      const source = `
        class Service {
          @Deprecated("Use newMethod instead")
          @Suppress("UNCHECKED_CAST")
          fun oldMethod(): Unit {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      const fn = result.classes[0]!.functions[0]!;
      expect(fn.annotations).toHaveLength(2);
      expect(fn.annotations.map((a) => a.name)).toContain('Deprecated');
      expect(fn.annotations.map((a) => a.name)).toContain('Suppress');
    });

    it('should extract extension functions', async () => {
      const source = `
        fun String.capitalizeFirst(): String = this.replaceFirstChar { it.uppercase() }
      `;
      const result = await kotlinParser.parse(source, '/test/extensions.kt');
      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.isExtension).toBe(true);
    });

    it('should extract extension function receiver type', async () => {
      const source = `
        fun String.capitalize(): String = this.uppercase()
        fun List<User>.findActive(): List<User> = this.filter { it.active }
      `;
      const result = await kotlinParser.parse(source, '/test/extensions.kt');
      expect(result.topLevelFunctions).toHaveLength(2);
      expect(result.topLevelFunctions[0]!.receiverType).toBe('String');
      expect(result.topLevelFunctions[1]!.receiverType).toBe('List<User>');
    });
  });

  describe('property extraction', () => {
    it('should extract val properties', async () => {
      const source = `
        class Config {
          val name: String = "default"
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Config.kt');
      expect(result.classes[0]!.properties).toHaveLength(1);
      expect(result.classes[0]!.properties[0]!.name).toBe('name');
      expect(result.classes[0]!.properties[0]!.isVal).toBe(true);
    });

    it('should extract var properties', async () => {
      const source = `
        class State {
          var count: Int = 0
        }
      `;
      const result = await kotlinParser.parse(source, '/test/State.kt');
      expect(result.classes[0]!.properties[0]!.isVal).toBe(false);
    });

    it('should extract top-level properties', async () => {
      const source = `
        val VERSION = "1.0.0"
        var counter = 0
        private val SECRET = "hidden"
      `;
      const result = await kotlinParser.parse(source, '/test/constants.kt');
      expect(result.topLevelProperties).toHaveLength(3);
      expect(result.topLevelProperties[0]!.name).toBe('VERSION');
      expect(result.topLevelProperties[0]!.isVal).toBe(true);
      expect(result.topLevelProperties[1]!.name).toBe('counter');
      expect(result.topLevelProperties[1]!.isVal).toBe(false);
      expect(result.topLevelProperties[2]!.visibility).toBe('private');
    });

    it('should extract property types', async () => {
      const source = `
        class Config {
          val name: String = "default"
          var user: User? = null
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Config.kt');
      expect(result.classes[0]!.properties[0]!.type).toBe('String');
      expect(result.classes[0]!.properties[1]!.type).toBe('User?');
    });

    it('should extract property annotations', async () => {
      const source = `
        class Service {
          @Inject
          val repository: Repository = Repository()

          @Deprecated("Use newField")
          var oldField: String = ""
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.properties[0]!.annotations).toHaveLength(1);
      expect(result.classes[0]!.properties[0]!.annotations[0]!.name).toBe('Inject');
      expect(result.classes[0]!.properties[1]!.annotations).toHaveLength(1);
      expect(result.classes[0]!.properties[1]!.annotations[0]!.name).toBe('Deprecated');
    });
  });

  describe('function calls extraction', () => {
    it('should extract function calls in method body', async () => {
      const source = `
        class UserService(private val repo: UserRepository) {
          fun findUser(id: String): User? {
            log("Finding user")
            return repo.findById(id)
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      const calls = result.classes[0]!.functions[0]!.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.map((c) => c.name)).toContain('log');
      expect(calls.map((c) => c.name)).toContain('findById');
    });

    it('should capture receiver in method calls', async () => {
      const source = `
        class Service {
          fun doWork() {
            repository.save(data)
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      const calls = result.classes[0]!.functions[0]!.calls;
      const saveCall = calls.find((c) => c.name === 'save');
      expect(saveCall?.receiver).toBe('repository');
    });
  });

  describe('source location', () => {
    it('should track line numbers for classes', async () => {
      const source = `package test

class FirstClass

class SecondClass`;
      const result = await kotlinParser.parse(source, '/test/Classes.kt');
      expect(result.classes[0]!.location.startLine).toBe(3);
      expect(result.classes[1]!.location.startLine).toBe(5);
    });

    it('should set filePath in all locations', async () => {
      const source = `
        class MyClass {
          fun myFunc() {
            call()
          }
        }
      `;
      const filePath = '/test/MyClass.kt';
      const result = await kotlinParser.parse(source, filePath);

      expect(result.classes[0]!.location.filePath).toBe(filePath);
      expect(result.classes[0]!.functions[0]!.location.filePath).toBe(filePath);
      expect(result.classes[0]!.functions[0]!.calls[0]!.location.filePath).toBe(filePath);
    });
  });

  describe('nested classes', () => {
    it('should extract nested classes', async () => {
      const source = `
        class Outer {
          class Inner {
            fun innerMethod() {}
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Outer.kt');
      expect(result.classes[0]!.nestedClasses).toHaveLength(1);
      expect(result.classes[0]!.nestedClasses[0]!.name).toBe('Inner');
      expect(result.classes[0]!.nestedClasses[0]!.functions).toHaveLength(1);
    });
  });
});
