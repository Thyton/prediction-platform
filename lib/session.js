import { cookies } from "next/headers";
import { read } from "./store";

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get("sid")?.value;
  if (!token) return null;
  const db = await read();
  return db.users.find((u) => (u.sessions || []).includes(token)) || null;
}
