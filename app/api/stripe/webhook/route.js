import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { read, write } from "../../../../lib/store";

// Stripe webhook: grants/revokes Pro. Verifies the signature with the webhook secret.
export const dynamic = "force-dynamic";

function verify(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = sigHeader.split(",").reduce((acc, p) => {
    const [k, v] = p.split("=");
    acc[k] = v;
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${payload}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret || !verify(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const obj = event.data?.object || {};
  const db = await read();
  const byId = (id) => db.users.find((u) => u.id === id);
  const byEmail = (e) => db.users.find((u) => u.email === (e || "").toLowerCase());

  switch (event.type) {
    case "checkout.session.completed": {
      const u = byId(obj.client_reference_id) || byEmail(obj.customer_details?.email || obj.customer_email);
      if (u) {
        u.pro = true;
        u.stripeCustomer = obj.customer;
        u.stripeSub = obj.subscription;
        await write(db);
      }
      break;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const u = db.users.find((x) => x.stripeSub === obj.id || x.stripeCustomer === obj.customer);
      if (u) {
        u.pro = false;
        await write(db);
      }
      break;
    }
    case "customer.subscription.updated": {
      const u = db.users.find((x) => x.stripeSub === obj.id || x.stripeCustomer === obj.customer);
      if (u) {
        u.pro = ["active", "trialing"].includes(obj.status);
        await write(db);
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
