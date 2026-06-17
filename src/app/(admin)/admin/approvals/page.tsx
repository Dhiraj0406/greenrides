"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, User, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

interface Applicant {
  id: string;
  user_id: string;
  name: string | null;
  phone: string;
  license_number?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  email?: string | null;
  kind: "driver" | "owner";
}

function ApprovalsContent({ token }: { token: string }) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [deciding, setDeciding]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/applicants", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => {
        type RawDriver = {
          id: string; license_number: string | null; vehicle_type: string | null;
          vehicle_number: string | null;
          user: { id: string; name: string | null; phone: string };
        };
        type RawOwner = {
          id: string; name: string; phone: string; email: string | null;
          user: { id: string; name: string | null; phone: string };
        };

        const drivers: Applicant[] = (j.data?.drivers ?? []).map((d: RawDriver) => ({
          id:             d.id,
          user_id:        d.user.id,
          name:           d.user.name,
          phone:          d.user.phone,
          license_number: d.license_number,
          vehicle_type:   d.vehicle_type,
          vehicle_number: d.vehicle_number,
          kind:           "driver" as const,
        }));
        const owners: Applicant[] = (j.data?.owners ?? []).map((o: RawOwner) => ({
          id:      o.id,
          user_id: o.user.id,
          name:    o.name,
          phone:   o.phone,
          email:   o.email,
          kind:    "owner" as const,
        }));
        setApplicants([...drivers, ...owners]);
      })
      .catch(() => toast.error("Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [token]);

  async function decide(applicant: Applicant, action: "approve" | "reject") {
    setDeciding(applicant.id);
    try {
      const res = await fetch("/api/admin/applicants", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({
          user_id:        applicant.user_id,
          action,
          applicant_type: applicant.kind,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      toast.success(action === "approve" ? "Approved!" : "Rejected");
      setApplicants((prev) =>
        prev.filter((a) => !(a.id === applicant.id && a.kind === applicant.kind))
      );
    } catch { toast.error("Network error"); }
    finally { setDeciding(null); }
  }

  return (
    <div className="green-container min-h-screen bg-cream pb-16">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/admin" className="text-lime/70 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono-green uppercase tracking-widest mb-1">Green Admin</p>
            <h1 className="font-display text-2xl text-white">Fleet Approvals</h1>
          </div>
        </div>
      </header>
      <div className="px-4 mt-6">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
        {!loading && applicants.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No pending applications.</p>
        )}
        {applicants.map((a) => (
          <div key={`${a.kind}-${a.id}`} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-sub" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-text text-sm">{a.name ?? "Unknown"}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    a.kind === "driver" ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold"
                  }`}>
                    {a.kind}
                  </span>
                </div>
                <p className="text-xs text-sub">+91 {a.phone}</p>
                {a.license_number && <p className="text-xs text-sub">License: {a.license_number}</p>}
                {a.vehicle_number && <p className="text-xs text-sub">Vehicle: {a.vehicle_number} ({a.vehicle_type})</p>}
                {a.email && <p className="text-xs text-sub">{a.email}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => decide(a, "approve")} disabled={deciding === a.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-leaf/10 text-leaf text-sm font-semibold disabled:opacity-60">
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button onClick={() => decide(a, "reject")} disabled={deciding === a.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-semibold disabled:opacity-60">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  return <AdminGate>{(token) => <ApprovalsContent token={token} />}</AdminGate>;
}
