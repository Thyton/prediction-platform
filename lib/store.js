// Persistent store. Postgres when DATABASE_URL exists, else local files (dev).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const FILE = path.join(process.cwd(), "data", "store.json");
const DB = process.env.DATABASE_URL;
const EMPTY = { users: [], waitlist: [], subs: [] };
const KEY = "tiplab.store.v1";

let pool;
let schemaReady = false;
let memCache = null;

async function db() {
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

async function ensureSchema() {
  if (schemaReady) return;
  const p = await db();
  await p.query(
    "create table if not exists app_state (k text primary key, v jsonb not null, updated_at timestamptz default now())"
  );
  schemaReady = true;
}

export async function read() {
  if (DB) {
    try {
      await ensureSchema();
      const p = await db();
      const r = await p.query("select v from app_state where k = $1", [KEY]);
      return { ...EMPTY, ...(r.rows[0]?.v || {}) };
    } catch {
      return { ...EMPTY, ...(memCache || {}) };
    }
  }
  if (memCache) return { ...EMPTY, ...memCache };
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...EMPTY };
  }
}

export async function write(data) {
  memCache = data;
  if (DB) {
    await ensureSchema();
    const p = await db();
    await p.query(
      `insert into app_state (k, v) values ($1, $2)
       on conflict (k) do update set v = excluded.v, updated_at = now()`,
      [KEY, JSON.stringify(data)]
    );
    return;
  }
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data));
  } catch {
    /* read-only fs: keep in memory */
  }
}

export function hash(pw) {
  return crypto.createHash("sha256").update(`tiplab:${pw}`).digest("hex");
}
