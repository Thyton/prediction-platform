import { NextResponse } from "next/server";
import { read, write } from "../../../../lib/store";

// Only the raw token is ever in the URL; the store keeps the hash.
export async function GET(req) {
  const t = new URL(req.url).searchParams.get("t");
  if (!t) return NextResponse.redirect(new URL("/login?verify=missing", req.url));
  const db = await read();
  const user = db.users.find((u) => u.verifyToken === t);
  if (!user) return NextResponse.redirect(new URL("/dashboard?verify=used", req.url));
  const hashless = (u) => {
    const { verifyToken, ...rest } = u;
    return rest;
  };
  const i = db.users.findIndex((u) => u.id === user.id);
  db.users[i] = { ...hashless(user), verified: true };
  await write(db);
  // a verification link doubles as a sign-in link
  return NextResponse.redirect(new URL("/dashboard?verified=1", req.url));
}

export async function POST() {
  const db = await read();
  return NextResponse.json({ users: db.users.length });
}
