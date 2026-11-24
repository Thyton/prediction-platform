import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/session";
import { read, write } from "../../../lib/store";
import { getLedger } from "../../../lib/data";

// POST { gameId } -> toggle follow. Records an individual stake for the member.
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { gameId, stake } = await req.json().catch(() => ({}));
  if (!gameId) return NextResponse.json({ error: "gameId required." }, { status: 400 });

  const known = getLedger().some((i) => i.gameId === gameId);
  if (!known) return NextResponse.json({ error: "Unknown pick." }, { status: 404 });

  const db = await read();
  const u = db.users.find((x) => x.id === user.id);
  if (!u) return NextResponse.json({ error: "Account missing." }, { status: 404 });
  const follows = Array.isArray(u.follows) ? u.follows : [];
  const at = follows.findIndex((f) => f.gameId === gameId);
  let following;
  if (at >= 0) {
    follows.splice(at, 1);
    following = false;
  } else {
    const s = Math.min(20, Math.max(0.5, Number(stake) || 1));
    follows.unshift({ gameId, ts: new Date().toISOString(), stake: s });
    following = true;
  }
  u.follows = follows.slice(0, 400);
  await write(db);
  return NextResponse.json({ following });
}
