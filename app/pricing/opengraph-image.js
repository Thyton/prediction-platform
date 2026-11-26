import { ImageResponse } from "next/og";

export const alt = "TipLab Pro — live in-play signals, $9/month";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const line = { display: "flex", flexDirection: "column", gap: 14 };

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: 72,
          background: "#060e1a",
          backgroundImage: "radial-gradient(circle at 78% -10%, #16345c 0, #060e1a 55%)",
          color: "#f5f7fb", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>
            <div style={{ display: "flex" }}>{"TIP"}</div>
            <div style={{ display: "flex", color: "#57e0af" }}>{"LAB"}</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#93a2b8", letterSpacing: 3 }}>
            {"PRO"}
          </div>
        </div>

        <div style={line}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>
            {"Know when to get out,"}
          </div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.1, color: "#57e0af", fontStyle: "italic" }}>
            {"while the game is live."}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#93a2b8", marginTop: 12 }}>
            {"In-play get-in / get-out signals across every sport we price."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, fontSize: 22, color: "#64748b" }}>
          <div style={{ display: "flex" }}>{"tiplab.io/pricing"}</div>
          <div style={{ display: "flex" }}>{"$9/month founding price"}</div>
          <div style={{ display: "flex" }}>{"Cancel anytime"}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
