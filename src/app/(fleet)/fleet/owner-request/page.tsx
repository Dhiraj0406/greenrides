"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const COUNTS = [
  { label: "2",  value: 2 },
  { label: "3",  value: 3 },
  { label: "4",  value: 4 },
  { label: "5+", value: 5 },
];

export default function OwnerRequestPage() {
  const router = useRouter();
  const [count,     setCount]     = useState<number | null>(null);
  const [reason,    setReason]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = count !== null && reason.trim().length >= 10;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expired. Please log in again."); return; }

      const res = await fetch("/api/fleet/owner-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ vehicle_count: count, reason: reason.trim() }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Failed to submit request"); return; }

      toast.success("Request submitted — we'll review within 24 hours");
      router.replace("/fleet/profile");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.back()} className="text-sub hover:text-text">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-display text-xl text-forest">Apply for Owner Access</h2>
          <p className="text-xs text-sub">Takes 24 hours to review</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-text mb-3">How many vehicles do you own?</p>
          <div className="flex gap-2">
            {COUNTS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setCount(value)}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  count === value
                    ? "bg-forest text-white border-forest"
                    : "bg-white text-sub border-border hover:border-leaf"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-text mb-2">Tell us about your vehicles</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="e.g. I own 3 SUVs on the Bhubaneswar–Cuttack route and want to manage them here."
            rows={4}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-leaf/30 resize-none"
          />
          <p className={`text-xs mt-1 text-right ${reason.length >= 190 ? "text-red-400" : "text-sub"}`}>
            {reason.length}/200
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full bg-leaf text-white font-semibold py-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request →"}
        </button>
      </div>
    </div>
  );
}
