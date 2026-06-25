"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Clock, Upload, CheckCircle, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function PendingPage() {
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState<string>("NOT_SUBMITTED");

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from("DriverProfile")
          .select("is_approved, kyc_status")
          .eq("user_id", session.user.id)
          .single();
        if (data?.is_approved) { router.replace("/drivers/dashboard"); return; }
        if (data?.kyc_status)  setKycStatus(data.kyc_status);
      } catch { /* swallow — next poll will retry */ }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [router]);

  const kycDone = kycStatus === "SUBMITTED" || kycStatus === "APPROVED";

  return (
    <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center pb-12">
      <Link href="/drivers" className="absolute top-safe-top left-4 mt-4 p-1.5 rounded-lg text-sub hover:text-text">
        <ChevronLeft className="w-5 h-5" />
      </Link>
      <div className="w-16 h-16 rounded-full bg-pale flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-leaf" />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Leaf className="w-4 h-4 text-leaf" />
        <span className="font-display text-xl text-text">Under Review</span>
      </div>
      <p className="text-sub text-sm max-w-xs mb-6">
        Your registration is being reviewed. You&apos;ll receive a Telegram message once approved — usually within 24 hours.
      </p>

      {/* KYC checklist */}
      <div className="w-full max-w-xs bg-white border border-border rounded-2xl p-4 mb-5 text-left">
        <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-3">Approval checklist</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-leaf flex-shrink-0" />
            <span className="text-sm text-text">Registration submitted</span>
          </div>
          <div className="flex items-center gap-2">
            {kycDone
              ? <CheckCircle className="w-4 h-4 text-leaf flex-shrink-0" />
              : <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />}
            <span className={`text-sm ${kycDone ? "text-text" : "text-sub"}`}>KYC documents uploaded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
            <span className="text-sm text-sub">Admin approval</span>
          </div>
        </div>
      </div>

      {!kycDone && (
        <Link
          href="/drivers/kyc"
          className="w-full max-w-xs flex items-center justify-center gap-2 bg-leaf text-white font-semibold py-3.5 rounded-2xl mb-3"
        >
          <Upload className="w-4 h-4" /> Upload KYC Documents
        </Link>
      )}

      {kycDone && (
        <Link
          href="/drivers/kyc"
          className="w-full max-w-xs flex items-center justify-center gap-2 bg-pale border border-border text-text font-semibold py-3 rounded-2xl mb-3"
        >
          View Document Status →
        </Link>
      )}

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
