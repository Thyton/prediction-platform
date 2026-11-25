"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Tabs({ tips, live, results, alerts, games, activity, liveCount = 0 }) {
  const [tab, setTab] = useState("tips");
  const router = useRouter();
  // while the live tab is open, re-fetch the server data so signals land without a manual reload
  useEffect(() => {
    if (tab !== "live") return;
    const t2 = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(t2);
  }, [tab, router]);
  const panels = { tips, live, results, activity, alerts, games };
  return (
    <>
      <div className="tabs">
        {[["tips", "💡 The board"], ["live", liveCount > 0 ? `⚡ Live signals (${liveCount})` : "⚡ Live signals"],
          ["activity", "🔥 Activity"], ["results", "📊 Past results"], ["alerts", "🛡 Integrity signals"], ["games", "🌍 All games"]].map(
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
