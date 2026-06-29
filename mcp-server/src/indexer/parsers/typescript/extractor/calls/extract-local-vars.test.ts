import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../../parser.js';
import { traverseNode } from '../ast-utils/index.js';
import { extractLocalVars } from './extract-local-vars.js';
import type { SyntaxNode } from 'tree-sitter';

/** Parse `code` and return the first statement_block (function body) node. */
function bodyOf(code: string): SyntaxNode {
  const tree = parseTypeScript(code, '/test.ts');
  let block: SyntaxNode | null = null;
  traverseNode(tree.rootNode, (node) => {
    if (node.type === 'statement_block' && !block) block = node;
  });
  if (!block) throw new Error('no statement_block found');
  return block;
}

describe('extractLocalVars', () => {
  it('captures explicit annotation: const x: T = …', () => {
    const vars = extractLocalVars(bodyOf(`function f() { const repo: JobOrderRepository = get(); }`));
    expect(vars).toEqual([{ name: 'repo', type: 'JobOrderRepository' }]);
  });

  it('captures new expression: const x = new Foo()', () => {
    const vars = extractLocalVars(bodyOf(`function f() { const svc = new UserService(); }`));
    expect(vars).toEqual([{ name: 'svc', type: 'UserService' }]);
  });

  it('captures as-assertion: const x = v as T', () => {
    const vars = extractLocalVars(bodyOf(`function f() { const u = raw as UserDto; }`));
    expect(vars).toEqual([{ name: 'u', type: 'UserDto' }]);
  });

  it('captures call initializer (return-type to resolve later): const x = foo()', () => {
    const vars = extractLocalVars(bodyOf(`function f() { const repo = makeRepo(); }`));
    expect(vars).toEqual([{ name: 'repo', initCall: { name: 'makeRepo', awaited: false } }]);
  });

  it('captures awaited call: const x = await foo()', () => {
    const vars = extractLocalVars(bodyOf(`async function f() { const order = await loadOrder(); }`));
    expect(vars).toEqual([{ name: 'order', initCall: { name: 'loadOrder', awaited: true } }]);
  });

  it('skips destructuring and member/chained-call initializers', () => {
    const vars = extractLocalVars(
      bodyOf(`function f() {
        const { a, b } = useThing();      // destructuring → skip
        const x = this.repo.find();        // member-call receiver → skip
        const y = a.b.c();                 // chained → skip
      }`)
    );
    expect(vars).toEqual([]);
  });

  it('annotation takes precedence over the initializer', () => {
    const vars = extractLocalVars(bodyOf(`function f() { const r: Repo = makeRepo(); }`));
    expect(vars).toEqual([{ name: 'r', type: 'Repo' }]);
  });
});
