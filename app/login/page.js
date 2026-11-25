"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [mode, setMode] = useState("in"); // in | up | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function go(next) {
    setMode(next);
    setErr("");
    setNote("");
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNote("");
    const url =
      mode === "forgot" ? "/api/auth/forgot" : mode === "up" ? "/api/auth/signup" : "/api/auth/login";
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "forgot" ? { email } : { email, password }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);

    if (mode === "forgot") {
      if (!r.ok) return setErr(d.error || "Something went wrong.");
      return setNote(
        d.link
          ? "Reset link ready — open it below."
          : "If that address has an account, a reset link is on its way."
      );
    }
    if (!r.ok) {
      setErr(d.error || "Something went wrong.");
      // a wrong password or unknown address is a chance to guide, not block
      if (d.code === "missing") setNote("No account yet — create one below.");
      if (d.code === "badpw") setNote("Password wrong. Reset it if you have forgotten it.");
      if (d.code === "exists") setNote("Sign in instead, or reset the password.");
      return;
    }
    router.push("/dashboard");
  }

  const title = mode === "up" ? "Create your account" : mode === "forgot" ? "Reset password" : "Sign in";

  return (
    <section className="hero narrow">
      <p className="eyebrow">MEMBERS</p>
      <h1 style={{ fontSize: "2rem" }}>{title}</h1>
      <p className="lede">
        {mode === "up"
          ? "Picks are free during beta. Sign in to track them and keep your own record."
          : mode === "forgot"
            ? "Enter your address and we'll send a reset link."
            : "Welcome back."}
      </p>

      <form className="grid2" onSubmit={submit}>
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== "forgot" && (
          <input
            type="password" required minLength={8}
            placeholder={mode === "up" ? "Password (8+ chars)" : "Password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {err && <p className="err">{err}</p>}
        {note && <p className="muted-note">{note}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
        </button>
      </form>

      <p className="muted-note" style={{ marginTop: 14 }}>
        {mode === "in" && (
          <>
            New here?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); go("up"); }}>Create an account</a>
            {" · "}
            <a href="#" onClick={(e) => { e.preventDefault(); go("forgot"); }}>Forgot password</a>
          </>
        )}
        {mode !== "in" && (
          <a href="#" onClick={(e) => { e.preventDefault(); go("in"); }}>← Back to sign in</a>
        )}
      </p>
    </section>
  );
}
