import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import {
  extractObjectExpression,
  isObjectExpression,
  findObjectExpressions,
} from './extract-object-expression.js';

/**
 * Helper to parse TypeScript and get the first object literal node
 */
function parseObjectExpression(source: string): ReturnType<typeof extractObjectExpression> {
  const tree = parseTypeScript(source, '/test/example.ts');
  const objects = findObjectExpressions(tree.rootNode);
  if (objects.length === 0) {
    throw new Error('No object expression found in source');
  }
  return extractObjectExpression(objects[0]!);
}

describe('extractObjectExpression', () => {
  describe('basic structure', () => {
    it('should extract empty object', () => {
      const result = parseObjectExpression('const obj = {};');

      expect(result.superTypes).toEqual([]);
      expect(result.properties).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.location).toBeDefined();
    });

    it('should set superTypes to empty array (TypeScript has no object implementation)', () => {
      const result = parseObjectExpression('const obj = { foo: 1 };');

      expect(result.superTypes).toEqual([]);
    });
  });

  describe('standard properties', () => {
    it('should extract single property', () => {
      const result = parseObjectExpression('const obj = { name: "John" };');

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('name');
      expect(result.properties[0]!.initializer).toBe('"John"');
      expect(result.properties[0]!.visibility).toBe('public');
      expect(result.properties[0]!.isVal).toBe(true);
    });

    it('should extract multiple properties', () => {
      const result = parseObjectExpression(`
        const obj = {
          name: "John",
          age: 30,
          active: true
        };
      `);

      expect(result.properties).toHaveLength(3);
      expect(result.properties.map((p) => p.name)).toEqual(['name', 'age', 'active']);
    });

    it('should extract number property', () => {
      const result = parseObjectExpression('const obj = { count: 42 };');

      expect(result.properties[0]!.name).toBe('count');
      expect(result.properties[0]!.initializer).toBe('42');
    });

    it('should extract boolean property', () => {
      const result = parseObjectExpression('const obj = { enabled: true };');

      expect(result.properties[0]!.name).toBe('enabled');
      expect(result.properties[0]!.initializer).toBe('true');
    });

    it('should extract null property', () => {
      const result = parseObjectExpression('const obj = { data: null };');

      expect(result.properties[0]!.name).toBe('data');
      expect(result.properties[0]!.initializer).toBe('null');
    });

    it('should extract array property', () => {
      const result = parseObjectExpression('const obj = { items: [1, 2, 3] };');

      expect(result.properties[0]!.name).toBe('items');
      expect(result.properties[0]!.initializer).toBe('[1, 2, 3]');
    });
  });

  describe('shorthand properties', () => {
    it('should extract single shorthand property', () => {
      const result = parseObjectExpression(`
        const name = "John";
        const obj = { name };
      `);

      // Find the object with shorthand property
      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('name');
      expect(result.properties[0]!.initializer).toBe('name');
    });

    it('should extract multiple shorthand properties', () => {
      const result = parseObjectExpression(`
        const a = 1, b = 2;
        const obj = { a, b };
      `);

      expect(result.properties).toHaveLength(2);
      expect(result.properties[0]!.name).toBe('a');
      expect(result.properties[1]!.name).toBe('b');
    });

    it('should handle mixed shorthand and standard properties', () => {
      const result = parseObjectExpression(`
        const id = 1;
        const obj = { id, name: "test" };
      `);

      expect(result.properties).toHaveLength(2);
      expect(result.properties[0]!.name).toBe('id');
      expect(result.properties[0]!.initializer).toBe('id');
      expect(result.properties[1]!.name).toBe('name');
      expect(result.properties[1]!.initializer).toBe('"test"');
    });
  });

  describe('string key properties', () => {
    it('should extract property with string key', () => {
      const result = parseObjectExpression('const obj = { "my-key": 123 };');

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('my-key');
    });

    it('should extract property with single quote string key', () => {
      const result = parseObjectExpression("const obj = { 'other-key': 456 };");

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('other-key');
    });
  });

  describe('computed properties', () => {
    it('should extract property with computed key', () => {
      const result = parseObjectExpression('const obj = { [Symbol.iterator]: function* () {} };');

      // Computed properties should include the brackets
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('[Symbol.iterator]');
    });

    it('should extract property with variable computed key', () => {
      const result = parseObjectExpression(`
        const key = "dynamic";
        const obj = { [key]: "value" };
      `);

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('[key]');
    });
  });

  describe('method definitions', () => {
    it('should extract method definition', () => {
      const result = parseObjectExpression(`
        const obj = {
          greet() {
            console.log("Hello");
          }
        };
      `);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('greet');
      expect(result.properties).toHaveLength(0);
    });

    it('should extract method with parameters', () => {
      const result = parseObjectExpression(`
        const obj = {
          add(a: number, b: number) {
            return a + b;
          }
        };
      `);

      expect(result.functions[0]!.name).toBe('add');
      expect(result.functions[0]!.parameters).toHaveLength(2);
      expect(result.functions[0]!.parameters[0]!.name).toBe('a');
      expect(result.functions[0]!.parameters[1]!.name).toBe('b');
    });

    it('should extract method with return type', () => {
      const result = parseObjectExpression(`
        const obj = {
          getValue(): string {
            return "value";
          }
        };
      `);

      expect(result.functions[0]!.returnType).toBe('string');
    });

    it('should extract async method', () => {
      const result = parseObjectExpression(`
        const obj = {
          async fetchData() {
            return await fetch('/api');
          }
        };
      `);

      expect(result.functions[0]!.name).toBe('fetchData');
      expect(result.functions[0]!.isSuspend).toBe(true);
    });

    it('should extract getter method', () => {
      const result = parseObjectExpression(`
        const obj = {
          get value() {
            return this._value;
          }
        };
      `);

      expect(result.functions[0]!.name).toBe('get value');
    });

    it('should extract setter method', () => {
      const result = parseObjectExpression(`
        const obj = {
          set value(v: number) {
            this._value = v;
          }
        };
      `);

      expect(result.functions[0]!.name).toBe('set value');
      expect(result.functions[0]!.parameters).toHaveLength(1);
    });
  });

  describe('arrow function properties', () => {
    it('should extract arrow function property', () => {
      const result = parseObjectExpression(`
        const obj = {
          onClick: () => {
            console.log("clicked");
          }
        };
      `);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('onClick');
      expect(result.properties).toHaveLength(0);
    });

    it('should extract arrow function with parameters', () => {
      const result = parseObjectExpression(`
        const obj = {
          calculate: (x: number, y: number) => x + y
        };
      `);

      expect(result.functions[0]!.name).toBe('calculate');
      expect(result.functions[0]!.parameters).toHaveLength(2);
    });

    it('should extract arrow function with return type', () => {
      const result = parseObjectExpression(`
        const obj = {
          getMessage: (): string => "hello"
        };
      `);

      expect(result.functions[0]!.returnType).toBe('string');
    });

    it('should extract async arrow function', () => {
      const result = parseObjectExpression(`
        const obj = {
          loadData: async () => {
            return await fetch('/api');
          }
        };
      `);

      expect(result.functions[0]!.name).toBe('loadData');
      expect(result.functions[0]!.isSuspend).toBe(true);
    });

    it('should extract arrow function with single parameter without parens', () => {
      const result = parseObjectExpression(`
        const obj = {
          double: x => x * 2
        };
      `);

      expect(result.functions[0]!.name).toBe('double');
      expect(result.functions[0]!.parameters).toHaveLength(1);
      expect(result.functions[0]!.parameters[0]!.name).toBe('x');
    });
  });

  describe('function expression properties', () => {
    it('should extract function expression property', () => {
      const result = parseObjectExpression(`
        const obj = {
          handler: function() {
            console.log("handled");
          }
        };
      `);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('handler');
    });

    it('should extract async function expression', () => {
      const result = parseObjectExpression(`
        const obj = {
          fetch: async function() {
            return await getData();
          }
        };
      `);

      expect(result.functions[0]!.isSuspend).toBe(true);
    });
  });

  describe('mixed content', () => {
    it('should correctly separate properties from methods', () => {
      const result = parseObjectExpression(`
        const handler = {
          name: 'handler',
          onClick() { console.log('clicked'); },
          onHover: () => { console.log('hovered'); }
        };
      `);

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('name');
      expect(result.functions).toHaveLength(2);
      expect(result.functions.map((f) => f.name)).toContain('onClick');
      expect(result.functions.map((f) => f.name)).toContain('onHover');
    });

    it('should handle complex object with all property types', () => {
      const result = parseObjectExpression(`
        const id = 1;
        const config = {
          id,
          name: "test",
          "special-key": true,
          getValue() { return 42; },
          process: (data: string) => data.toUpperCase(),
          handler: function(e: Event) { return e; }
        };
      `);

      expect(result.properties).toHaveLength(3); // id (shorthand), name, special-key
      expect(result.functions).toHaveLength(3); // getValue, process, handler
    });
  });

  describe('nested objects', () => {
    it('should extract only top-level object when parsing top object', () => {
      const source = `
        const obj = {
          nested: {
            inner: "value"
          }
        };
      `;
      const tree = parseTypeScript(source, '/test/example.ts');
      const objects = findObjectExpressions(tree.rootNode);

      // findObjectExpressions should find both objects
      expect(objects.length).toBe(2);
    });

    it('should extract nested object properties as initializer', () => {
      const result = parseObjectExpression(`
        const obj = {
          config: { timeout: 5000 }
        };
      `);

      expect(result.properties).toHaveLength(1);
      expect(result.properties[0]!.name).toBe('config');
      expect(result.properties[0]!.initializer).toContain('timeout');
    });
  });

  describe('location tracking', () => {
    it('should include location for object expression', () => {
      const result = parseObjectExpression('const obj = { x: 1 };');

      expect(result.location).toBeDefined();
      expect(result.location.startLine).toBeGreaterThanOrEqual(1);
      expect(result.location.endLine).toBeGreaterThanOrEqual(1);
    });

    it('should include location for properties', () => {
      const result = parseObjectExpression('const obj = { x: 1 };');

      expect(result.properties[0]!.location).toBeDefined();
    });

    it('should include location for methods', () => {
      const result = parseObjectExpression('const obj = { fn() {} };');

      expect(result.functions[0]!.location).toBeDefined();
    });
  });
});

describe('isObjectExpression', () => {
  it('should return true for object node', () => {
    const tree = parseTypeScript('const obj = {};', '/test/example.ts');
    const objects = findObjectExpressions(tree.rootNode);

    expect(objects).toHaveLength(1);
    expect(isObjectExpression(objects[0]!)).toBe(true);
  });

  it('should return false for non-object node', () => {
    const tree = parseTypeScript('const x = 1;', '/test/example.ts');
    const root = tree.rootNode;

    expect(isObjectExpression(root)).toBe(false);
  });
});

describe('findObjectExpressions', () => {
  it('should find single object expression', () => {
    const tree = parseTypeScript('const obj = { x: 1 };', '/test/example.ts');
    const objects = findObjectExpressions(tree.rootNode);

    expect(objects).toHaveLength(1);
  });

  it('should find multiple object expressions', () => {
    const tree = parseTypeScript(`
      const a = { x: 1 };
      const b = { y: 2 };
      const c = { z: 3 };
    `, '/test/example.ts');
    const objects = findObjectExpressions(tree.rootNode);

    expect(objects).toHaveLength(3);
  });

  it('should find nested object expressions', () => {
    const tree = parseTypeScript(`
      const obj = {
        outer: {
          inner: {
            deep: 1
          }
        }
      };
    `, '/test/example.ts');
    const objects = findObjectExpressions(tree.rootNode);

    expect(objects).toHaveLength(3); // outer object + inner + deep
  });

  it('should return empty array when no objects', () => {
    const tree = parseTypeScript('const x = 1;', '/test/example.ts');
    const objects = findObjectExpressions(tree.rootNode);

    expect(objects).toHaveLength(0);
  });
});
