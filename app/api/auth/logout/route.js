import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { read, write } from "../../../../lib/store";
import { currentUser } from "../../../../lib/session";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("sid")?.value;
  if (token) {
    const db = await read();
    const u = db.users.find((x) => (x.sessions || []).includes(token));
    if (u) {
      u.sessions = u.sessions.filter((t) => t !== token);
      await write(db);
    }
  }
  jar.delete("sid");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const u = await currentUser();
  return NextResponse.json({ user: u ? { email: u.email, pro: u.pro } : null });
}
