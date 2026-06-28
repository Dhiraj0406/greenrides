"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, User, ChevronLeft, Building2 } from "lucide-react";
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

interface OwnerUpgradeRequest {
  id: string;
  user_id: string;
  name: string | null;
  phone: string | null;
  vehicle_count: number;
  reason: string;
  months_active: number | null;
  created_at: string;
}

type Tab = "applications" | "upgrades";

function ApprovalsContent({ token }: { token: string }) {
  const [tab,          setTab]        = useState<Tab>("applications");
  const [applicants,   setApplicants] = useState<Applicant[]>([]);
  const [upgrades,     setUpgrades]   = useState<OwnerUpgradeRequest[]>([]);
  const [loadingApps,  setLoadingApps]  = useState(true);
  const [loadingUpgr,  setLoadingUpgr]  = useState(true);
  const [decidingApp,  setDecidingApp]  = useState<string | null>(null);
  const [decidingUpgr, setDecidingUpgr] = useState<string | null>(null);

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
          id: d.id, user_id: d.user.id, name: d.user.name, phone: d.user.phone,
          license_number: d.license_number, vehicle_type: d.vehicle_type,
          vehicle_number: d.vehicle_number, kind: "driver" as const,
        }));
        const owners: Applicant[] = (j.data?.owners ?? []).map((o: RawOwner) => ({
          id: o.id, user_id: o.user.id, name: o.name, phone: o.phone,
          email: o.email, kind: "owner" as const,
        }));
        setApplicants([...drivers, ...owners]);
      })
      .catch(() => toast.error("Failed to load applications"))
      .finally(() => setLoadingApps(false));
  }, [token]);

  useEffect(() => {
    fetch("/api/admin/owner-requests", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => setUpgrades(j.data ?? []))
      .catch(() => toast.error("Failed to load owner requests"))
      .finally(() => setLoadingUpgr(false));
  }, [token]);

  async function decide(applicant: Applicant, action: "approve" | "reject") {
    setDecidingApp(applicant.id);
    try {
      const res = await fetch("/api/admin/applicants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ user_id: applicant.user_id, action, applicant_type: applicant.kind }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      toast.success(action === "approve" ? "Approved!" : "Rejected");
      setApplicants((prev) => prev.filter((a) => !(a.id === applicant.id && a.kind === applicant.kind)));
    } catch { toast.error("Network error"); }
    finally { setDecidingApp(null); }
  }

  async function decideUpgrade(req: OwnerUpgradeRequest, action: "approve" | "decline") {
    setDecidingUpgr(req.id);
    try {
      const res = await fetch(`/api/admin/owner-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok || j.error) { toast.error(j.error ?? "Action failed"); return; }
      toast.success(action === "approve" ? "Owner access granted!" : "Request declined");
      setUpgrades((prev) => prev.filter((u) => u.id !== req.id));
    } catch { toast.error("Network error"); }
    finally { setDecidingUpgr(null); }
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

      {/* Tab bar */}
      <div className="px-4 mt-4 mb-2 flex gap-2">
        <button
          onClick={() => setTab("applications")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
            tab === "applications"
              ? "bg-forest text-white border-forest"
              : "bg-white text-sub border-border"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          New Applications
          {applicants.length > 0 && (
            <span className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
              tab === "applications" ? "bg-white/20 text-white" : "bg-pale text-sub"
            }`}>
              {applicants.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("upgrades")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
            tab === "upgrades"
              ? "bg-forest text-white border-forest"
              : "bg-white text-sub border-border"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Owner Upgrades
          {upgrades.length > 0 && (
            <span className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
              tab === "upgrades" ? "bg-lime text-forest" : "bg-amber-100 text-amber-700"
            }`}>
              {upgrades.length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 mt-2">
        {/* New Applications tab */}
        {tab === "applications" && (
          <>
            {loadingApps && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
            {!loadingApps && applicants.length === 0 && (
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
                      }`}>{a.kind}</span>
                    </div>
                    <p className="text-xs text-sub">+91 {a.phone}</p>
                    {a.license_number && <p className="text-xs text-sub">License: {a.license_number}</p>}
                    {a.vehicle_number && <p className="text-xs text-sub">Vehicle: {a.vehicle_number} ({a.vehicle_type})</p>}
                    {a.email && <p className="text-xs text-sub">{a.email}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decide(a, "approve")} disabled={decidingApp === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-leaf/10 text-leaf text-sm font-semibold disabled:opacity-60">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => decide(a, "reject")} disabled={decidingApp === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-semibold disabled:opacity-60">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Owner Upgrades tab */}
        {tab === "upgrades" && (
          <>
            {loadingUpgr && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}
            {!loadingUpgr && upgrades.length === 0 && (
              <p className="text-center text-sub text-sm py-12">No pending owner upgrade requests.</p>
            )}
            {upgrades.map((u) => (
              <div key={u.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-pale flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-sub" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text text-sm">{u.name ?? "Unknown"}</p>
                    <p className="text-xs text-sub">
                      {u.phone ? `+91 ${u.phone}` : "No phone"}
                      {u.months_active !== null ? ` · Driver ${u.months_active} months` : ""}
                    </p>
                    <p className="text-xs text-leaf font-semibold mt-0.5">
                      Declared {u.vehicle_count} vehicle{u.vehicle_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="bg-pale rounded-xl px-3 py-2 mb-3 border-l-2 border-leaf">
                  <p className="text-xs text-sub italic">&ldquo;{u.reason.slice(0, 120)}{u.reason.length > 120 ? "…" : ""}&rdquo;</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decideUpgrade(u, "approve")} disabled={decidingUpgr === u.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-leaf text-white text-sm font-semibold disabled:opacity-60">
                    {decidingUpgr === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Grant Owner Access
                  </button>
                  <button onClick={() => decideUpgrade(u, "decline")} disabled={decidingUpgr === u.id}
                    className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-semibold disabled:opacity-60">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  return <AdminGate>{(token) => <ApprovalsContent token={token} />}</AdminGate>;
}
