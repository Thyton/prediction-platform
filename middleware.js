import { NextResponse } from "next/server";

// Remember when this browser last saw the board. The previous visit travels
// down as a header (pages see the cookie already updated by this middleware),
// and the new stamp is written on the way back.
export function middleware(req) {
  const prev = req.cookies.get("lastvisit")?.value || "";
  const headers = new Headers(req.headers);
  headers.set("x-last-visit", prev);

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set("lastvisit", String(Date.now()), { path: "/", maxAge: 86400 * 30, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/"] };
