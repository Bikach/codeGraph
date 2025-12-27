import { describe, it, expect } from 'vitest';
import { scoreOverloadMatch } from './score-overload-match.js';
import type { FunctionSymbol } from '../types.js';

function createFunctionSymbol(name: string, parameterTypes: string[]): FunctionSymbol {
  return {
    name,
    fqn: `com.example.${name}`,
    kind: 'function',
    filePath: '/test/Test.kt',
    location: { filePath: '/test/Test.kt', startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
    packageName: 'com.example',
    parameterTypes,
    isExtension: false,
  };
}

describe('scoreOverloadMatch', () => {
  describe('argument count scoring', () => {
    it('should give 100 points for exact argument count match', () => {
      const func = createFunctionSymbol('test', ['String', 'Int']);
      const score = scoreOverloadMatch(func, 2, []);
      expect(score).toBe(100);
    });

    it('should return -1 when too many arguments', () => {
      const func = createFunctionSymbol('test', ['String']);
      const score = scoreOverloadMatch(func, 3, []);
      expect(score).toBe(-1);
    });

    it('should give 50 points for fewer arguments (default params)', () => {
      const func = createFunctionSymbol('test', ['String', 'Int', 'Boolean']);
      const score = scoreOverloadMatch(func, 1, []);
      expect(score).toBe(50);
    });
  });

  describe('type matching scoring', () => {
    it('should give 50 points for exact type match', () => {
      const func = createFunctionSymbol('test', ['String']);
      const score = scoreOverloadMatch(func, 1, ['String']);
      expect(score).toBe(100 + 50); // 100 for count + 50 for exact type
    });

    it('should give 25 points for compatible type', () => {
      const func = createFunctionSymbol('test', ['Number']);
      const score = scoreOverloadMatch(func, 1, ['Int']);
      expect(score).toBe(100 + 25); // 100 for count + 25 for compatible type
    });

    it('should subtract 10 points for type mismatch', () => {
      const func = createFunctionSymbol('test', ['String']);
      const score = scoreOverloadMatch(func, 1, ['Int']);
      expect(score).toBe(100 - 10); // 100 for count - 10 for mismatch
    });

    it('should not score Unknown types', () => {
      const func = createFunctionSymbol('test', ['String']);
      const score = scoreOverloadMatch(func, 1, ['Unknown']);
      expect(score).toBe(100); // Only count match, no type scoring
    });

    it('should handle multiple arguments', () => {
      const func = createFunctionSymbol('test', ['String', 'Int', 'Boolean']);
      const score = scoreOverloadMatch(func, 3, ['String', 'Int', 'Boolean']);
      expect(score).toBe(100 + 50 + 50 + 50); // count + 3 exact matches
    });

    it('should handle mixed type matches', () => {
      const func = createFunctionSymbol('test', ['String', 'Number']);
      const score = scoreOverloadMatch(func, 2, ['String', 'Int']);
      expect(score).toBe(100 + 50 + 25); // count + exact + compatible
    });
  });

  describe('generic and nullable types', () => {
    it('should normalize generic types for comparison', () => {
      const func = createFunctionSymbol('test', ['List<String>']);
      const score = scoreOverloadMatch(func, 1, ['List<Int>']);
      expect(score).toBe(100 + 50); // Both normalize to List
    });

    it('should normalize nullable types for comparison', () => {
      const func = createFunctionSymbol('test', ['String?']);
      const score = scoreOverloadMatch(func, 1, ['String']);
      expect(score).toBe(100 + 50); // Both normalize to String
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameter list', () => {
      const func = createFunctionSymbol('test', []);
      const score = scoreOverloadMatch(func, 0, []);
      expect(score).toBe(100);
    });

    it('should handle empty argTypes array', () => {
      const func = createFunctionSymbol('test', ['String', 'Int']);
      const score = scoreOverloadMatch(func, 2, []);
      expect(score).toBe(100); // Only count match, no type info
    });
  });
});
