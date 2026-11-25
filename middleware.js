import { NextResponse } from "next/server";

// Remember when this browser last saw the board, so new picks can be flagged.
// Done here because pages can only read cookies, never set them.
export function middleware(req) {
  const res = NextResponse.next();
  const prev = req.cookies.get("lastvisit")?.value;
  if (prev) res.cookies.set("seen", prev, { path: "/", maxAge: 86400 * 30, sameSite: "lax" });
  res.cookies.set("lastvisit", String(Date.now()), { path: "/", maxAge: 86400 * 30, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/"] };
