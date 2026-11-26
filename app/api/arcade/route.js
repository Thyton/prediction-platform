import { NextResponse } from "next/server";
import { read, write } from "../../../lib/store";

// Arcade scores. One row per run, filtered to the daily course so the board
// compares like with like. Deliberately not behind auth — a name is enough to
// play and compete, and signup friction is what kills a game's first session.
export const dynamic = "force-dynamic";

const MAX_ROWS = 400;
const MAX_TIME = 1800;

function cleanName(v) {
  const s = String(v || "").replace(/[^\w \-.]/g, "").trim().slice(0, 14);
  return s || "anon";
}

function board(store, game, seed) {
  const rows = (store.scores || [])
    .filter((r) => r.game === game && r.seed === seed && r.won)
    .sort((a, b) => a.time - b.time)
    .slice(0, 20);
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, time: r.time, at: r.at }));
}

export async function GET(req) {
  const url = new URL(req.url);
  const game = url.searchParams.get("game") || "voxel-run";
  const seed = Number(url.searchParams.get("seed")) || 0;
  const store = await read();
  return NextResponse.json({ board: board(store, game, seed) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { game = "voxel-run", seed, time, won, name } = body;
  if (!seed || !Number.isFinite(Number(time))) {
    return NextResponse.json({ error: "seed and time required" }, { status: 400 });
  }
  const t = Math.min(MAX_TIME, Math.max(0, Number(time)));
  const store = await read();
  store.scores = store.scores || [];
  store.scores.push({
    game: String(game).slice(0, 24),
    seed: Number(seed),
    time: Math.round(t * 100) / 100,
    won: Boolean(won),
    name: cleanName(name),
    at: new Date().toISOString(),
  });
  // keep the store bounded; old rows are only useful for the all-time view we
  // do not ship yet
  if (store.scores.length > MAX_ROWS) store.scores = store.scores.slice(-MAX_ROWS);
  await write(store);
  return NextResponse.json({ board: board(store, String(game), Number(seed)) });
}
