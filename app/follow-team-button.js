"use client";
import { useState } from "react";

// Team follow. Survives the fixture, unlike following a single pick.
export default function FollowTeamButton({ sport, team, initial }) {
  const [following, setFollowing] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const r = await fetch("/api/follow-team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sport, team }),
      });
      const d = await r.json();
      if (r.ok) setFollowing(d.following);
    } catch {}
    setBusy(false);
  }

  return (
    <button className={"btn btn-ghost follow-team" + (following ? " on" : "")} onClick={toggle} disabled={busy}>
      {following ? "★ Following" : "☆ Follow team"}
    </button>
  );
}
