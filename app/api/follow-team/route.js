import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/session";
import { read, write } from "../../../lib/store";

// POST { sport, team } -> toggle a TEAM follow. Game follows are a single pick;
// a team follow outlives the fixture and is what brings a member back next week,
// so it carries its own count for the digest line.
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { sport, team } = await req.json().catch(() => ({}));
  if (!sport || !team) return NextResponse.json({ error: "sport and team required." }, { status: 400 });

  const db = await read();
  const u = db.users.find((x) => x.id === user.id);
  if (!u) return NextResponse.json({ error: "Account missing." }, { status: 404 });

  const key = `${sport}:${team}`;
  const follows = Array.isArray(u.teams) ? u.teams : [];
  const at = follows.findIndex((f) => f.key === key);
  let following;
  if (at >= 0) {
    follows.splice(at, 1);
    following = false;
  } else {
    follows.unshift({ key, sport, team, ts: new Date().toISOString() });
    following = true;
  }
  u.teams = follows.slice(0, 120);
  await write(db);
  return NextResponse.json({ following });
}
