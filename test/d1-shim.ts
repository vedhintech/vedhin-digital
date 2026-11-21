// Minimal D1 emulation over better-sqlite3 for tests only.
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

class Stmt {
  private params: unknown[] = [];
  constructor(private db: Database.Database, private sql: string) {}
  bind(...p: unknown[]) {
    this.params = p;
    return this;
  }
  async first<T>() {
    return (this.db.prepare(this.sql).get(...this.params) as T) ?? null;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params) };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: r.changes } };
  }
}

export function makeDb() {
  const db = new Database(":memory:");
  const dir = resolve(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) db.exec(readFileSync(resolve(dir, f), "utf8"));
  return {
    raw: db,
    d1: { prepare: (sql: string) => new Stmt(db, sql) } as unknown as D1Database,
  };
}
