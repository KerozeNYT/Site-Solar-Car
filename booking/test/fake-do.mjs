// A Durable Object namespace on this machine: the real class on an in-memory SQLite database
// (node:sqlite), behind the same `sql.exec(query, ...bindings)` call Cloudflare gives a
// SQLite-backed Durable Object (like fake-stats.mjs, for any class).
import { DatabaseSync } from 'node:sqlite';

export function fakeDO(Class) {
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
  const object = new Class({ storage: { sql } });
  return {
    db,
    idFromName: (name) => name,
    get: () => ({ fetch: (input, init) => object.fetch(input instanceof Request ? input : new Request(input, init)) }),
  };
}
