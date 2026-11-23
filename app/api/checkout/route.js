import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/session";
import { read, write } from "../../../lib/store";

export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;
  if (!key || !price) {
    // no Stripe configured yet: flip the account to pro so the flow is testable
    const db = await read();
    const u = db.users.find((x) => x.id === user.id);
    if (u) { u.pro = true; await write(db); }
    return NextResponse.json({ url: "/dashboard?upgraded=1", simulated: true });
  }

  const origin = new URL(req.url).origin;
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${origin}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard`,
  });

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const d = await r.json();
  if (!r.ok) return NextResponse.json({ error: d.error?.message || "Stripe error" }, { status: 502 });
  return NextResponse.json({ url: d.url });
}
