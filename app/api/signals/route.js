import { NextResponse } from "next/server";
import { getSignals } from "../../../lib/data";

// Pro-only signal feed for the browser notifier. Free users get the first
// signal only, matching what the board itself renders.
export const dynamic = "force-dynamic";

export async function GET() {
  const { currentUser } = await import("../../../lib/session");
  const user = await currentUser();
  const signals = getSignals();
  if (!user) return NextResponse.json({ signals: [] });
  if (!user.pro) return NextResponse.json({ signals: signals.slice(0, 1) });
  return NextResponse.json({ signals });
}
