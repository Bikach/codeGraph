import { describe, it, expect } from 'vitest';
import { selectBestOverload } from './select-best-overload.js';
import type { FunctionSymbol } from '../types.js';
import type { ParsedCall } from '../../types.js';

function createFunctionSymbol(name: string, parameterTypes: string[], fqn?: string): FunctionSymbol {
  return {
    name,
    fqn: fqn ?? `com.example.${name}`,
    kind: 'function',
    filePath: '/test/Test.kt',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    packageName: 'com.example',
    parameterTypes,
    isExtension: false,
  };
}

function createCall(argumentCount: number, argumentTypes?: string[]): ParsedCall {
  return {
    name: 'test',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 },
    argumentCount,
    argumentTypes,
  };
}

describe('selectBestOverload', () => {
  describe('edge cases', () => {
    it('should return undefined for empty candidates', () => {
      expect(selectBestOverload([])).toBeUndefined();
    });

    it('should return single candidate without call info', () => {
      const func = createFunctionSymbol('test', ['String']);
      expect(selectBestOverload([func])).toBe(func);
    });

    it('should return first candidate when no call info', () => {
      const func1 = createFunctionSymbol('test', ['String'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['Int'], 'com.example.test2');
      expect(selectBestOverload([func1, func2])).toBe(func1);
    });
  });

  describe('argument count selection', () => {
    it('should select overload with matching argument count', () => {
      const func1 = createFunctionSymbol('test', ['String'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['String', 'Int'], 'com.example.test2');
      const call = createCall(2);

      expect(selectBestOverload([func1, func2], call)).toBe(func2);
    });

    it('should prefer exact count match over partial', () => {
      const func1 = createFunctionSymbol('test', ['String', 'Int', 'Boolean'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['String', 'Int'], 'com.example.test2');
      const call = createCall(2);

      expect(selectBestOverload([func1, func2], call)).toBe(func2);
    });
  });

  describe('type-based selection', () => {
    it('should select overload with matching types', () => {
      const func1 = createFunctionSymbol('test', ['String'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['Int'], 'com.example.test2');
      const call = createCall(1, ['Int']);

      expect(selectBestOverload([func1, func2], call)).toBe(func2);
    });

    it('should prefer exact type match over compatible', () => {
      const func1 = createFunctionSymbol('test', ['Number'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['Int'], 'com.example.test2');
      const call = createCall(1, ['Int']);

      expect(selectBestOverload([func1, func2], call)).toBe(func2);
    });

    it('should select compatible type when no exact match', () => {
      const func1 = createFunctionSymbol('test', ['String'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['Number'], 'com.example.test2');
      const call = createCall(1, ['Int']);

      expect(selectBestOverload([func1, func2], call)).toBe(func2);
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to first candidate when all scores are negative', () => {
      const func1 = createFunctionSymbol('test', ['String'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['Int'], 'com.example.test2');
      const call = createCall(5, ['Boolean', 'Boolean', 'Boolean', 'Boolean', 'Boolean']);

      // Both have too many arguments, so all scores are -1
      expect(selectBestOverload([func1, func2], call)).toBe(func1);
    });

    it('should return unique count match when scores are negative', () => {
      const func1 = createFunctionSymbol('test', ['String', 'Int'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['Boolean'], 'com.example.test2');
      const call = createCall(1, ['Unknown']);

      // func2 has exact count match
      expect(selectBestOverload([func1, func2], call)).toBe(func2);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple matching overloads', () => {
      const func1 = createFunctionSymbol('test', ['String', 'Int'], 'com.example.test1');
      const func2 = createFunctionSymbol('test', ['String', 'Number'], 'com.example.test2');
      const call = createCall(2, ['String', 'Int']);

      // func1 should win because Int matches Int exactly, while func2 has compatible match
      expect(selectBestOverload([func1, func2], call)).toBe(func1);
    });
  });
});
