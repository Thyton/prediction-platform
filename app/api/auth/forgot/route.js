import { NextResponse } from "next/server";
import { read } from "../../../../lib/store";
import * as reset from "../../../../lib/reset";
import { send, configured, resetEmail } from "../../../../lib/email";

// Always answers the same way, so the endpoint can't be used to enumerate accounts.
export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return NextResponse.json({ error: "Email required." }, { status: 400 });

  const db = await read();
  const user = db.users.find((u) => u.email === clean);
  let link = null;
  if (user) {
    const raw = await reset.issue(clean);
    link = `${new URL(req.url).origin}/reset?t=${raw}`;
    const mail = resetEmail(link, reset.TTL_MIN);
    await send({ to: clean, ...mail });
  }
  // in beta (no provider) the link is returned so the user isn't stuck
  return NextResponse.json({
    ok: true,
    emailed: configured() && Boolean(user),
    link: configured() ? null : link,
  });
}
