"use client";
import { useState } from "react";

export default function Tabs({ tips, live, results, alerts, games, liveCount = 0 }) {
  const [tab, setTab] = useState("tips");
  const panels = { tips, live, results, alerts, games };
  return (
    <>
      <div className="tabs">
        {[["tips", "💡 The board"], ["live", liveCount > 0 ? `⚡ Live signals (${liveCount})` : "⚡ Live signals"],
          ["results", "📊 Past results"], ["alerts", "🛡 Integrity signals"], ["games", "🌍 All games"]].map(
          ([k, label]) => (
            <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
              {label}
            </button>
          )
        )}
      </div>
      <div style={{ marginTop: 6 }}>{panels[tab]}</div>
    </>
  );
}
