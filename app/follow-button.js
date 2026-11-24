"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FollowButton({ gameId, following, stake }) {
  const [on, setOn] = useState(Boolean(following));
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const r = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, stake }),
    });
    setBusy(false);
    if (r.ok) {
      const d = await r.json();
      setOn(d.following);
      router.refresh();
    } else if (r.status === 401) {
      router.push("/login");
    }
  }

  return (
    <button
      className={"follow" + (on ? " on" : "")}
      onClick={toggle}
      disabled={busy}
      title={on ? "Stop tracking this pick" : "Track this pick in your record"}
    >
      {on ? "✓ Tracking" : "+ Track"}
    </button>
  );
}
