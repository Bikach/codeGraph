import { describe, it, expect } from 'vitest';
import { isTypeCompatible } from './is-type-compatible.js';

describe('isTypeCompatible', () => {
  describe('same type', () => {
    it('should return true for identical types', () => {
      expect(isTypeCompatible('String', 'String')).toBe(true);
      expect(isTypeCompatible('Int', 'Int')).toBe(true);
      expect(isTypeCompatible('User', 'User')).toBe(true);
    });
  });

  describe('Nothing type', () => {
    it('should be compatible with any type', () => {
      expect(isTypeCompatible('Nothing', 'String')).toBe(true);
      expect(isTypeCompatible('Nothing', 'Int')).toBe(true);
      expect(isTypeCompatible('Nothing', 'Any')).toBe(true);
    });
  });

  describe('numeric hierarchy', () => {
    it('should allow Byte to widen to larger numeric types', () => {
      expect(isTypeCompatible('Byte', 'Short')).toBe(true);
      expect(isTypeCompatible('Byte', 'Int')).toBe(true);
      expect(isTypeCompatible('Byte', 'Long')).toBe(true);
      expect(isTypeCompatible('Byte', 'Float')).toBe(true);
      expect(isTypeCompatible('Byte', 'Double')).toBe(true);
      expect(isTypeCompatible('Byte', 'Number')).toBe(true);
    });

    it('should allow Int to widen to larger numeric types', () => {
      expect(isTypeCompatible('Int', 'Long')).toBe(true);
      expect(isTypeCompatible('Int', 'Float')).toBe(true);
      expect(isTypeCompatible('Int', 'Double')).toBe(true);
      expect(isTypeCompatible('Int', 'Number')).toBe(true);
    });

    it('should not allow narrowing conversions', () => {
      expect(isTypeCompatible('Int', 'Byte')).toBe(false);
      expect(isTypeCompatible('Long', 'Int')).toBe(false);
      expect(isTypeCompatible('Double', 'Float')).toBe(false);
    });

    it('should not allow Int to Short', () => {
      expect(isTypeCompatible('Int', 'Short')).toBe(false);
    });
  });

  describe('Any type', () => {
    it('should accept all types', () => {
      expect(isTypeCompatible('String', 'Any')).toBe(true);
      expect(isTypeCompatible('Int', 'Any')).toBe(true);
      expect(isTypeCompatible('User', 'Any')).toBe(true);
      expect(isTypeCompatible('List', 'Any')).toBe(true);
    });
  });

  describe('CharSequence', () => {
    it('should accept String', () => {
      expect(isTypeCompatible('String', 'CharSequence')).toBe(true);
    });

    it('should not accept other types', () => {
      expect(isTypeCompatible('Int', 'CharSequence')).toBe(false);
    });
  });

  describe('Collection hierarchy', () => {
    it('should allow Collection to Iterable', () => {
      expect(isTypeCompatible('Collection', 'Iterable')).toBe(true);
      expect(isTypeCompatible('Collection', 'Any')).toBe(true);
    });
  });

  describe('incompatible types', () => {
    it('should return false for unrelated types', () => {
      expect(isTypeCompatible('String', 'Int')).toBe(false);
      expect(isTypeCompatible('User', 'Admin')).toBe(false);
      expect(isTypeCompatible('List', 'Map')).toBe(false);
    });
  });

  describe('TypeScript types', () => {
    describe('any type', () => {
      it('should accept all types', () => {
        expect(isTypeCompatible('number', 'any')).toBe(true);
        expect(isTypeCompatible('string', 'any')).toBe(true);
        expect(isTypeCompatible('boolean', 'any')).toBe(true);
        expect(isTypeCompatible('CustomType', 'any')).toBe(true);
      });

      it('should be assignable to all types', () => {
        expect(isTypeCompatible('any', 'number')).toBe(true);
        expect(isTypeCompatible('any', 'string')).toBe(true);
        expect(isTypeCompatible('any', 'CustomType')).toBe(true);
      });
    });

    describe('unknown type', () => {
      it('should accept all types', () => {
        expect(isTypeCompatible('number', 'unknown')).toBe(true);
        expect(isTypeCompatible('string', 'unknown')).toBe(true);
        expect(isTypeCompatible('CustomType', 'unknown')).toBe(true);
      });

      it('should not be directly assignable to other types', () => {
        expect(isTypeCompatible('unknown', 'number')).toBe(false);
        expect(isTypeCompatible('unknown', 'string')).toBe(false);
      });
    });

    describe('never type', () => {
      it('should be assignable to all types', () => {
        expect(isTypeCompatible('never', 'number')).toBe(true);
        expect(isTypeCompatible('never', 'string')).toBe(true);
        expect(isTypeCompatible('never', 'CustomType')).toBe(true);
      });
    });

    describe('void and undefined', () => {
      it('should be compatible with each other', () => {
        expect(isTypeCompatible('void', 'undefined')).toBe(true);
        expect(isTypeCompatible('undefined', 'void')).toBe(true);
      });

      it('should be assignable to any/unknown', () => {
        expect(isTypeCompatible('void', 'any')).toBe(true);
        expect(isTypeCompatible('undefined', 'any')).toBe(true);
        expect(isTypeCompatible('void', 'unknown')).toBe(true);
      });
    });

    describe('primitive types', () => {
      it('should be compatible with same type', () => {
        expect(isTypeCompatible('number', 'number')).toBe(true);
        expect(isTypeCompatible('string', 'string')).toBe(true);
        expect(isTypeCompatible('boolean', 'boolean')).toBe(true);
      });

      it('should not be compatible with different primitive types', () => {
        expect(isTypeCompatible('number', 'string')).toBe(false);
        expect(isTypeCompatible('string', 'boolean')).toBe(false);
        expect(isTypeCompatible('boolean', 'number')).toBe(false);
      });
    });

    describe('null type', () => {
      it('should be assignable to any/unknown', () => {
        expect(isTypeCompatible('null', 'any')).toBe(true);
        expect(isTypeCompatible('null', 'unknown')).toBe(true);
      });

      it('should not be assignable to primitives', () => {
        expect(isTypeCompatible('null', 'number')).toBe(false);
        expect(isTypeCompatible('null', 'string')).toBe(false);
      });
    });
  });
});
