import { read } from "../../../lib/store";
import { send } from "../../../lib/email";

// Email a fired signal to Pro members. Browser notifications only work while a
// tab is open, which most members won't have, so this is the delivery path that
// actually reaches them. Called from cycle.py --live with the new signal file.
export const dynamic = "force-dynamic";

const LABEL = { HOLD: "HOLD", CASH_OUT: "GET OUT", RISING: "GET IN", CAUTION: "CAUTION" };

export async function POST(req) {
  const secret = process.env.ALERT_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  const { signals } = await req.json().catch(() => ({}));
  if (!Array.isArray(signals) || !signals.length) return Response.json({ sent: 0 });

  const db = await read();
  const recipients = db.users.filter((u) => u.pro && u.verified).map((u) => u.email).slice(0, 200);
  if (!recipients.length) return Response.json({ sent: 0, reason: "no-recipients" });

  const lines = signals
    .slice(0, 8)
    .map((s) => `${LABEL[s.kind] || s.kind} — ${s.match} (${s.score})\n${s.text}`)
    .join("\n\n");

  let sent = 0;
  for (const to of recipients) {
    const r = await send({
      to,
      subject: `⚡ ${LABEL[signals[0].kind] || signals[0].kind} — ${signals[0].match}`,
      text: `${lines}\n\nOpen the board: https://tiplab.io/#tips\n\nSignals are generated from live score feeds and can lag. Not advice.`,
    });
    if (r.sent) sent++;
  }
  return Response.json({ sent });
}
