import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { read, write } from "../../../../../lib/store";
import { currentUser } from "../../../../../lib/session";
import { send, configured } from "../../../../../lib/email";

// Re-send a verification link to a signed-in member who signed up in beta mode.
export const dynamic = "force-dynamic";

export async function GET(req) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const db = await read();
  const me = db.users.find((u) => u.id === user.id);
  if (!me) return NextResponse.redirect(new URL("/dashboard", req.url));
  if (me.verified) return NextResponse.redirect(new URL("/dashboard?verified=1", req.url));

  if (!configured()) return NextResponse.redirect(new URL("/dashboard?verify=nokey", req.url));

  const raw = crypto.randomBytes(32).toString("hex");
  me.verifyToken = raw;
  await write(db);
  const link = `${new URL(req.url).origin}/api/auth/verify?t=${raw}`;
  await send({
    to: me.email,
    subject: "Confirm your TipLab email",
    text: `Confirm this address so password resets and pick alerts work:\n${link}`,
  });
  return NextResponse.redirect(new URL("/dashboard?verify=sent", req.url));
}
