"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Loader2, Printer, ArrowRight, CheckCircle, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Receipt {
  type:           "request" | "booking";
  ref:            string;
  from:           string;
  to:             string;
  fare_rupees:    number;
  date:           string;
  booked_at:      string;
  driver_name:    string | null;
  driver_phone?:  string | null;
  vehicle_number?: string | null;
  vehicle_model?:  string | null;
  seats?:          number;
  payment_status?: string | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function whatsAppText(r: Receipt): string {
  return [
    "🚗 *Green Rides Trip Receipt*",
    "",
    `Booking Ref: #${r.ref}`,
    `Route: ${r.from} → ${r.to}`,
    `Date: ${fmt(r.date)}`,
    `Fare: ₹${r.fare_rupees.toLocaleString("en-IN")}${r.seats && r.seats > 1 ? ` (${r.seats} seats)` : ""}`,
    r.driver_name    ? `Driver: ${r.driver_name}`   : null,
    r.vehicle_number ? `Vehicle: ${r.vehicle_number}${r.vehicle_model ? ` · ${r.vehicle_model}` : ""}` : null,
    "",
    "_For reimbursement/expense records_",
    "_Powered by Green Rides · greenrides.co.in_",
  ].filter((l): l is string => l !== null).join("\n");
}

export default function ReceiptPage() {
  const { id }    = useParams<{ id: string }>();
  const sp        = useSearchParams();
  const router    = useRouter();
  const type      = sp.get("type") ?? "request";

  const [receipt,  setReceipt]  = useState<Receipt | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace(`/login?next=/receipt/${id}?type=${type}`);
        return;
      }
      try {
        const res  = await fetch(`/api/receipt/${id}?type=${type}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok || json.error) { setError(json.error ?? "Receipt not found"); return; }
        setReceipt(json.data);
      } catch { setError("Failed to load receipt. Please try again."); }
      finally  { setLoading(false); }
    }).catch(() => { setError("Session error"); setLoading(false); });
  }, [id, type, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-leaf" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="font-semibold text-text">Receipt not available</p>
        <p className="text-sm text-sub">{error ?? "This receipt could not be found."}</p>
        <button onClick={() => router.back()} className="text-leaf text-sm font-semibold mt-2">← Go back</button>
      </div>
    );
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(whatsAppText(receipt))}`;

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  }

  return (
    <div className="green-container min-h-screen bg-cream py-8 px-4 pb-16">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .green-container { padding: 0 !important; background: white !important; }
          .print-card { border-radius: 0 !important; box-shadow: none !important; max-width: 100% !important; }
          .print\\:hidden { display: none !important; }
        }
      ` }} />

      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between mb-6 print:hidden max-w-sm mx-auto">
        <button onClick={() => router.back()} className="text-sub text-sm">← Back</button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-sub text-sm font-medium"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Receipt card */}
      <div className="print-card bg-white rounded-2xl overflow-hidden shadow-sm max-w-sm mx-auto print:shadow-none print:max-w-full print:rounded-none">
        {/* Brand header */}
        <div className="bg-forest px-6 py-5 text-white">
          <p className="font-display text-2xl font-bold tracking-tight">Green Rides</p>
          <p className="text-lime/60 text-xs mt-0.5 uppercase tracking-widest font-mono-green">Trip Receipt</p>
        </div>

        <div className="px-6 py-5">
          {/* Status */}
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-leaf flex-shrink-0" />
            <span className="text-sm font-semibold text-leaf">Trip Completed</span>
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-display text-2xl text-forest font-bold leading-tight">{receipt.from}</span>
            <ArrowRight className="w-5 h-5 text-sub flex-shrink-0" />
            <span className="font-display text-2xl text-forest font-bold leading-tight">{receipt.to}</span>
          </div>
          <p className="text-sm text-sub mb-5">{fmt(receipt.date)}</p>

          {/* Fare block */}
          <div className="bg-pale rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-sub mb-0.5">Total Fare</p>
            <div className="flex items-baseline gap-2">
              <p className="font-display text-3xl font-bold text-forest">
                ₹{receipt.fare_rupees.toLocaleString("en-IN")}
              </p>
              {receipt.seats && receipt.seats > 1 && (
                <p className="text-sm text-sub">× {receipt.seats} seats</p>
              )}
            </div>
            {receipt.payment_status === "SUCCESS" && (
              <p className="text-xs text-leaf font-semibold mt-1">Paid online ✓</p>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2.5 mb-5">
            {receipt.driver_name && (
              <Row label="Driver" value={receipt.driver_name} />
            )}
            {receipt.vehicle_number && (
              <Row label="Vehicle No." value={receipt.vehicle_number} mono />
            )}
            {receipt.vehicle_model && (
              <Row label="Model" value={receipt.vehicle_model} />
            )}
          </div>

          {/* Reference */}
          <div className="border-t border-border pt-4">
            <p className="text-xs text-sub">Booking Reference</p>
            <p className="font-mono text-base font-bold text-text tracking-widest mt-0.5">#{receipt.ref}</p>
            <p className="text-xs text-sub mt-1">Booked on {fmt(receipt.booked_at)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-pale px-6 py-3 text-center border-t border-border">
          <p className="text-xs text-sub">greenrides.co.in · +91 96680 21577</p>
        </div>
      </div>

      {/* Share buttons — hidden when printing */}
      <div className="print:hidden mt-5 flex flex-col gap-2 max-w-sm mx-auto">
        {/* WhatsApp share */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 bg-[#25D366] text-white font-semibold py-4 rounded-2xl text-sm"
        >
          <WhatsAppIcon />
          Share Receipt via WhatsApp
        </a>

        {/* Copy link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-sub w-full justify-center"
        >
          <Link2 className="w-4 h-4" />
          Copy Link
        </button>

        {/* Print */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-sub w-full justify-center"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-sub">{label}</span>
      <span className={`font-semibold text-text ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
