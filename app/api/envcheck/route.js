export const dynamic = "force-dynamic";
export async function GET() {
  const u = process.env.DATABASE_URL || "";
  let host = "";
  try { host = new URL(u).host.split(".")[0]; } catch {}
  let pgOk = false, pgErr = "";
  if (u.startsWith("postgres")) {
    try {
      const { Client } = await import("pg");
      const c = new Client({ connectionString: u, ssl: { rejectUnauthorized: false } });
      await c.connect();
      await c.query("select 1");
      pgOk = true;
      await c.end();
    } catch (e) { pgErr = String(e.message).slice(0, 90); }
  }
  return Response.json({
    dbScheme: u.split(":")[0], dbHost: host, pgOk, pgErr,
    hasStripe: Boolean(process.env.STRIPE_SECRET_KEY),
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}
