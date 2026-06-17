"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, CheckCircle, XCircle, Clock, FileText, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";

const DOCS = [
  { key: "driving_license",   label: "Driving Licence",    hint: "Commercial licence with transport endorsement" },
  { key: "vehicle_rc",        label: "Vehicle RC",         hint: "Registration certificate of your vehicle" },
  { key: "vehicle_insurance", label: "Vehicle Insurance",  hint: "Valid commercial insurance policy" },
  { key: "aadhaar",           label: "Aadhaar Card",       hint: "Front and back on one image/PDF" },
  { key: "pan",               label: "PAN Card",           hint: "Required for payments above ₹50,000" },
] as const;

type DocKey = typeof DOCS[number]["key"];
type DocStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";

interface DocState {
  status:  DocStatus;
  uploading: boolean;
}

const STATUS_UI: Record<DocStatus, { icon: React.ReactNode; label: string; color: string }> = {
  NOT_SUBMITTED: { icon: <Upload className="w-4 h-4" />,       label: "Upload",   color: "text-sub"     },
  PENDING:       { icon: <Clock className="w-4 h-4" />,        label: "Pending",  color: "text-gold"    },
  APPROVED:      { icon: <CheckCircle className="w-4 h-4" />,  label: "Approved", color: "text-leaf"    },
  REJECTED:      { icon: <XCircle className="w-4 h-4" />,      label: "Rejected", color: "text-red-500" },
};

export default function KycPage() {
  const router  = useRouter();
  const [token,   setToken]   = useState<string | null>(null);
  const [userId,  setUserId]  = useState<string | null>(null);
  const [docs,    setDocs]    = useState<Record<DocKey, DocState>>(() =>
    Object.fromEntries(DOCS.map((d) => [d.key, { status: "NOT_SUBMITTED" as DocStatus, uploading: false }])) as Record<DocKey, DocState>
  );
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
      setUserId(session.user.id);

      try {
        const res  = await fetch("/api/documents/my", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const json = await res.json();
        if (json.data) {
          setDocs((prev) => {
            const next = { ...prev };
            for (const doc of json.data) {
              if (doc.doc_type in next) {
                next[doc.doc_type as DocKey] = { ...next[doc.doc_type as DocKey], status: doc.status };
              }
            }
            return next;
          });
        }
      } catch {
        toast.error("Failed to load document status");
      }
    }).catch(() => { router.replace("/login"); });
  }, [router]);

  async function handleUpload(docKey: DocKey, file: File) {
    if (!token || !userId) return;
    setDocs((p) => ({ ...p, [docKey]: { ...p[docKey], uploading: true } }));
    try {
      const fd = new FormData();
      fd.append("file",        file);
      fd.append("entity_type", "DRIVER");
      fd.append("entity_id",   userId);
      fd.append("doc_type",    docKey);
      const res  = await fetch("/api/documents/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success("Uploaded — under review");
        setDocs((p) => ({ ...p, [docKey]: { status: "PENDING", uploading: false } }));
        return;
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setDocs((p) => ({ ...p, [docKey]: { ...p[docKey], uploading: false } }));
    }
  }

  const allSubmitted = DOCS.every((d) => docs[d.key].status !== "NOT_SUBMITTED");
  const allApproved  = DOCS.every((d) => docs[d.key].status === "APPROVED");

  return (
    <div className="green-container min-h-screen bg-cream pb-12">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-start gap-3">
          <Link href="/drivers/pending" className="text-lime/70 -ml-1 mt-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-lime/60 text-xs font-mono uppercase tracking-widest mb-1">Green Rides</p>
            <h1 className="font-display text-2xl text-white">KYC Documents</h1>
            <p className="text-lime/60 text-sm mt-1">Upload once — reviewed within 24 hours</p>
          </div>
        </div>
      </header>

      <div className="px-4 mt-5 space-y-3">
        {allApproved && (
          <div className="bg-leaf/10 border border-leaf/30 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-leaf flex-shrink-0" />
            <p className="text-sm font-semibold text-leaf">All documents approved! You&apos;re ready to drive.</p>
          </div>
        )}

        {DOCS.map((doc) => {
          const state = docs[doc.key];
          const ui    = STATUS_UI[state.status];
          return (
            <div key={doc.key} className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <FileText className="w-4 h-4 text-sub flex-shrink-0" />
                    <p className="font-semibold text-text text-sm">{doc.label}</p>
                  </div>
                  <p className="text-xs text-sub pl-6">{doc.hint}</p>
                </div>
                <div className={`flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold ${ui.color}`}>
                  {state.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : ui.icon}
                  <span>{state.uploading ? "Uploading…" : ui.label}</span>
                </div>
              </div>

              {(state.status === "NOT_SUBMITTED" || state.status === "REJECTED") && !state.uploading && (
                <>
                  <input
                    ref={(el) => { fileRefs.current[doc.key] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(doc.key, f);
                      if (fileRefs.current[doc.key]) fileRefs.current[doc.key]!.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileRefs.current[doc.key]?.click()}
                    className={`mt-3 w-full py-2.5 rounded-xl text-xs font-semibold border transition-colors
                      ${state.status === "REJECTED"
                        ? "border-red-300 text-red-500 bg-red-50"
                        : "border-leaf/30 text-leaf bg-leaf/5 hover:bg-leaf/10"}`}
                  >
                    {state.status === "REJECTED" ? "Re-upload document" : "Choose file (JPG, PNG, PDF · max 10 MB)"}
                  </button>
                </>
              )}
            </div>
          );
        })}

        <div className="bg-pale border border-border rounded-2xl p-4 text-xs text-sub space-y-1 mt-2">
          <p className="font-semibold text-text">What happens next?</p>
          <p>Our team reviews documents within 24 hours. You&apos;ll receive a Telegram notification once approved.</p>
          <p>You can close this page and come back — your uploads are saved.</p>
        </div>

        {allSubmitted && !allApproved && (
          <Link href="/drivers/pending"
            className="block w-full text-center bg-forest text-white font-semibold py-3.5 rounded-2xl mt-2">
            Back to Status →
          </Link>
        )}
      </div>
    </div>
  );
}
