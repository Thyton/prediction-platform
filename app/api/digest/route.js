import { read } from "../../../lib/store";
import { send, digestEmail, followedToday } from "../../../lib/email";
import { getLive, getRecord } from "../../../lib/data";

// Morning digest to members who haven't opted out. Called by the runner with
// the shared secret, so it can't be triggered by the public.
export const dynamic = "force-dynamic";

export async function POST(req) {
  const secret = process.env.ALERT_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  const picks = getLive().picks || [];
  if (!picks.length) return Response.json({ sent: 0, reason: "empty-board" });

  const record = getRecord().forward;
  const db = await read();
  const to = db.users.filter((u) => u.verified && u.digest !== false).slice(0, 500);

  let sent = 0;
  for (const u of to) {
    const mail = digestEmail(picks, record);
    const mine = followedToday(picks, u.teams);
    if (mine.length) {
      // a member's own teams come first — this is the bookmark loop paying off
      const line = mine.map((p) => `${p.match}`).join(", ");
      mail.subject = `${mine.length} pick${mine.length === 1 ? "" : "s"} on teams you follow`;
      mail.text = `You follow ${line}.

` + mail.text;
    }
    if ((await send({ to: u.email, ...mail })).sent) sent++;
  }
  return Response.json({ sent, of: to.length });
}
