/**
 * EmbeddedWriter.ensureSchema — migration parity tests (LadybugDB, in-memory, no Docker).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmbeddedConnection } from './connection.js';
import { EmbeddedReader } from './embedded-reader.js';
import { EmbeddedWriter } from './embedded-writer.js';
import { callGraphFile } from './fixtures.js';

describe('EmbeddedWriter schema (LadybugDB)', () => {
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

  describe('ensureSchema (migration)', () => {
    it('is idempotent — a second call keeps existing data (version matches, no drop)', async () => {
      await writer.writeFiles([callGraphFile]);
      await writer.ensureSchema(); // same SCHEMA_VERSION → must NOT drop the data
      const callees = await reader.getCallees({ functionName: 'foo', depth: 2 });
      expect(callees.length).toBeGreaterThan(0);
    });
  });
});
