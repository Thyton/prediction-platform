import { read, write, hash } from "./store";
import crypto from "node:crypto";

const TTL_MIN = 30;

export function tokenHash(raw) {
  return crypto.createHash("sha256").update(`tiplab-reset:${raw}`).digest("hex");
}

// Store only the hash, so a leaked database doesn't yield working links.
export async function issue(email) {
  const raw = crypto.randomBytes(32).toString("hex");
  const db = await read();
  const now = Date.now();
  db.resets = (db.resets || [])
    .filter((r) => r.exp > now)
    .slice(-20)
    .concat({ h: tokenHash(raw), email, exp: now + TTL_MIN * 60000 });
  await write(db);
  return raw;
}

export async function consume(raw) {
  const h = tokenHash(raw);
  const db = await read();
  const now = Date.now();
  const hit = (db.resets || []).find((r) => r.h === h && r.exp > now);
  if (!hit) return null;
  db.resets = (db.resets || []).filter((r) => r.h !== h); // single use
  await write(db);
  return hit.email;
}

export { TTL_MIN };
