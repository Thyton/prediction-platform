"use client";
import { useState } from "react";

// A plain form post returned JSON into the browser; this actually navigates
// to Stripe once the session is created.
export default function Upgrade() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/checkout", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not start checkout.");
      window.location.href = d.url;
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={go} disabled={busy} style={{ marginTop: 16 }}>
        {busy ? "Opening Stripe…" : "Go Pro →"}
      </button>
      {err && <p className="err">{err}</p>}
    </>
  );
}
