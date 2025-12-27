import { describe, it, expect } from 'vitest';
import { resolveEnumStaticMethod } from './resolve-enum-static-method.js';

describe('resolveEnumStaticMethod', () => {
  const enumFqn = 'com.example.Role';

  describe('known enum methods', () => {
    it('should resolve valueOf method', () => {
      const result = resolveEnumStaticMethod(enumFqn, 'valueOf');
      expect(result).toBe('com.example.Role.valueOf');
    });

    it('should resolve values method', () => {
      const result = resolveEnumStaticMethod(enumFqn, 'values');
      expect(result).toBe('com.example.Role.values');
    });

    it('should resolve entries method (Kotlin 1.9+)', () => {
      const result = resolveEnumStaticMethod(enumFqn, 'entries');
      expect(result).toBe('com.example.Role.entries');
    });
  });

  describe('unknown methods', () => {
    it('should return undefined for unknown method', () => {
      const result = resolveEnumStaticMethod(enumFqn, 'unknownMethod');
      expect(result).toBeUndefined();
    });

    it('should return undefined for instance methods', () => {
      const result = resolveEnumStaticMethod(enumFqn, 'name');
      expect(result).toBeUndefined();
    });

    it('should return undefined for ordinal', () => {
      const result = resolveEnumStaticMethod(enumFqn, 'ordinal');
      expect(result).toBeUndefined();
    });
  });

  describe('different enum FQNs', () => {
    it('should work with simple enum name', () => {
      const result = resolveEnumStaticMethod('Status', 'valueOf');
      expect(result).toBe('Status.valueOf');
    });

    it('should work with deeply nested enum', () => {
      const result = resolveEnumStaticMethod('com.example.domain.user.UserStatus', 'values');
      expect(result).toBe('com.example.domain.user.UserStatus.values');
    });
  });
});
