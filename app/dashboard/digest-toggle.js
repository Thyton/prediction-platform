"use client";
import { useState } from "react";

export default function DigestToggle({ initial }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <label className="muted-note" style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.checked;
          setBusy(true);
          setOn(next);
          await fetch("/api/digest/pref", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ digest: next }),
          });
          setBusy(false);
        }}
      />
      Email me the daily board
    </label>
  );
}
