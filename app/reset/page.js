"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Reset() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("t") : "";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pw }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error || "Something went wrong.");
    router.push("/dashboard");
  }

  return (
    <section className="hero narrow">
      <p className="eyebrow">MEMBERS</p>
      <h1 style={{ fontSize: "2rem" }}>Set a new password</h1>
      {!token ? (
        <p className="err">This link is missing its token. <a href="/login">Start again</a>.</p>
      ) : (
        <form className="grid2" onSubmit={submit}>
          <input
            type="password" required minLength={8} placeholder="New password (8+ chars)"
            value={pw} onChange={(e) => setPw(e.target.value)}
          />
          {err && <p className="err">{err}</p>}
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save and sign in"}</button>
        </form>
      )}
    </section>
  );
}
