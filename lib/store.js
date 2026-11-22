// Persistent store. Vercel Blob when configured, else local files (dev).
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "store.json");
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const EMPTY = { users: [], waitlist: [], subs: [] };

async function blobUrl() {
  return process.env.BLOB_STORE_URL || null;
}

export async function read() {
  if (USE_BLOB) {
    try {
      const r = await fetch(blobUrl(), { cache: "no-store" });
      if (r.ok) return { ...EMPTY, ...(await r.json()) };
    } catch {}
    return { ...EMPTY };
  }
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...EMPTY };
  }
}

export async function write(db) {
  const body = JSON.stringify(db);
  if (USE_BLOB) {
    await fetch(blobUrl(), {
      method: "PUT",
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`, "x-add-random-suffix": "0" },
      body,
    });
    return;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, body);
}

export function hash(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) | 0;
  return String(h);
}
