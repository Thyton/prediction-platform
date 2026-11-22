"use client";
import { useState } from "react";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("busy");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "homepage" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Try again");
      setState("done");
      setMsg("You're on the list. Watch your inbox.");
      setEmail("");
    } catch (err) {
      setState("idle");
      setMsg(err.message);
    }
  }

  if (state === "done") return <p className="ok">{msg}</p>;
  return (
    <>
      <form className="wl-form" onSubmit={submit}>
        <input
          type="email" required placeholder="you@email.com" aria-label="Email address"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={state === "busy"}>
          {state === "busy" ? "Joining…" : "Get early access →"}
        </button>
      </form>
      {msg && <p className="err" style={{ marginTop: 8 }}>{msg}</p>}
    </>
  );
}
