import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

const RIDER_PROTECTED = ["/bookings", "/profile", "/tracker"];

async function getSupabaseUser(req: NextRequest, res: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL    || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
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
  return supabase.auth.getUser();
}

export async function proxy(req: NextRequest) {
  const host     = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;
  const res      = NextResponse.next();

  // ── Admin subdomain ──────────────────────────────────
  if (host.startsWith("admin.")) {
    if (pathname.startsWith("/api/")) return NextResponse.next();
    // Client-side nav from admin pages already carries the /admin/* prefix — skip rewrite
    if (pathname.startsWith("/admin/") || pathname === "/admin") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── driver./owner. → redirect to fleet. (301) ───────
  if (host.startsWith("driver.") || host.startsWith("owner.")) {
    const target = req.nextUrl.clone();
    target.hostname = target.hostname.replace(/^(driver|owner)\./, "fleet.");
    return NextResponse.redirect(target, 301);
  }

  // ── Fleet subdomain (fleet.greenrides.co.in) ─────────
  if (host.startsWith("fleet.")) {
    // API routes pass through unmodified
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    // Client-side navigation (router.push/replace) from fleet pages arrives with
    // the full /fleet/* prefix already present. Skip the rewrite to avoid
    // double-prefixing (/fleet/today → /fleet/fleet/today → 404).
    // Auth is enforced client-side in each page and at the API layer (Bearer token).
    if (pathname.startsWith("/fleet/") || pathname === "/fleet") {
      return NextResponse.next();
    }

    // First-load: rewrite bare subdomain paths to /fleet/*
    const url = req.nextUrl.clone();
    url.pathname = `/fleet${pathname === "/" ? "" : pathname}`;

    // Public pages — no auth needed
    if (pathname === "/register" || pathname === "/pending" || pathname === "/login") {
      return NextResponse.rewrite(url);
    }

    const { data: { user } } = await getSupabaseUser(req, res);

    if (!user) {
      return NextResponse.redirect(`${req.nextUrl.protocol}//${host}/register`);
    }

    const roles: string[] = (user.app_metadata?.roles as string[]) ?? [];
    const hasFleet = roles.includes("driver") || roles.includes("owner");

    if (!hasFleet) {
      const fleetStatus = user.app_metadata?.fleet_status as string | undefined;
      if (fleetStatus === "pending") {
        return NextResponse.redirect(`${req.nextUrl.protocol}//${host}/pending`);
      }
      return NextResponse.redirect(`${req.nextUrl.protocol}//${host}/register`);
    }

    return NextResponse.rewrite(url);
  }

  // ── Rider portal (main domain) — path-based protection ──
  const isProtected = RIDER_PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const { data: { user } } = await getSupabaseUser(req, res);
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
