import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Vercel Cron hits this. Protected by CRON_SECRET when set.
export const maxDuration = 300;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }
  try {
    const cwd = path.join(process.cwd(), "engine");
    const { stdout } = await run(process.env.PYTHON || "python", ["-X", "utf8", "cycle.py"], { cwd, timeout: 280000 });
    return NextResponse.json({ ok: true, out: stdout.trim().split("\n").slice(-4) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 400) }, { status: 500 });
  }
}
