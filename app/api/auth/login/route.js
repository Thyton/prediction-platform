import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { read, write, hash } from "../../../../lib/store";

// Sign-in only. Accounts are created at /api/auth/signup so a wrong password
// can be told apart from a new address.
export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  const db = await read();
  const user = db.users.find((u) => u.email === clean);
  if (!user) {
    return NextResponse.json(
      { error: "No account with that email.", code: "missing" },
      { status: 404 }
    );
  }
  if (user.pw !== hash(password)) {
    return NextResponse.json({ error: "Wrong password for that email.", code: "badpw" }, { status: 401 });
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
