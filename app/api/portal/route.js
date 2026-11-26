import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/session";

// Stripe's own billing portal: card changes, invoices, cancellation. Reachable
// from the dashboard, so a paying member can always get out of the product.
export const dynamic = "force-dynamic";

export async function GET(req) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.redirect(new URL("/dashboard", req.url));

  try {
    const db = await (await import("../../../lib/store")).read();
    const me = db.users.find((u) => u.id === user.id);
    const origin = new URL(req.url).origin;
    const body = new URLSearchParams({ return_url: `${origin}/dashboard` });
    if (me?.stripeCustomer) body.set("customer", me.stripeCustomer);
    // Pin the portal to our configuration: it is the only one that has
    // cancellation enabled, and Stripe refuses sessions without an active
    // configuration when more than one exists.
    if (process.env.STRIPE_PORTAL_CONFIG) body.set("configuration", process.env.STRIPE_PORTAL_CONFIG);

    const r = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.redirect(
        new URL(`/dashboard?portal=${r.status === 400 ? "noportal" : "error"}`, req.url)
      );
    }
    const d = await r.json();
    return NextResponse.redirect(d.url);
  } catch {
    return NextResponse.redirect(new URL("/dashboard?portal=error", req.url));
  }
}
