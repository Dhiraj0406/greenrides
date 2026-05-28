"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ChevronLeft, Phone } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface Listing {
  id:           string;
  make:         string;
  model:        string;
  year:         number;
  price_paise:  string;
  mileage_km:   number | null;
  fuel_type:    string;
  transmission: string;
  location:     string;
  description:  string | null;
  seller_name:  string;
  seller_phone: string;
  status:       string;
  photos:       string[];
  created_at:   string;
}

interface Inquiry {
  id:          string;
  buyer_name:  string;
  buyer_phone: string;
  message:     string | null;
  created_at:  string;
}

function formatPrice(paise: string): string {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN")}`;
}

const STATUS_OPTS = ["APPROVED", "REJECTED", "SOLD"] as const;

function DetailContent({ token }: { token: string }) {
  const { id }                        = useParams<{ id: string }>();
  const router                        = useRouter();
  const [listing, setListing]         = useState<Listing | null>(null);
  const [inquiries, setInquiries]     = useState<Inquiry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [newStatus, setNewStatus]     = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/used-cars`,   { headers: { "x-admin-token": token } }),
      fetch(`/api/admin/used-cars/${id}/inquiries`, { headers: { "x-admin-token": token } }),
    ]).then(async ([listRes, inqRes]) => {
      // Fetch single listing from list (no dedicated single-listing admin endpoint)
      const listJson = await listRes.json();
      const found = (listJson.data ?? []).find((l: Listing) => l.id === id);
      setListing(found ?? null);
      setNewStatus(found?.status ?? "");

      const inqJson = await inqRes.json();
      setInquiries(inqJson.data ?? []);
    }).finally(() => setLoading(false));
  }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveStatus() {
    if (!listing || newStatus === listing.status) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/used-cars/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Update failed"); return; }
      setListing((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success("Status updated");
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="green-container min-h-screen bg-cream flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-leaf" />
    </div>
  );

  if (!listing) return (
    <div className="green-container min-h-screen bg-cream flex items-center justify-center">
      <p className="text-sub text-sm">Listing not found.</p>
    </div>
  );

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-4">
        <div className="pt-4 flex items-center gap-3">
          <button onClick={() => router.push("/admin/used-cars")} className="text-lime/70">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl text-white">{listing.make} {listing.model}</h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Photos */}
        {listing.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {listing.photos.map((url, i) => (
              <img key={i} src={url} alt="" className="flex-shrink-0 w-32 h-24 rounded-xl object-cover" />
            ))}
          </div>
        )}

        {/* Listing details */}
        <div className="bg-white border border-border rounded-2xl p-4 space-y-2">
          {[
            ["Make / Model", `${listing.make} ${listing.model}`],
            ["Year",         String(listing.year)],
            ["Price",        formatPrice(listing.price_paise)],
            ["Fuel",         listing.fuel_type],
            ["Transmission", listing.transmission],
            ["Location",     listing.location],
            ["Mileage",      listing.mileage_km ? `${listing.mileage_km.toLocaleString("en-IN")} km` : "—"],
            ["Seller",       listing.seller_name],
            ["Seller phone", listing.seller_phone],
            ["Submitted",    new Date(listing.created_at).toLocaleDateString("en-IN")],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-sub">{label}</span>
              <span className="font-semibold text-text text-right max-w-[60%]">{value}</span>
            </div>
          ))}
          {listing.description && (
            <p className="text-xs text-sub border-t border-border pt-2 mt-2">{listing.description}</p>
          )}
        </div>

        {/* Status change */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold text-sub mb-2 uppercase tracking-wider">Status</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {STATUS_OPTS.map((s) => (
              <button
                key={s}
                onClick={() => setNewStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                  ${newStatus === s ? "bg-forest text-white border-forest" : "bg-white border-border text-sub"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={saveStatus}
            disabled={saving || newStatus === listing.status}
            className="w-full bg-forest text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save status"}
          </button>
        </div>

        {/* Inquiries */}
        <div>
          <p className="text-xs font-semibold text-sub uppercase tracking-wider mb-2">
            Inquiries ({inquiries.length})
          </p>
          {inquiries.length === 0 && (
            <p className="text-xs text-sub py-4 text-center">No inquiries yet.</p>
          )}
          {inquiries.map((inq) => (
            <div key={inq.id} className="bg-white border border-border rounded-2xl p-4 mb-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-text">{inq.buyer_name}</p>
                <p className="text-xs text-sub">{new Date(inq.created_at).toLocaleDateString("en-IN")}</p>
              </div>
              <a href={`tel:${inq.buyer_phone}`}
                className="flex items-center gap-1.5 text-xs text-leaf font-semibold mb-1">
                <Phone className="w-3.5 h-3.5" />{inq.buyer_phone}
              </a>
              {inq.message && <p className="text-xs text-sub">{inq.message}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminListingDetailPage() {
  return <AdminGate>{(token) => <DetailContent token={token} />}</AdminGate>;
}
