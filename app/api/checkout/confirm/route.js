import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "../../../../lib/session";
import { read, write } from "../../../../lib/store";

// Stripe sends the browser back here with the session id. We verify with Stripe
// directly (server-side, secret key) and grant Pro. No webhook required.
export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const user = await currentUser();
  if (!sessionId || !user) redirect("/dashboard");

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) redirect("/dashboard?upgraded=1");

  let paid = false;
  let sub = null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (r.ok) {
      const s = await r.json();
      paid = s.payment_status === "paid" || s.status === "complete";
      sub = s.subscription;
    }
  } catch {
    /* fall through to dashboard */
  }

  if (paid) {
    const db = await read();
    const u = db.users.find((x) => x.id === user.id);
    if (u) {
      u.pro = true;
      u.stripeSub = sub || u.stripeSub;
      await write(db);
    }
  }
  redirect("/dashboard?upgraded=1");
}
