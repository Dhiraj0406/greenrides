import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/bookings",
  "/profile",
  "/driver/dashboard",
  "/driver/post-ride",
  "/drivers/dashboard",
  "/drivers/register",
  "/drivers/pending",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check for any Supabase auth cookie
  const hasCookie = [...req.cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!hasCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/bookings/:path*",
    "/profile/:path*",
    "/driver/:path*",
    "/drivers/dashboard/:path*",
    "/drivers/register/:path*",
    "/drivers/pending/:path*",
  ],
};
