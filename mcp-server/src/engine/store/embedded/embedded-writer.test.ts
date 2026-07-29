/**
 * EmbeddedWriter — write-method parity tests (LadybugDB, in-memory, no Docker).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmbeddedConnection } from './connection.js';
import { EmbeddedReader } from './embedded-reader.js';
import { EmbeddedWriter } from './embedded-writer.js';
import { fn, cls, emptyFile, callGraphFile } from './fixtures.js';

describe('EmbeddedWriter (LadybugDB)', () => {
  let cx: EmbeddedConnection;
  let reader: EmbeddedReader;
  let writer: EmbeddedWriter;

  beforeEach(async () => {
    cx = new EmbeddedConnection(); // in-memory
    await cx.open();
    writer = new EmbeddedWriter(cx);
    reader = new EmbeddedReader(cx);
    await writer.ensureSchema();
  });

  afterEach(async () => {
    await cx.close();
  });

  describe('clearGraph', () => {
    it('clears everything and reports deleted counts', async () => {
      await writer.writeFiles([callGraphFile]);

      const result = await writer.clearGraph();

      expect(result.nodesDeleted).toBeGreaterThan(0);
      expect(result.relationshipsDeleted).toBeGreaterThan(0);
      expect(await reader.getCallees({ functionName: 'foo', depth: 2 })).toEqual([]);
      expect(await reader.searchNodes({ query: 'Repo', match: 'contains' })).toEqual([]);
    });

    it('clears only the targeted project, leaving others intact', async () => {
      const fileA = emptyFile({
        packageName: 'a',
        classes: [cls('Alpha', '/projA/Alpha.kt', 1, [fn('am', '/projA/Alpha.kt', 2)])],
      });
      const fileB = emptyFile({
        packageName: 'b',
        classes: [cls('Beta', '/projB/Beta.kt', 1, [fn('bm', '/projB/Beta.kt', 2)])],
      });
      await writer.writeFiles([fileA], { projectPath: '/projA', projectName: 'A' });
      await writer.writeFiles([fileB], { projectPath: '/projB', projectName: 'B' });

      const result = await writer.clearGraph('/projA');

      expect(result.nodesDeleted).toBeGreaterThan(0); // Alpha + am + Project(/projA)
      expect(await reader.findProject('/projA/x')).toBeNull();
      expect(await reader.findProject('/projB/x')).toEqual({ path: '/projB', name: 'B' });
      expect(await reader.getFileSymbols({ filePath: '/projA/Alpha.kt' })).toEqual([]);
      expect((await reader.getFileSymbols({ filePath: '/projB/Beta.kt' })).length).toBeGreaterThan(0);
    });
  });
});
