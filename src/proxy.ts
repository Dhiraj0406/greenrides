import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

const PROTECTED = [
  "/bookings",
  "/profile",
  "/driver/dashboard",
  "/driver/post-ride",
  "/drivers/dashboard",
  "/drivers/register",
  "/drivers/pending",
  "/admin",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const res = NextResponse.next();

  // Admin cookie bypass — set by login page after PIN auth
  const adminCookie = req.cookies.get("green_admin_token")?.value;
  if (adminCookie && adminCookie === process.env.ADMIN_SECRET) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/bookings/:path*",
    "/profile/:path*",
    "/driver/:path*",
    "/drivers/dashboard/:path*",
    "/drivers/register/:path*",
    "/drivers/pending/:path*",
    "/admin/:path*",
  ],
};
