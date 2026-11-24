import { fmtTime, SPORT_LABEL } from "../lib/data";

const LABEL = {
  HOLD: "HOLD", CASH_OUT: "GET OUT", RISING: "GET IN", CAUTION: "CAUTION",
};

export default function LiveBoard({ signals, pro, signedIn }) {  if (!signals.length) {
    return (
      <div className="empty">
        No match is live on a released pick right now. Signals appear here the moment a pick’s game starts.
      </div>
    );
  }
  const shown = pro ? signals : signals.slice(0, 1);
  const hidden = pro ? [] : signals.slice(1);
  return (
    <>
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
            <div className="live-foot">{fmtTime(s.at)} · on your pick</div>
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
