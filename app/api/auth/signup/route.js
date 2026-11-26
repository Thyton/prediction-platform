import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { read, write, hash, scryptHash, newSalt } from "../../../../lib/store";
import { send, configured, welcomeEmail } from "../../../../lib/email";

function startSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  user.sessions = [...(user.sessions || []).slice(-4), token];
  return token;
}

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  }

  const db = await read();
  const existing = db.users.find((u) => u.email === clean);
  // Refuse rather than bind the account to a typo — sign-in now means sign-in.
  // same dual-format check as login: legacy SHA-256 or salted scrypt
  const pwMatches = existing && (existing.pw.includes(":")
    ? (() => { const [salt, digest] = existing.pw.split(":"); return scryptHash(password, salt) === digest; })()
    : existing.pw === hash(password));
  if (existing && !pwMatches) {
    return NextResponse.json(
      { error: "That email is already registered.", hint: "Sign in instead, or reset the password.", code: "exists" },
      { status: 409 }
    );
  }
  let user = existing;
  if (!user) {
    const raw = crypto.randomBytes(32).toString("hex");
    const salt = newSalt();
    user = {
      id: crypto.randomUUID(), email: clean, pw: `${salt}:${scryptHash(password, salt)}`, pro: false,
      created: new Date().toISOString(), verified: false, verifyToken: raw,
    };
    db.users.push(user);
    const link = `${new URL(req.url).origin}/api/auth/verify?t=${raw}`;
    if (configured()) {
      await send({ to: clean, ...welcomeEmail(link) });
      user.verified = true; // proving they can read that mailbox
      user.verifyToken = undefined;
    }
  }

  const token = startSession(user);
  await write(db);
  const jar = await cookies();
  jar.set("sid", token, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ user: { id: user.id, email: user.email, pro: user.pro, verified: user.verified } });
}
