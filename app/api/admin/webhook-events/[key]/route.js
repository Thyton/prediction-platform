import { NextResponse } from "next/server";

// One-shot admin: subscribe the live Stripe webhook to the subscription
// lifecycle events the handler already understands. Without this a member who
// cancels in the portal keeps Pro forever, because nothing tells us.
// GET /api/admin/webhook-events/<ADMIN_KEY>
export const dynamic = "force-dynamic";

const NEEDED = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
];

export async function GET(req, { params }) {
  const { key } = await params;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "bad key" }, { status: 401 });
  }
  const stripe = process.env.STRIPE_SECRET_KEY;
  if (!stripe) return NextResponse.json({ error: "no stripe key" }, { status: 500 });
  const auth = { Authorization: `Bearer ${stripe}` };

  try {
    // find the endpoint that points at our own webhook route
    const list = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: auth }).then((r) => r.json());
    if (list.error) return NextResponse.json({ step: "list", error: list.error.message }, { status: 502 });

    const target = (list.data || []).find(
      (w) => (w.url || "").includes("/api/stripe/webhook") && w.status !== "disabled"
    );
    if (!target) return NextResponse.json({ error: "no webhook endpoint at /api/stripe/webhook" }, { status: 404 });

    const have = new Set(target.enabled_events || []);
    const missing = NEEDED.filter((e) => !have.has(e) && !have.has("*"));
    if (!missing.length) return NextResponse.json({ endpoint: target.id, already: true, events: [...have] });

    const body = new URLSearchParams();
    for (const e of [...have, ...missing]) body.append("enabled_events[]", e);
    const r = await fetch(`https://api.stripe.com/v1/webhook_endpoints/${target.id}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then((x) => x.json());

    if (r.error) return NextResponse.json({ step: "update", error: r.error.message }, { status: 502 });
    return NextResponse.json({ endpoint: r.id, url: r.url, added: missing, events: r.enabled_events });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 500 });
  }
}
