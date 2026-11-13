// The STATS Durable Object namespace on this machine: the real Stats class (booking/stats.js) on an
// in-memory SQLite database (node:sqlite), behind the same `sql.exec(query, ...bindings)` call
// Cloudflare gives a SQLite-backed Durable Object.
import { DatabaseSync } from 'node:sqlite';
import { Stats } from '../stats.js';

export function fakeStats() {
  const db = new DatabaseSync(':memory:');
  const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() });
  const sql = {
    exec(query, ...bindings) {
      const st = db.prepare(query);
      if (/^\s*(select|with)\b/i.test(query)) return cursor(st.all(...bindings).map((r) => ({ ...r })));
      st.run(...bindings);
      return cursor([]);
    },
  };
  const object = new Stats({ storage: { sql } });
  return {
    db,
    idFromName: (name) => name,
    get: () => ({ fetch: (input, init) => object.fetch(input instanceof Request ? input : new Request(input, init)) }),
  };
}
