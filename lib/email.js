// Outbound email. Uses Resend when RESEND_API_KEY is set; otherwise returns the
// message so the caller can surface it (beta mode: links are shown on screen).
const FROM = process.env.EMAIL_FROM || "TipLab <noreply@tiplab.io>";

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
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
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
