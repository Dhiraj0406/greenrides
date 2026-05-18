"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PendingPage() {
  const router = useRouter();

  useEffect(() => {
    // Poll every 30s — redirect to dashboard once approved
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("DriverProfile")
        .select("is_approved")
        .eq("user_id", session.user.id)
        .single();
      if (data?.is_approved) router.replace("/drivers/dashboard");
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-pale flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-leaf" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Leaf className="w-4 h-4 text-leaf" />
        <span className="font-display text-xl text-text">Under Review</span>
      </div>
      <p className="text-sub text-sm max-w-xs mb-4">
        Your registration is being reviewed by our team. You'll receive a Telegram message once approved — usually within 24 hours.
      </p>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-leaf/40 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
