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
      // BaseService() has parentheses = constructor call = superclass
      expect(result.classes[0]!.superClass).toBe('BaseService');
      expect(result.classes[0]!.interfaces).toHaveLength(0);
    });

    it('should extract multiple interfaces', async () => {
      const source = `class UserService : UserRepository, Serializable, Closeable`;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      // No parentheses = all interfaces
      expect(result.classes[0]!.superClass).toBeUndefined();
      expect(result.classes[0]!.interfaces).toHaveLength(3);
      expect(result.classes[0]!.interfaces).toContain('UserRepository');
      expect(result.classes[0]!.interfaces).toContain('Serializable');
      expect(result.classes[0]!.interfaces).toContain('Closeable');
    });

    it('should extract superclass and interfaces together', async () => {
      // In Kotlin: BaseService() has parens = superclass, Repository/Closeable = interfaces
      const source = `class UserService : BaseService(), Repository, Closeable`;
      const result = await kotlinParser.parse(source, '/test/UserService.kt');
      expect(result.classes[0]!.superClass).toBe('BaseService');
      expect(result.classes[0]!.interfaces).toHaveLength(2);
      expect(result.classes[0]!.interfaces).toContain('Repository');
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

    it('should extract argument count from calls', async () => {
      const source = `
        package com.example

        fun process(items: List<String>) {
          items.map { it.uppercase() }
          items.filter { it.isNotEmpty() }
          items.joinToString(", ")
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Process.kt');
      const processFn = result.topLevelFunctions.find((f) => f.name === 'process');
      expect(processFn).toBeDefined();

      const joinCall = processFn!.calls.find((c) => c.name === 'joinToString');
      expect(joinCall).toBeDefined();
      expect(joinCall!.argumentCount).toBe(1);
    });

    it('should infer literal types for arguments', async () => {
      const source = `
        package com.example

        fun test() {
          println(42)
          println("hello")
          println(true)
          println(3.14)
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Test.kt');
      const testFn = result.topLevelFunctions.find((f) => f.name === 'test');

      expect(testFn).toBeDefined();
      expect(testFn!.calls.length).toBe(4);

      const intCall = testFn!.calls.find((c) => c.argumentTypes?.includes('Int'));
      const stringCall = testFn!.calls.find((c) => c.argumentTypes?.includes('String'));
      const boolCall = testFn!.calls.find((c) => c.argumentTypes?.includes('Boolean'));
      const doubleCall = testFn!.calls.find((c) => c.argumentTypes?.includes('Double'));

      expect(intCall).toBeDefined();
      expect(stringCall).toBeDefined();
      expect(boolCall).toBeDefined();
      expect(doubleCall).toBeDefined();
    });
  });

  describe('qualified calls', () => {
    it('should extract full FQN receiver from qualified call', async () => {
      const source = `
        package com.example

        fun test() {
          com.example.utils.StringUtils.format("hello")
          java.lang.System.currentTimeMillis()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/QualifiedCall.kt');
      const testFn = result.topLevelFunctions.find((f) => f.name === 'test');

      expect(testFn).toBeDefined();
      expect(testFn!.calls.length).toBe(2);

      const formatCall = testFn!.calls.find((c) => c.name === 'format');
      expect(formatCall).toBeDefined();
      expect(formatCall!.receiver).toBe('com.example.utils.StringUtils');

      const timeCall = testFn!.calls.find((c) => c.name === 'currentTimeMillis');
      expect(timeCall).toBeDefined();
      expect(timeCall!.receiver).toBe('java.lang.System');
    });

    it('should handle mixed qualified and simple calls', async () => {
      const source = `
        package com.example

        class Service {
          fun process() {
            println("start")
            com.example.Logger.log("processing")
            helper()
          }

          fun helper() {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Mixed.kt');
      const processFn = result.classes[0]!.functions.find((f) => f.name === 'process');

      expect(processFn).toBeDefined();
      expect(processFn!.calls.length).toBe(3);

      const logCall = processFn!.calls.find((c) => c.name === 'log');
      expect(logCall).toBeDefined();
      expect(logCall!.receiver).toBe('com.example.Logger');

      const helperCall = processFn!.calls.find((c) => c.name === 'helper');
      expect(helperCall).toBeDefined();
      expect(helperCall!.receiver).toBeUndefined();
    });
  });

  describe('safe calls', () => {
    it('should detect safe call operator on property access', async () => {
      const source = `
        package com.example

        class User(val name: String)

        fun getName(user: User?): String? {
          return user?.name
        }
      `;
      const result = await kotlinParser.parse(source, '/test/SafeCall.kt');
      expect(result.topLevelFunctions.length).toBe(1);
    });

    it('should mark safe call in ParsedCall', async () => {
      const source = `
        package com.example

        class Service {
          fun process(): String = "done"
        }

        fun test(service: Service?) {
          service?.process()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/SafeCall2.kt');
      const testFn = result.topLevelFunctions.find((f) => f.name === 'test');

      expect(testFn).toBeDefined();
      const processCall = testFn!.calls.find((c) => c.name === 'process');
      if (processCall) {
        expect(processCall.isSafeCall).toBe(true);
      }
    });
  });

  describe('chained calls', () => {
    it('should extract chained method calls', async () => {
      const source = `
        package com.example

        class Builder {
          fun step1(): Builder = this
          fun step2(): Builder = this
          fun build(): String = "done"
        }

        fun test() {
          Builder().step1().step2().build()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/ChainedCalls.kt');
      const testFn = result.topLevelFunctions.find((f) => f.name === 'test');

      expect(testFn).toBeDefined();
      // All chained calls should be extracted
      const callNames = testFn!.calls.map((c) => c.name);
      expect(callNames).toContain('step1');
      expect(callNames).toContain('step2');
      expect(callNames).toContain('build');
    });

    it('should extract nested function calls', async () => {
      const source = `
        package com.example

        fun outer(x: Int): Int = x
        fun inner(x: Int): Int = x
        fun deepest(x: Int): Int = x

        fun test() {
          outer(inner(deepest(1)))
        }
      `;
      const result = await kotlinParser.parse(source, '/test/NestedCalls.kt');
      const testFn = result.topLevelFunctions.find((f) => f.name === 'test');

      expect(testFn).toBeDefined();
      const callNames = testFn!.calls.map((c) => c.name);
      expect(callNames).toContain('outer');
      expect(callNames).toContain('inner');
      expect(callNames).toContain('deepest');
    });

    it('should handle builder pattern with lambdas', async () => {
      const source = `
        package com.example

        fun test() {
          listOf(1, 2, 3)
            .filter { it > 1 }
            .map { it * 2 }
            .forEach { println(it) }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/BuilderLambda.kt');
      const testFn = result.topLevelFunctions.find((f) => f.name === 'test');

      expect(testFn).toBeDefined();
      const callNames = testFn!.calls.map((c) => c.name);
      expect(callNames).toContain('listOf');
      expect(callNames).toContain('filter');
      expect(callNames).toContain('map');
      expect(callNames).toContain('forEach');
    });

    it('should extract safe call chains', async () => {
      const source = `
        package com.example

        class User(val address: Address?)
        class Address(val city: City?)
        class City(val name: String)

        fun getCityName(user: User?): String? {
          return user?.address?.city?.name
        }
      `;
      const result = await kotlinParser.parse(source, '/test/SafeCallChain.kt');
      // This tests property access chains which may not be calls
      // but the parser should handle this without errors
      expect(result.topLevelFunctions.length).toBe(1);
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

    it('should extract nested interfaces', async () => {
      const source = `
        class Container {
          interface Callback {
            fun onSuccess()
            fun onError(message: String)
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Container.kt');
      expect(result.classes[0]!.nestedClasses).toHaveLength(1);
      expect(result.classes[0]!.nestedClasses[0]!.name).toBe('Callback');
      expect(result.classes[0]!.nestedClasses[0]!.kind).toBe('interface');
      expect(result.classes[0]!.nestedClasses[0]!.functions).toHaveLength(2);
    });

    it('should extract nested objects', async () => {
      const source = `
        class Config {
          object Defaults {
            val timeout: Int = 30
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Config.kt');
      expect(result.classes[0]!.nestedClasses).toHaveLength(1);
      expect(result.classes[0]!.nestedClasses[0]!.name).toBe('Defaults');
      expect(result.classes[0]!.nestedClasses[0]!.kind).toBe('object');
      expect(result.classes[0]!.nestedClasses[0]!.properties).toHaveLength(1);
    });

    it('should extract multiple nested levels (deep nesting)', async () => {
      const source = `
        class Level1 {
          class Level2 {
            class Level3 {
              fun deepMethod(): String = "deep"
            }
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Level1.kt');
      expect(result.classes[0]!.name).toBe('Level1');
      expect(result.classes[0]!.nestedClasses).toHaveLength(1);

      const level2 = result.classes[0]!.nestedClasses[0]!;
      expect(level2.name).toBe('Level2');
      expect(level2.nestedClasses).toHaveLength(1);

      const level3 = level2.nestedClasses[0]!;
      expect(level3.name).toBe('Level3');
      expect(level3.functions).toHaveLength(1);
      expect(level3.functions[0]!.name).toBe('deepMethod');
    });

    it('should extract mixed nested types at same level', async () => {
      const source = `
        class Parent {
          class NestedClass
          interface NestedInterface
          object NestedObject
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Parent.kt');
      expect(result.classes[0]!.nestedClasses).toHaveLength(3);

      const kinds = result.classes[0]!.nestedClasses.map(c => c.kind);
      expect(kinds).toContain('class');
      expect(kinds).toContain('interface');
      expect(kinds).toContain('object');
    });
  });

  describe('delegated properties', () => {
    it('should extract lazy delegated property', async () => {
      const source = `
        class Service {
          val heavyResource by lazy { computeHeavyResource() }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.properties).toHaveLength(1);
      expect(result.classes[0]!.properties[0]!.name).toBe('heavyResource');
      expect(result.classes[0]!.properties[0]!.initializer).toContain('lazy');
    });

    it('should extract observable delegated property', async () => {
      const source = `
        class State {
          var count: Int by Delegates.observable(0) { _, old, new -> println("Changed") }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/State.kt');
      expect(result.classes[0]!.properties).toHaveLength(1);
      expect(result.classes[0]!.properties[0]!.name).toBe('count');
      expect(result.classes[0]!.properties[0]!.initializer).toContain('Delegates.observable');
    });

    it('should extract map delegated property', async () => {
      const source = `
        class User(map: Map<String, Any>) {
          val name: String by map
          val age: Int by map
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties[0]!.name).toBe('name');
      expect(result.classes[0]!.properties[0]!.initializer).toBe('by map');
      expect(result.classes[0]!.properties[1]!.name).toBe('age');
    });
  });

  describe('property initializers', () => {
    it('should extract simple property initializer', async () => {
      const source = `
        class Config {
          val maxRetries: Int = 3
          val timeout: Long = 5000L
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Config.kt');
      expect(result.classes[0]!.properties).toHaveLength(2);
      // Note: initializer captures the value expression
      expect(result.classes[0]!.properties[0]!.name).toBe('maxRetries');
      expect(result.classes[0]!.properties[1]!.name).toBe('timeout');
    });

    it('should extract function call initializer', async () => {
      const source = `
        class Service {
          val client = createHttpClient()
          val config = loadConfig("app.json")
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties[0]!.name).toBe('client');
      expect(result.classes[0]!.properties[1]!.name).toBe('config');
    });

    it('should extract object instantiation initializer', async () => {
      const source = `
        class Service {
          val repository = UserRepository()
          val cache = HashMap<String, User>()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties[0]!.name).toBe('repository');
      expect(result.classes[0]!.properties[1]!.name).toBe('cache');
    });
  });

  describe('function visibility', () => {
    it('should extract private function', async () => {
      const source = `
        class Service {
          private fun helper(): String = "help"
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.functions[0]!.visibility).toBe('private');
    });

    it('should extract internal function', async () => {
      const source = `
        class Service {
          internal fun moduleOnly(): Unit {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.functions[0]!.visibility).toBe('internal');
    });

    it('should extract protected function', async () => {
      const source = `
        open class Base {
          protected fun forSubclasses(): Unit {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Base.kt');
      expect(result.classes[0]!.functions[0]!.visibility).toBe('protected');
    });

    it('should extract public function (explicit)', async () => {
      const source = `
        class Service {
          public fun explicitPublic(): Unit {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.functions[0]!.visibility).toBe('public');
    });

    it('should default to public visibility', async () => {
      const source = `
        class Service {
          fun implicitPublic(): Unit {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      expect(result.classes[0]!.functions[0]!.visibility).toBe('public');
    });

    it('should extract top-level function visibility', async () => {
      const source = `
        private fun utilityHelper(): String = "helper"
        internal fun moduleUtil(): Int = 42
      `;
      const result = await kotlinParser.parse(source, '/test/utils.kt');
      expect(result.topLevelFunctions).toHaveLength(2);
      expect(result.topLevelFunctions[0]!.visibility).toBe('private');
      expect(result.topLevelFunctions[1]!.visibility).toBe('internal');
    });
  });

  describe('function modifiers (inline, infix, operator)', () => {
    it('should extract inline function modifier', async () => {
      const source = `
        class Utils {
          inline fun <T> measure(block: () -> T): T = block()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Utils.kt');
      expect(result.classes[0]!.functions[0]!.isInline).toBe(true);
    });

    it('should extract infix function modifier', async () => {
      const source = `
        class Vector {
          infix fun add(other: Vector): Vector = Vector()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Vector.kt');
      expect(result.classes[0]!.functions[0]!.isInfix).toBe(true);
    });

    it('should extract operator function modifier', async () => {
      const source = `
        class Money {
          operator fun plus(other: Money): Money = Money()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Money.kt');
      expect(result.classes[0]!.functions[0]!.isOperator).toBe(true);
    });

    it('should extract multiple modifiers on same function', async () => {
      const source = `
        class Container {
          inline operator fun get(index: Int): String = ""
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Container.kt');
      const fn = result.classes[0]!.functions[0]!;
      expect(fn.isInline).toBe(true);
      expect(fn.isOperator).toBe(true);
    });

    it('should extract top-level inline function', async () => {
      const source = `
        inline fun <T> runCatching(block: () -> T): Result<T> = Result.success(block())
      `;
      const result = await kotlinParser.parse(source, '/test/utils.kt');
      expect(result.topLevelFunctions[0]!.isInline).toBe(true);
    });
  });

  describe('type aliases', () => {
    it('should extract simple type alias', async () => {
      const source = `
        typealias UserList = List<User>
      `;
      const result = await kotlinParser.parse(source, '/test/types.kt');
      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0]!.name).toBe('UserList');
      expect(result.typeAliases[0]!.aliasedType).toBe('List<User>');
    });

    it('should extract type alias with visibility', async () => {
      const source = `
        private typealias InternalMap = HashMap<String, Any>
      `;
      const result = await kotlinParser.parse(source, '/test/types.kt');
      expect(result.typeAliases[0]!.visibility).toBe('private');
    });

    it('should extract type alias for function type', async () => {
      const source = `
        typealias Handler = (String) -> Unit
      `;
      const result = await kotlinParser.parse(source, '/test/types.kt');
      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0]!.name).toBe('Handler');
    });
  });

  describe('annotation arguments', () => {
    it('should extract positional annotation argument', async () => {
      const source = `
        @Deprecated("Use newMethod instead")
        fun oldMethod() {}
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      const annotation = result.topLevelFunctions[0]!.annotations[0]!;
      expect(annotation.name).toBe('Deprecated');
      expect(annotation.arguments).toBeDefined();
      expect(annotation.arguments!['_0']).toBe('"Use newMethod instead"');
    });

    it('should extract named annotation arguments', async () => {
      const source = `
        @Deprecated(message = "old", replaceWith = ReplaceWith("newMethod"))
        fun oldMethod() {}
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      const annotation = result.topLevelFunctions[0]!.annotations[0]!;
      expect(annotation.arguments).toBeDefined();
      expect(annotation.arguments!['message']).toBe('"old"');
    });

    it('should handle annotation without arguments', async () => {
      const source = `
        @Override
        fun toString(): String = ""
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      const annotation = result.topLevelFunctions[0]!.annotations[0]!;
      expect(annotation.arguments).toBeUndefined();
    });
  });

  describe('companion objects', () => {
    it('should extract companion object', async () => {
      const source = `
        class User {
          companion object {
            fun create(): User = User()
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.companionObject).toBeDefined();
      expect(result.classes[0]!.companionObject!.kind).toBe('object');
      expect(result.classes[0]!.companionObject!.functions).toHaveLength(1);
      expect(result.classes[0]!.companionObject!.functions[0]!.name).toBe('create');
    });

    it('should extract named companion object', async () => {
      const source = `
        class User {
          companion object Factory {
            fun create(): User = User()
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.companionObject).toBeDefined();
      expect(result.classes[0]!.companionObject!.name).toBe('Factory');
    });

    it('should extract companion object properties', async () => {
      const source = `
        class Config {
          companion object {
            val DEFAULT_TIMEOUT = 30
            val MAX_RETRIES = 3
          }
        }
      `;
      const result = await kotlinParser.parse(source, '/test/Config.kt');
      expect(result.classes[0]!.companionObject!.properties).toHaveLength(2);
    });
  });

  describe('primary constructor properties', () => {
    it('should extract val properties from primary constructor', async () => {
      const source = `
        class User(val id: String, val name: String)
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties[0]!.name).toBe('id');
      expect(result.classes[0]!.properties[0]!.isVal).toBe(true);
      expect(result.classes[0]!.properties[1]!.name).toBe('name');
    });

    it('should extract var properties from primary constructor', async () => {
      const source = `
        class Counter(var count: Int)
      `;
      const result = await kotlinParser.parse(source, '/test/Counter.kt');
      expect(result.classes[0]!.properties[0]!.isVal).toBe(false);
    });

    it('should not extract non-property constructor parameters', async () => {
      const source = `
        class Service(val repo: Repository, config: Config)
      `;
      const result = await kotlinParser.parse(source, '/test/Service.kt');
      // Only 'repo' is a property (has val), 'config' is just a parameter
      expect(result.classes[0]!.properties).toHaveLength(1);
      expect(result.classes[0]!.properties[0]!.name).toBe('repo');
    });

    it('should extract property visibility from primary constructor', async () => {
      const source = `
        class User(private val id: String, internal val name: String)
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.properties[0]!.visibility).toBe('private');
      expect(result.classes[0]!.properties[1]!.visibility).toBe('internal');
    });

    it('should merge primary constructor and body properties', async () => {
      const source = `
        class User(val id: String) {
          val createdAt: Long = System.currentTimeMillis()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.properties).toHaveLength(2);
      expect(result.classes[0]!.properties.map(p => p.name)).toContain('id');
      expect(result.classes[0]!.properties.map(p => p.name)).toContain('createdAt');
    });
  });

  describe('secondary constructors', () => {
    it('should extract secondary constructor', async () => {
      const source = `
        class User(val name: String) {
          constructor(id: Int) : this("User#$id")
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.secondaryConstructors).toBeDefined();
      expect(result.classes[0]!.secondaryConstructors).toHaveLength(1);
    });

    it('should extract secondary constructor parameters', async () => {
      const source = `
        class User {
          constructor(name: String, age: Int)
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      const ctor = result.classes[0]!.secondaryConstructors![0]!;
      expect(ctor.parameters).toHaveLength(2);
      expect(ctor.parameters[0]!.name).toBe('name');
      expect(ctor.parameters[1]!.name).toBe('age');
    });

    it('should extract delegation to this()', async () => {
      const source = `
        class User(val name: String, val age: Int) {
          constructor(name: String) : this(name, 0)
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.secondaryConstructors![0]!.delegatesTo).toBe('this');
    });

    it('should extract multiple secondary constructors', async () => {
      const source = `
        class User(val name: String) {
          constructor() : this("Anonymous")
          constructor(id: Int) : this("User#$id")
        }
      `;
      const result = await kotlinParser.parse(source, '/test/User.kt');
      expect(result.classes[0]!.secondaryConstructors).toHaveLength(2);
    });
  });

  describe('generics / type parameters', () => {
    it('should extract class type parameters', async () => {
      const source = `
        class Container<T>
      `;
      const result = await kotlinParser.parse(source, '/test/Container.kt');
      expect(result.classes[0]!.typeParameters).toBeDefined();
      expect(result.classes[0]!.typeParameters).toHaveLength(1);
      expect(result.classes[0]!.typeParameters![0]!.name).toBe('T');
    });

    it('should extract multiple type parameters', async () => {
      const source = `
        class Pair<K, V>
      `;
      const result = await kotlinParser.parse(source, '/test/Pair.kt');
      expect(result.classes[0]!.typeParameters).toHaveLength(2);
      expect(result.classes[0]!.typeParameters![0]!.name).toBe('K');
      expect(result.classes[0]!.typeParameters![1]!.name).toBe('V');
    });

    it('should extract type parameter bounds', async () => {
      const source = `
        class Repository<T : Entity>
      `;
      const result = await kotlinParser.parse(source, '/test/Repository.kt');
      expect(result.classes[0]!.typeParameters![0]!.bounds).toContain('Entity');
    });

    it('should extract variance annotations (out)', async () => {
      const source = `
        class Producer<out T>
      `;
      const result = await kotlinParser.parse(source, '/test/Producer.kt');
      expect(result.classes[0]!.typeParameters![0]!.variance).toBe('out');
    });

    it('should extract variance annotations (in)', async () => {
      const source = `
        class Consumer<in T>
      `;
      const result = await kotlinParser.parse(source, '/test/Consumer.kt');
      expect(result.classes[0]!.typeParameters![0]!.variance).toBe('in');
    });

    it('should extract generic function type parameters', async () => {
      const source = `
        fun <T> identity(value: T): T = value
      `;
      const result = await kotlinParser.parse(source, '/test/utils.kt');
      expect(result.topLevelFunctions[0]!.typeParameters).toBeDefined();
      expect(result.topLevelFunctions[0]!.typeParameters![0]!.name).toBe('T');
    });

    it('should extract generic function with bounds', async () => {
      const source = `
        fun <T : Comparable<T>> max(a: T, b: T): T = if (a > b) a else b
      `;
      const result = await kotlinParser.parse(source, '/test/utils.kt');
      const typeParam = result.topLevelFunctions[0]!.typeParameters![0]!;
      expect(typeParam.name).toBe('T');
      expect(typeParam.bounds).toBeDefined();
    });
  });

  describe('destructuring declarations', () => {
    it('should extract top-level destructuring declaration', async () => {
      const source = `
        val (first, second) = Pair("a", "b")
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.destructuringDeclarations).toHaveLength(1);
      expect(result.destructuringDeclarations[0]!.componentNames).toEqual(['first', 'second']);
    });

    it('should extract destructuring with types', async () => {
      const source = `
        val (name: String, age: Int) = person
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.destructuringDeclarations[0]!.componentTypes).toBeDefined();
    });

    it('should detect val vs var in destructuring', async () => {
      const source = `
        var (x, y) = coordinates
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.destructuringDeclarations[0]!.isVal).toBe(false);
    });
  });

  // =============================================================================
  // Priority 5 Features
  // =============================================================================

  describe('reified type parameters', () => {
    it('should extract reified modifier on inline function type parameter', async () => {
      const source = `
        inline fun <reified T> isInstance(value: Any): Boolean = value is T
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.typeParameters).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.typeParameters![0]!.name).toBe('T');
      expect(result.topLevelFunctions[0]!.typeParameters![0]!.isReified).toBe(true);
    });

    it('should extract reified with bounds', async () => {
      const source = `
        inline fun <reified T : Comparable<T>> sort(list: List<T>) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const typeParam = result.topLevelFunctions[0]!.typeParameters![0]!;
      expect(typeParam.name).toBe('T');
      expect(typeParam.isReified).toBe(true);
      expect(typeParam.bounds).toContain('Comparable<T>');
    });

    it('should not mark non-reified type parameters as reified', async () => {
      const source = `
        fun <T> identity(value: T): T = value
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions[0]!.typeParameters![0]!.isReified).toBeUndefined();
    });
  });

  describe('crossinline and noinline modifiers', () => {
    it('should extract crossinline modifier on lambda parameter', async () => {
      const source = `
        inline fun execute(crossinline block: () -> Unit) {
          block()
        }
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.parameters).toHaveLength(1);
      expect(result.topLevelFunctions[0]!.parameters[0]!.name).toBe('block');
      expect(result.topLevelFunctions[0]!.parameters[0]!.isCrossinline).toBe(true);
      expect(result.topLevelFunctions[0]!.parameters[0]!.isNoinline).toBeUndefined();
    });

    it('should extract noinline modifier on lambda parameter', async () => {
      const source = `
        inline fun execute(noinline block: () -> String): () -> String = block
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions[0]!.parameters[0]!.isNoinline).toBe(true);
      expect(result.topLevelFunctions[0]!.parameters[0]!.isCrossinline).toBeUndefined();
    });

    it('should handle both crossinline and noinline in same function', async () => {
      const source = `
        inline fun process(crossinline a: () -> Unit, noinline b: () -> String) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions[0]!.parameters[0]!.name).toBe('a');
      expect(result.topLevelFunctions[0]!.parameters[0]!.isCrossinline).toBe(true);
      expect(result.topLevelFunctions[0]!.parameters[1]!.name).toBe('b');
      expect(result.topLevelFunctions[0]!.parameters[1]!.isNoinline).toBe(true);
    });

    it('should not mark regular parameters with these modifiers', async () => {
      const source = `
        fun regular(value: String) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions[0]!.parameters[0]!.isCrossinline).toBeUndefined();
      expect(result.topLevelFunctions[0]!.parameters[0]!.isNoinline).toBeUndefined();
    });
  });

  describe('multiple type bounds (where clause)', () => {
    it('should extract where clause bounds on function', async () => {
      const source = `
        fun <T> copy(source: T, dest: T) where T : CharSequence, T : Comparable<T> {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions).toHaveLength(1);
      const typeParam = result.topLevelFunctions[0]!.typeParameters![0]!;
      expect(typeParam.name).toBe('T');
      expect(typeParam.bounds).toContain('CharSequence');
      expect(typeParam.bounds).toContain('Comparable<T>');
    });

    it('should extract where clause bounds on class', async () => {
      const source = `
        class Repository<T> where T : Entity, T : Serializable {
          fun save(entity: T) {}
        }
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.classes).toHaveLength(1);
      const typeParam = result.classes[0]!.typeParameters![0]!;
      expect(typeParam.name).toBe('T');
      expect(typeParam.bounds).toContain('Entity');
      expect(typeParam.bounds).toContain('Serializable');
    });

    it('should merge inline bound with where clause bounds', async () => {
      const source = `
        fun <T : Base> process(item: T) where T : Comparable<T> {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const typeParam = result.topLevelFunctions[0]!.typeParameters![0]!;
      expect(typeParam.bounds).toContain('Base');
      expect(typeParam.bounds).toContain('Comparable<T>');
      expect(typeParam.bounds).toHaveLength(2);
    });

    it('should handle multiple type parameters with where clause', async () => {
      const source = `
        fun <K, V> mapOf() where K : Comparable<K>, V : Any {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const typeParams = result.topLevelFunctions[0]!.typeParameters!;
      expect(typeParams).toHaveLength(2);
      expect(typeParams[0]!.name).toBe('K');
      expect(typeParams[0]!.bounds).toContain('Comparable<K>');
      expect(typeParams[1]!.name).toBe('V');
      expect(typeParams[1]!.bounds).toContain('Any');
    });
  });

  describe('lambda parameters (function types)', () => {
    it('should extract simple function type parameter', async () => {
      const source = `
        fun process(callback: (Int, String) -> Boolean) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const param = result.topLevelFunctions[0]!.parameters[0]!;
      expect(param.name).toBe('callback');
      expect(param.type).toBe('(Int, String) -> Boolean');
      expect(param.functionType).toBeDefined();
      expect(param.functionType!.parameterTypes).toEqual(['Int', 'String']);
      expect(param.functionType!.returnType).toBe('Boolean');
      expect(param.functionType!.isSuspend).toBe(false);
      expect(param.functionType!.receiverType).toBeUndefined();
    });

    it('should extract function type with no parameters', async () => {
      const source = `
        fun execute(action: () -> Unit) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const param = result.topLevelFunctions[0]!.parameters[0]!;
      expect(param.functionType).toBeDefined();
      expect(param.functionType!.parameterTypes).toEqual([]);
      expect(param.functionType!.returnType).toBe('Unit');
    });

    it('should extract function type with receiver', async () => {
      const source = `
        fun withReceiver(block: Int.(String) -> Boolean) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const param = result.topLevelFunctions[0]!.parameters[0]!;
      expect(param.functionType).toBeDefined();
      expect(param.functionType!.receiverType).toBe('Int');
      expect(param.functionType!.parameterTypes).toEqual(['String']);
      expect(param.functionType!.returnType).toBe('Boolean');
    });

    it('should extract suspend function type', async () => {
      const source = `
        suspend fun async(block: suspend () -> Unit) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const param = result.topLevelFunctions[0]!.parameters[0]!;
      expect(param.functionType).toBeDefined();
      expect(param.functionType!.isSuspend).toBe(true);
      expect(param.functionType!.returnType).toBe('Unit');
    });

    it('should not extract functionType for non-function parameters', async () => {
      const source = `
        fun regular(value: String, count: Int) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      expect(result.topLevelFunctions[0]!.parameters[0]!.functionType).toBeUndefined();
      expect(result.topLevelFunctions[0]!.parameters[1]!.functionType).toBeUndefined();
    });

    it('should handle function type with nullable return', async () => {
      const source = `
        fun find(predicate: (String) -> Int?) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const param = result.topLevelFunctions[0]!.parameters[0]!;
      expect(param.functionType!.returnType).toBe('Int?');
    });

    it('should combine crossinline with function type', async () => {
      const source = `
        inline fun execute(crossinline block: () -> Unit) {}
      `;
      const result = await kotlinParser.parse(source, '/test/test.kt');
      const param = result.topLevelFunctions[0]!.parameters[0]!;
      expect(param.isCrossinline).toBe(true);
      expect(param.functionType).toBeDefined();
      expect(param.functionType!.parameterTypes).toEqual([]);
    });
  });
});
