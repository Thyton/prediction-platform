import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { read, write, hash } from "../../../../lib/store";
import { consume } from "../../../../lib/reset";

export async function POST(req) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) {
    return NextResponse.json({ error: "Token and new password required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  }
  const email = await consume(token);
  if (!email) {
    return NextResponse.json({ error: "That link has expired or was already used." }, { status: 400 });
  }
  const db = await read();
  const user = db.users.find((u) => u.email === email);
  if (!user) return NextResponse.json({ error: "Account missing." }, { status: 404 });

  user.pw = hash(password);
  user.sessions = []; // a reset signs out everywhere else
  const sid = crypto.randomBytes(24).toString("hex");
  user.sessions.push(sid);
  await write(db);

  const jar = await cookies();
  jar.set("sid", sid, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
