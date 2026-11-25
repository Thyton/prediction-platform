import { NextResponse } from "next/server";

// Advance "lastvisit" AFTER the page has rendered, so the page reads the
// previous visit and can flag picks added since. Cookies are written here
// because pages may only read them.
export function middleware(req) {
  const res = NextResponse.next();
  res.cookies.set("lastvisit", String(Date.now()), { path: "/", maxAge: 86400 * 30, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/"] };
