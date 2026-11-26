import { NextResponse } from "next/server";

// One-off admin: turns on the Stripe customer portal configuration so paying
// members can cancel. Guarded by ADMIN_KEY. Safe to call more than once.
// GET /api/admin/portal-setup/<ADMIN_KEY>
export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { key: seg } = (await ctx?.params) || {};
  const url = new URL(req.url);
  const k = seg || url.searchParams.get("k") || "";
  if (!process.env.ADMIN_KEY || k !== process.env.ADMIN_KEY) {
    return NextResponse.json({
      error: "forbidden",
      got: k.slice(0, 12),
      expecting: (process.env.ADMIN_KEY || "").slice(0, 12),
      hasKey: Boolean(process.env.ADMIN_KEY),
      raw: url.href.slice(0, 120),
    }, { status: 403 });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "no stripe key" }, { status: 500 });

  const call = async (path, form) => {
    const r = await fetch(`https://api.stripe.com/v1${path}`, {
      method: form ? "POST" : "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form ? new URLSearchParams(form) : undefined,
    });
    const text = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* keep the raw text for the report */ }
    return { ok: r.ok, status: r.status, parsed, raw: text.slice(0, 300) };
  };

  try {
    const list = await call("/billing_portal/configurations");
    if (list.ok && list.parsed?.data?.length) {
      return NextResponse.json({ portal: "already", count: list.parsed.data.length });
    }

    const made = await call("/billing_portal/configurations", {
      "business_profile[headline]": "TipLab",
      "business_profile[privacy_policy_url]": `${new URL(req.url).origin}/privacy`,
      "business_profile[terms_of_service_url]": `${new URL(req.url).origin}/terms`,
      "features[customer_update][enabled]": "true",
      "features[customer_update][allowed_updates][]": "email",
      "features[invoice_history][enabled]": "true",
      "features[payment_method_update][enabled]": "true",
      "features[subscription_cancel][enabled]": "true",
      "features[subscription_cancel][mode]": "at_period_end",
    });
    return NextResponse.json({ portal: made.ok ? "created" : "failed", detail: made.parsed || made.raw });
  } catch (e) {
    return NextResponse.json({ portal: "threw", err: String(e.message || e).slice(0, 250) }, { status: 500 });
  }
}
