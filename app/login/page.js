"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error || "Something went wrong.");
    router.push("/dashboard");
  }

  return (
    <section className="hero narrow">
      <p className="eyebrow">MEMBERS</p>
      <h1 style={{ fontSize: "2rem" }}>Sign in</h1>
      <p className="lede">New email? The account is created on first sign-in.</p>
      <form className="grid2" onSubmit={submit}>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
      </form>
    </section>
  );
}
