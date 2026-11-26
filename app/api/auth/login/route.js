import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { read, write, hash, scryptHash, newSalt } from "../../../../lib/store";

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
  // Two hash formats coexist: legacy bare SHA-256 and scrypt (salt:hash).
  // On a successful legacy login, transparently re-hash so accounts drift to
  // scrypt without a migration, per the handoff decision.
  let ok = false;
  if (user.pw && user.pw.includes(":")) {
    const [salt, digest] = user.pw.split(":");
    ok = scryptHash(password, salt) === digest;
  } else {
    ok = user.pw === hash(password);
    if (ok) {
      const salt = newSalt();
      user.pw = `${salt}:${scryptHash(password, salt)}`;
    }
  }
  if (!ok) {
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
