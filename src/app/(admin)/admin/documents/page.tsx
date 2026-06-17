"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, ExternalLink, FileText, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/AdminGate";

const DOC_LABELS: Record<string, string> = {
  driving_license:   "Driving Licence",
  vehicle_rc:        "Vehicle RC",
  vehicle_insurance: "Vehicle Insurance",
  aadhaar:           "Aadhaar",
  pan:               "PAN",
  owner_id:          "Owner ID",
};

interface Doc {
  id:          string;
  entity_type: string;
  entity_id:   string;
  doc_type:    string;
  status:      "PENDING" | "APPROVED" | "REJECTED";
  signed_url:  string | null;
  updated_at:  string;
  uploader:    { name: string | null; phone: string } | null;
}

function DocumentsContent({ token }: { token: string }) {
  const [docs, setDocs]       = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("");
  const [acting, setActing]   = useState<string | null>(null);

  function load() {
    const qs = filter ? `?status=${filter}` : "";
    fetch(`/api/admin/documents${qs}`, { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((j) => { setDocs(j.data ?? []); })
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(id: string, action: "approve" | "reject") {
    setActing(id);
    try {
      const res  = await fetch(`/api/admin/documents/${id}/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body:    JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Action failed"); return; }
      toast.success(`Document ${action}d`);
      load();
    } finally { setActing(null); }
  }

  const STATUS_COLOR: Record<Doc["status"], string> = {
    PENDING:  "bg-gold/10 text-gold",
    APPROVED: "bg-leaf/10 text-leaf",
    REJECTED: "bg-red-50 text-red-500",
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
            <h1 className="font-display text-2xl text-white">KYC Documents</h1>
          </div>
        </div>
      </header>

      <div className="px-4 mt-4">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(["", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setLoading(true); setFilter(s); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                ${filter === s ? "bg-forest text-white" : "bg-white border border-border text-sub"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}

        {!loading && docs.length === 0 && (
          <p className="text-center text-sub text-sm py-12">No documents found.</p>
        )}

        {!loading && docs.map((doc) => (
          <div key={doc.id} className="bg-white border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-text">{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</p>
                <p className="text-xs text-sub">{doc.entity_type} · {doc.uploader ? `${doc.uploader.name ?? "—"} · ${doc.uploader.phone}` : doc.entity_id.slice(0, 8)}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[doc.status]}`}>
                {doc.status.charAt(0) + doc.status.slice(1).toLowerCase()}
              </span>
            </div>

            <p className="text-xs text-sub mb-3">
              {new Date(doc.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>

            <div className="flex items-center gap-2">
              {doc.signed_url ? (
                <a
                  href={doc.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-leaf border border-leaf/30 px-3 py-2 rounded-xl"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-sub border border-border px-3 py-2 rounded-xl">
                  <FileText className="w-3.5 h-3.5" /> No preview
                </span>
              )}

              {doc.status === "PENDING" && (
                <>
                  <button
                    onClick={() => verify(doc.id, "reject")}
                    disabled={acting === doc.id}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 px-3 py-2 rounded-xl disabled:opacity-50"
                  >
                    {acting === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Reject
                  </button>
                  <button
                    onClick={() => verify(doc.id, "approve")}
                    disabled={acting === doc.id}
                    className="flex items-center gap-1.5 text-xs font-semibold text-leaf bg-leaf/10 px-3 py-2 rounded-xl disabled:opacity-50"
                  >
                    {acting === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return <AdminGate>{(token) => <DocumentsContent token={token} />}</AdminGate>;
}
