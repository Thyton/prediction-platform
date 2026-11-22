import { NextResponse } from "next/server";
import { read, write } from "../../../lib/store";

export async function POST(req) {
  const { email, source } = await req.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const db = await read();
  const clean = email.trim().toLowerCase();
  if (!db.waitlist.find((w) => w.email === clean)) {
    db.waitlist.push({ email: clean, source: source || "homepage", at: new Date().toISOString() });
    await write(db);
  }
  return NextResponse.json({ count: db.waitlist.length });
}

export async function GET() {
  const db = await read();
  return NextResponse.json({ count: db.waitlist.length });
}
