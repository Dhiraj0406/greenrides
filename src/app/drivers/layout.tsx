"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DriversLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Public pages: /drivers itself — anyone can view
      if (pathname === "/drivers") {
        if (session) {
          // Check driver status and redirect appropriately
          const { data: profile } = await supabase
            .from("DriverProfile")
            .select("is_approved")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (!profile) {
            router.replace("/drivers/register");
            return;
          }
          if (!profile.is_approved) {
            router.replace("/drivers/pending");
            return;
          }
          router.replace("/drivers/dashboard");
          return;
        }
        setReady(true);
        return;
      }

      // Protected pages require a session
      if (!session) {
        router.replace(`/login?next=${pathname}`);
        return;
      }

      const { data: profile } = await supabase
        .from("DriverProfile")
        .select("is_approved")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (pathname === "/drivers/register") {
        if (profile) {
          router.replace(profile.is_approved ? "/drivers/dashboard" : "/drivers/pending");
          return;
        }
        setReady(true);
        return;
      }

      if (pathname === "/drivers/pending") {
        if (!profile) { router.replace("/drivers/register"); return; }
        if (profile.is_approved) { router.replace("/drivers/dashboard"); return; }
        setReady(true);
        return;
      }

      // /drivers/dashboard
      if (!profile) { router.replace("/drivers/register"); return; }
      if (!profile.is_approved) { router.replace("/drivers/pending"); return; }
      setReady(true);
    }).catch(() => setReady(true));
  }, [pathname, router]);

  if (!ready) return (
    <div className="green-container min-h-screen bg-cream flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-leaf border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return <>{children}</>;
}
