import { describe, it, expect } from 'vitest';
import { normalizeType } from './normalize-type.js';

describe('normalizeType', () => {
  it('should return simple type unchanged', () => {
    expect(normalizeType('String')).toBe('String');
    expect(normalizeType('Int')).toBe('Int');
    expect(normalizeType('User')).toBe('User');
  });

  it('should strip generic parameters', () => {
    expect(normalizeType('List<String>')).toBe('List');
    expect(normalizeType('Map<String, Int>')).toBe('Map');
    expect(normalizeType('Pair<User, Role>')).toBe('Pair');
  });

  it('should strip nullability marker', () => {
    expect(normalizeType('String?')).toBe('String');
    expect(normalizeType('Int?')).toBe('Int');
    expect(normalizeType('User?')).toBe('User');
  });

  it('should strip both generics and nullability', () => {
    expect(normalizeType('List<String>?')).toBe('List');
    expect(normalizeType('Map<String, Int>?')).toBe('Map');
  });

  it('should handle nested generics', () => {
    expect(normalizeType('List<List<String>>')).toBe('List');
    expect(normalizeType('Map<String, List<Int>>')).toBe('Map');
  });

  it('should trim whitespace', () => {
    expect(normalizeType(' String ')).toBe('String');
    expect(normalizeType('List< String >')).toBe('List');
  });

  it('should handle empty string', () => {
    expect(normalizeType('')).toBe('');
  });
});
