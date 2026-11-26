"use client";
// Ad slots for the runner.
//
// Placement rules (copied from CrazyGames' own requirements, which is why they
// work): nothing fires mid-run. A run is a minute long and interrupting it is
// what made the previous product feel greedy.
//  - One display slot, only on the death screen.
//  - One opt-in rewarded offer, capped to once per 3 minutes, with a
//    same-shape "continue without ad" beside it.
//  - Adblocked players still play: no reward promise, no dead button.
//
// Network: Monetag. Fill MONETAG_ZONE below with the zone id from the
// dashboard and set enabled:true — the SDK script tag lives in page.js.
import { useEffect, useRef, useState } from "react";

const NETWORK = {
  enabled: false,      // flip once a zone id exists
  zone: "",            // e.g. "1234567"
  sdk: (z) => `show_${z}`,
  minSecondsBetween: 180,
};

const lastShownKey = "vr.lastAd";

function canShowNow() {
  try {
    const t = Number(sessionStorage.getItem(lastShownKey) || 0);
    return Date.now() - t > NETWORK.minSecondsBetween * 1000;
  } catch {
    return true;
  }
}
function markShown() {
  try { sessionStorage.setItem(lastShownKey, String(Date.now())); } catch {}
}

// Death-screen interstitial. Capped to once per 3 minutes and fired only after
// the death screen has painted, so it never cuts a run short.
export function useInterstitial() {
  return () => {
    if (!NETWORK.enabled) return false;
    if (typeof window[NETWORK.sdk(NETWORK.zone)] !== "function") return false;
    if (!canShowNow()) return false;
    markShown();
    window[NETWORK.sdk(NETWORK.zone)]({ type: "interstitial" }).catch(() => {});
    return true;
  };
}

function Slot() {
  const ref = useRef(null);
  useEffect(() => {
    if (!NETWORK.enabled || !ref.current) return;
    // Monetag display units mount into their own container
    const el = ref.current;
    el.innerHTML = "";
    const s = document.createElement("script");
    s.src = `https://libtl.com/sdk.js`;
    s.dataset.zone = NETWORK.zone;
    s.dataset.sdk = NETWORK.sdk(NETWORK.zone);
    el.appendChild(s);
    return () => { el.innerHTML = ""; };
  }, []);

  return (
    <div className="adslot" ref={ref}>
      <span className="adslot-tag">AD</span>
      {!NETWORK.enabled && <span className="adslot-ghost">ad slot</span>}
    </div>
  );
}

export default function Ads({ onReward }) {
  const [state, setState] = useState("idle"); // idle | playing | done
  const [left, setLeft] = useState(0);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    // availability is checked after mount: the SDK loads async and an adblocker
    // removes it entirely, so this must never be assumed at render time.
    const t = setTimeout(() => {
      setAvailable(NETWORK.enabled && typeof window[NETWORK.sdk(NETWORK.zone)] === "function" && canShowNow());
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const watch = () => {
    if (state !== "idle") return;
    if (!available) {
      // no network / adblocked: a short dwell stands in so the flow is real
      setState("playing");
      let n = 3;
      setLeft(n);
      const t = setInterval(() => {
        n -= 1; setLeft(n);
        if (n <= 0) { clearInterval(t); setState("done"); onReward?.(); }
      }, 1000);
      return;
    }
    setState("playing");
    markShown();
    // resolve = the video was actually watched, so only then grant
    window[NETWORK.sdk(NETWORK.zone)]({ type: "rewarded_interstitial" })
      .then(() => { setState("done"); onReward?.(); })
      .catch(() => { setState("idle"); });
  };

  return (
    <div className="adblock">
      <Slot />
      <button className="ad-reward" onClick={watch} disabled={state !== "idle"}>
        {state === "idle" && (available ? "▶ Watch an ad — 3 more lives" : "▶ Get 3 more lives")}
        {state === "playing" && `Playing… ${left}s`}
        {state === "done" && "✓ Lives restored"}
      </button>
    </div>
  );
}
