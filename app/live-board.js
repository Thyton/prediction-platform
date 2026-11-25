"use client";
import { useEffect, useState } from "react";
import { fmtTime, SPORT_LABEL } from "../lib/labels";
import Watch from "./watch";

const LABEL = {
  HOLD: "HOLD", CASH_OUT: "GET OUT", RISING: "GET IN", CAUTION: "CAUTION",
};

// Pro only: announce newly-fired signals as browser notifications so a member
// doesn't have to sit on the tab. Polls the signal file, which the engine
// rewrites every few minutes during live windows.
function Notifier({ signals }) {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setGranted(Notification.permission === "granted");
    let seen = new Set(signals.map((s) => `${s.gameId}:${s.kind}`));
    const timer = setInterval(async () => {
      try {
        const r = await fetch("/api/signals", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        for (const s of d.signals || []) {
          const key = `${s.gameId}:${s.kind}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (Notification.permission === "granted") {
            new Notification(`${LABEL[s.kind]} — ${s.match}`, {
              body: `${s.score} · ${s.text}`,
              tag: key,
            });
          }
        }
      } catch {
        /* offline, try again next tick */
      }
    }, 60000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function enable() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
    setGranted(Notification.permission === "granted");
  }

  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return <p className="muted-note">Alerts are blocked in your browser settings.</p>;
  }
  if (granted) return <p className="muted-note">Alerts on — you&apos;ll be notified when a signal fires.</p>;
  return (
    <button className="btn btn-ghost" onClick={enable} style={{ fontSize: 13, marginBottom: 12 }}>
      Enable signal alerts
    </button>
  );
}

export default function LiveBoard({ signals, pro, signedIn }) {
  if (!signals.length) {
    return (
      <>
        {pro && <Notifier signals={signals} />}
        <div className="empty">
          No match is live on a released pick right now. Signals appear here the moment a pick’s game starts.
        </div>
      </>
    );
  }
  const shown = pro ? signals : signals.slice(0, 1);
  const hidden = pro ? [] : signals.slice(1);
  return (
    <>
      {pro && <Notifier signals={signals} />}
      <div className="livegrid">
        {shown.map((s) => (
          <article key={s.gameId} className={"livecard " + s.kind.toLowerCase()}>
            <div className="live-top">
              <span className={"live-kind " + s.kind.toLowerCase()}>{LABEL[s.kind]}</span>
              <span className="live-min">{Math.round(s.progress * 100)}% elapsed</span>
            </div>
            <div className="live-match">{s.match}</div>
            <div className="live-score">
              {s.score} <small>· {SPORT_LABEL[s.sport] || s.sport}</small>
            </div>
            <div className="live-text">{s.text}</div>
            <div className="live-foot">
              {fmtTime(s.at)} · on your pick
            </div>
            <div style={{ marginTop: 8 }}>
              <Watch gameId={s.gameId} start={s.at} home={s.match} away="" />
            </div>
          </article>
        ))}
        {hidden.slice(0, 2).map((s) => (
          <article key={s.gameId} className="livecard blurred">
            <div className="live-match">{s.match}</div>
            <div className="live-score">{s.score}</div>
          </article>
        ))}
      </div>
      {!pro && (
        <p className="muted-note" style={{ marginTop: 12 }}>
          {signedIn ? "Pro members see every live signal as it fires." : "Sign in and go Pro to see every live signal the moment it fires."}{" "}
          <a href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Upgrade →" : "Sign in →"}</a>
        </p>
      )}
    </>
  );
}
