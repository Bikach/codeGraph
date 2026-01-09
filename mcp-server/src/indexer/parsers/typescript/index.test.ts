import { describe, it, expect } from 'vitest';
import { typescriptParser, javascriptParser } from './index.js';
import { getParserForFile } from '../registry.js';

describe('typescriptParser', () => {
  it('should have correct language identifier', () => {
    expect(typescriptParser.language).toBe('typescript');
  });

  it('should handle .ts and .tsx extensions', () => {
    expect(typescriptParser.extensions).toContain('.ts');
    expect(typescriptParser.extensions).toContain('.tsx');
  });

  it('should parse empty file', async () => {
    const result = await typescriptParser.parse('', '/test.ts');
    expect(result.language).toBe('typescript');
    expect(result.filePath).toBe('/test.ts');
  });

  it('should parse empty tsx file', async () => {
    const result = await typescriptParser.parse('', '/test.tsx');
    expect(result.language).toBe('typescript');
    expect(result.filePath).toBe('/test.tsx');
  });

  it('should return empty arrays for stub extractor', async () => {
    const result = await typescriptParser.parse('const x = 1;', '/test.ts');
    expect(result.imports).toEqual([]);
    expect(result.classes).toEqual([]);
    expect(result.topLevelFunctions).toEqual([]);
    expect(result.topLevelProperties).toEqual([]);
    expect(result.typeAliases).toEqual([]);
  });
});

describe('javascriptParser', () => {
  it('should have correct language identifier', () => {
    expect(javascriptParser.language).toBe('javascript');
  });

  it('should handle JS extensions', () => {
    expect(javascriptParser.extensions).toContain('.js');
    expect(javascriptParser.extensions).toContain('.jsx');
    expect(javascriptParser.extensions).toContain('.mjs');
    expect(javascriptParser.extensions).toContain('.cjs');
  });

  it('should parse empty file with javascript language', async () => {
    const result = await javascriptParser.parse('', '/test.js');
    expect(result.language).toBe('javascript');
    expect(result.filePath).toBe('/test.js');
  });

  it('should parse empty jsx file', async () => {
    const result = await javascriptParser.parse('', '/test.jsx');
    expect(result.language).toBe('javascript');
    expect(result.filePath).toBe('/test.jsx');
  });

  it('should parse mjs file', async () => {
    const result = await javascriptParser.parse('', '/test.mjs');
    expect(result.language).toBe('javascript');
  });

  it('should parse cjs file', async () => {
    const result = await javascriptParser.parse('', '/test.cjs');
    expect(result.language).toBe('javascript');
  });
});

describe('registry integration', () => {
  it('should return TypeScript parser for .ts files', async () => {
    const parser = await getParserForFile('/test.ts');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe('typescript');
  });

  it('should return TypeScript parser for .tsx files', async () => {
    const parser = await getParserForFile('/test.tsx');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe('typescript');
  });

  it('should return JavaScript parser for .js files', async () => {
    const parser = await getParserForFile('/test.js');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe('javascript');
  });

  it('should return JavaScript parser for .jsx files', async () => {
    const parser = await getParserForFile('/test.jsx');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe('javascript');
  });

  it('should return JavaScript parser for .mjs files', async () => {
    const parser = await getParserForFile('/test.mjs');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe('javascript');
  });

  it('should return JavaScript parser for .cjs files', async () => {
    const parser = await getParserForFile('/test.cjs');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe('javascript');
  });
});
