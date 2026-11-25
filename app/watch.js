"use client";
import { useEffect, useState } from "react";

const LABEL = {
  in: "LIVE", pre: "not started", post: "final", unknown: "unavailable",
};

// In-card live score. Opens in place and polls while open, so watching a game
// never means leaving TipLab.
export default function Watch({ gameId, start, home, away }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    async function tick() {
      try {
        const r = await fetch(`/api/score?id=${encodeURIComponent(gameId)}&start=${encodeURIComponent(start || "")}`, { cache: "no-store" });
        const j = await r.json();
        if (alive) setD(j);
      } catch {
        if (alive) setD({ state: "unknown" });
      }
    }
    tick();
    const t = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open, gameId, start]);

  const live = d?.state === "in";
  const finished = d?.state === "post";

  return (
    <span className="watcher">
      <button className={"watch" + (live ? " on" : "")} onClick={() => setOpen((v) => !v)}>
        {open ? "× Score" : live ? "● LIVE" : "▶ Score"}
      </button>
      {open && (
        <div className="scorepad">
          {d ? (
            <>
              <div className="scoreline">
                <span>{away}</span>
                <b>{d.hs ?? "–"} : {d.as_ ?? "–"}</b>
                <span>{home}</span>
              </div>
              <p className="scorenode">
                {finished
                  ? "Full time — see the result below."
                  : live
                    ? `${d.clock || ""}${d.period ? ` · ${d.period === 1 ? "1st" : d.period === 2 ? "2nd" : d.period === 3 ? "3rd" : d.period + "th"}` : ""}`
                    : "Starts soon."}
              </p>
              {live && (
                <div className="bar"><div style={{ width: `${Math.round((d.progress || 0) * 100)}%` }} /></div>
              )}
            </>
          ) : (
            <p className="scorenode">Loading score…</p>
          )}
        </div>
      )}
    </span>
  );
}
