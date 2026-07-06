"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, Car, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "SOLD";

interface Listing {
  id:            string;
  make:          string;
  model:         string;
  year:          number;
  price_paise:   string;
  location:      string;
  seller_name:   string;
  status:        Status;
  photos:        string[];
  created_at:    string;
  inquiry_count: number;
}

function formatPrice(paise: string): string {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN")}`;
}

function UsedCarsContent({ token }: { token: string }) {
  const router = useRouter();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<Status | "ALL">("PENDING");
  const [acting, setActing]           = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/used-cars", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setAllListings(j.data ?? []); })
      .catch(() => toast.error("Failed to load listings"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const listings = filter === "ALL" ? allListings : allListings.filter((l) => l.status === filter);
  const counts: Record<Status | "ALL", number> = {
    ALL:      allListings.length,
    PENDING:  allListings.filter((l) => l.status === "PENDING").length,
    APPROVED: allListings.filter((l) => l.status === "APPROVED").length,
    REJECTED: allListings.filter((l) => l.status === "REJECTED").length,
    SOLD:     allListings.filter((l) => l.status === "SOLD").length,
  };

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED") {
    setActing(id);
    try {
      const res  = await fetch(`/api/admin/used-cars/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Action failed"); return; }
      toast.success(`Listing ${status.toLowerCase()}`);
      setAllListings((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    } catch { toast.error("Network error — please try again"); }
    finally { setActing(null); }
  }

  const STATUS_COLOR: Record<Status, string> = {
    PENDING:  "bg-gold/10 text-gold",
    APPROVED: "bg-leaf/10 text-leaf",
    REJECTED: "bg-red-50 text-red-500",
    SOLD:     "bg-gray-100 text-gray-500",
  };

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Used Cars</h1>
          </div>
        </div>
      </header>

      <div className="px-4 mt-4">
        {/* Status tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(["PENDING", "APPROVED", "REJECTED", "SOLD", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                ${filter === s ? "bg-forest text-white" : "bg-white border border-border text-sub"}`}
            >
              {s}
              {counts[s] > 0 && (
                <span className={`text-[10px] font-bold px-1 rounded-full ${
                  filter === s ? "bg-white/20 text-white" : "bg-pale text-sub"
                }`}>{counts[s]}</span>
              )}
            </button>
          ))}
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}

        {!loading && listings.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No listings.</p>
        )}

        {!loading && listings.map((l) => (
          <div
            key={l.id}
            className="bg-white border border-border rounded-2xl p-4 mb-3 cursor-pointer"
            onClick={() => router.push(`/admin/used-cars/${l.id}`)}
          >
            <div className="flex items-start gap-3">
              {l.photos.length > 0 ? (
                <img src={l.photos[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-warm flex items-center justify-center flex-shrink-0">
                  <Car className="w-6 h-6 text-sub" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text truncate">{l.make} {l.model} ({l.year})</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[l.status]}`}>
                    {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-leaf font-semibold">{formatPrice(l.price_paise)}</p>
                <p className="text-xs text-sub">{l.seller_name} · {new Date(l.created_at).toLocaleDateString("en-IN")}</p>
                {l.inquiry_count > 0 && (
                  <p className="text-xs text-forest font-semibold mt-1">{l.inquiry_count} inquir{l.inquiry_count === 1 ? "y" : "ies"}</p>
                )}
              </div>
            </div>

            {l.status === "PENDING" && (
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => updateStatus(l.id, "REJECTED")}
                  disabled={acting === l.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 px-3 py-2 rounded-xl disabled:opacity-50"
                >
                  {acting === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Reject
                </button>
                <button
                  onClick={() => updateStatus(l.id, "APPROVED")}
                  disabled={acting === l.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-leaf bg-leaf/10 px-3 py-2 rounded-xl disabled:opacity-50"
                >
                  {acting === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsedCarsPage() {
  return <AdminGate>{(token) => <UsedCarsContent token={token} />}</AdminGate>;
}
