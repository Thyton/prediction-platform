import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session";
import { read, write } from "../../../../lib/store";

// Toggle the daily digest. Honest opt-out rather than imposing email.
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { digest } = await req.json().catch(() => ({}));
  const db = await read();
  const me = db.users.find((u) => u.id === user.id);
  if (!me) return NextResponse.json({ error: "Account missing." }, { status: 404 });
  me.digest = Boolean(digest);
  await write(db);
  return NextResponse.json({ digest: me.digest });
}
