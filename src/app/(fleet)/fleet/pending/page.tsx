"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function FleetPendingPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const roles: string[] = (session.user.app_metadata?.roles as string[]) ?? [];
      if (roles.includes("driver") || roles.includes("owner")) {
        router.replace("/fleet");
      }
    }).catch(() => {});
  }, [router]);

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-gold" />
      </div>
      <h1 className="font-display text-2xl text-forest mb-3">Application Under Review</h1>
      <p className="text-sm text-sub max-w-xs mb-6">
        Your application has been submitted. Our team reviews applications within 24–48 hours.
        You will receive a notification once approved.
      </p>
      <a href="tel:+919668021577"
        className="flex items-center gap-2 text-sm text-leaf font-semibold">
        <Phone className="w-4 h-4" />
        Contact Support
      </a>
    </div>
  );
}
