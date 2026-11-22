import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { read, write, hash } from "../../../../lib/store";

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  const db = await read();
  let user = db.users.find((u) => u.email === clean);
  if (!user) {
    user = { id: crypto.randomUUID(), email: clean, pw: hash(password), pro: false, created: new Date().toISOString() };
    db.users.push(user);
    await write(db);
  } else if (user.pw !== hash(password)) {
    return NextResponse.json({ error: "Wrong password for that email." }, { status: 401 });
  }
  const token = crypto.randomBytes(24).toString("hex");
  user.sessions = [...(user.sessions || []).slice(-4), token];
  await write(db);
  const jar = await cookies();
  jar.set("sid", token, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ user: { id: user.id, email: user.email, pro: user.pro } });
}
