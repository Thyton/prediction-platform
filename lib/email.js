// Outbound email. Uses Resend when RESEND_API_KEY is set; otherwise returns the
// message so the caller can surface it (beta mode: links are shown on screen).
const FROM = process.env.EMAIL_FROM || "TipLab <noreply@tiplab.io>";
// tiplab.io has no inbound mailbox, so a reply to the sender bounces. Point
// replies at a box that a human actually reads.
const REPLY_TO = process.env.EMAIL_REPLY_TO || "support@pinzak.com";

export function configured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function send({ to, subject, text, html }) {
  if (!configured()) return { sent: false, reason: "no-provider" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text, html }),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, reason: String(e.message).slice(0, 120) };
  }
}

export function resetEmail(link, minutes) {
  return {
    subject: "Reset your TipLab password",
    text: `Someone asked to reset the password for this TipLab account.\n\nOpen this link to set a new one (valid ${minutes} minutes):\n${link}\n\nIf it wasn't you, ignore this email.`,
  };
}

export function welcomeEmail(link) {
  return {
    subject: "You're in — TipLab",
    text: `Your TipLab account is ready.\n\nToday's board: ${link}\n\nPicks are free during beta. We publish the price and the reasoning, then grade every result in public — including the losses.\n\nReply to this email any time.`,
  };
}

// Daily digest: what the desk published, so there is a reason to open the site.
export function digestEmail(picks, record) {
  const rows = picks
    .slice(0, 8)
    .map((p) => `  ${p.match} — ${(p.modelProb * 100).toFixed(0)}% at ${Number(p.price).toFixed(2)}`)
    .join("\n");
  return {
    subject: `${picks.length} pick${picks.length === 1 ? "" : "s"} on the board today`,
    text: `Today's released picks:\n\n${rows}\n\nhttps://tiplab.io/#tips\n\nForward record so far: ${record.correct}-${record.wrong} (${record.accuracy != null ? (record.accuracy * 100).toFixed(0) : "-"}%).\n\nStop these from your dashboard.`,
  };
}
