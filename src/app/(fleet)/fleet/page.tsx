"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function FleetIndex() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/fleet/register"); return; }
      const roles: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
      if (roles.includes("owner") && !roles.includes("driver")) {
        router.replace("/fleet/dashboard");
      } else {
        router.replace("/fleet/today");
      }
    });
  }, [router]);

  return null;
}
