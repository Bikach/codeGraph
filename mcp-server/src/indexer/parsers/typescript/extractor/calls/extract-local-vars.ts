/**
 * Local variable type extraction for TypeScript parsing.
 *
 * Walks a function body and captures `const/let/var x = …` declarations whose static type lets the
 * resolver resolve later calls on the variable (`const repo = makeRepo(); repo.find()`). Mirrors the
 * traversal of `extractCalls` (same scoping: declarations in nested closures are attributed to the
 * enclosing function, exactly like calls are).
 *
 * Captured (first cut):
 *  - explicit annotation `const x: T = …`           → { name, type: 'T' }
 *  - `const x = new Foo()` / `const x = expr as T`   → { name, type } (via inferExpressionType)
 *  - `const x = foo()` / `const x = await foo()`     → { name, initCall: { name:'foo', awaited } }
 *    (callee must be a SIMPLE identifier — `a.b()`, chained calls, etc. are skipped)
 *
 * Skipped: destructuring (`const {a} = …`), member/chained-call initializers, anything not inferable.
 */

import type { SyntaxNode } from 'tree-sitter';
import type { ParsedLocalVar } from '../../../../types.js';
import { traverseNode, findChildByType, extractFullTypeName, findInitializer } from '../ast-utils/index.js';
import { inferExpressionType } from './type-inference/index.js';

export function extractLocalVars(body: SyntaxNode): ParsedLocalVar[] {
  const localVars: ParsedLocalVar[] = [];

  traverseNode(body, (node) => {
    if (node.type !== 'variable_declarator') return;

    // Simple binding only — skip destructuring (`const {a} = …` / `const [a] = …`).
    const nameNode = node.children[0];
    if (!nameNode || nameNode.type !== 'identifier') return;
    const name = nameNode.text;

    // Explicit annotation wins: `const x: T = …`.
    const annotatedType = extractFullTypeName(findChildByType(node, 'type_annotation'));
    if (annotatedType) {
      localVars.push({ name, type: annotatedType });
      return;
    }

    const init = findInitializer(node);
    if (!init) return;

    // Unwrap `await <expr>`.
    let expr = init;
    let awaited = false;
    if (expr.type === 'await_expression') {
      awaited = true;
      expr = expr.children.find((c) => c.type !== 'await') ?? expr;
    }

    if (expr.type === 'call_expression') {
      // `const x = foo()` — only a simple-identifier callee; the var's type is foo's return type.
      const callee = expr.children[0];
      if (callee?.type === 'identifier') {
        localVars.push({ name, initCall: { name: callee.text, awaited } });
      }
      return;
    }

    // `const x = new Foo()` / `const x = expr as T` / literals → type known at parse time.
    const inferred = inferExpressionType(expr);
    if (inferred && inferred !== 'unknown') {
      localVars.push({ name, type: inferred });
    }
  });

  return localVars;
}
