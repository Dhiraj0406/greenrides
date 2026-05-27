"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, User, Phone, Car, Hash, Upload, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DriverProfileData {
  license_number: string | null;
  vehicle_type:   string | null;
  vehicle_number: string | null;
  vehicle_model:  string | null;
  is_approved:    boolean;
  kyc_status:     string | null;
  user:           { name: string | null; phone: string };
}

interface MyDocument {
  id:          string;
  doc_type:    string;
  status:      "PENDING" | "APPROVED" | "REJECTED";
  updated_at:  string;
}

const DOC_LABELS: Record<string, string> = {
  driving_license:   "Driving Licence",
  vehicle_rc:        "Vehicle Registration (RC)",
  vehicle_insurance: "Vehicle Insurance",
  aadhaar:           "Aadhaar Card",
};

const STATUS_ICON: Record<MyDocument["status"], React.ReactNode> = {
  PENDING:  <Clock className="w-4 h-4 text-gold" />,
  APPROVED: <CheckCircle className="w-4 h-4 text-leaf" />,
  REJECTED: <XCircle className="w-4 h-4 text-red-500" />,
};

const STATUS_LABEL: Record<MyDocument["status"], string> = {
  PENDING:  "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected — re-upload",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-full bg-pale flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-leaf" />
      </div>
      <div>
        <p className="text-xs text-sub">{label}</p>
        <p className="text-sm font-semibold text-text">{value || "—"}</p>
      </div>
    </div>
  );
}

function DocRow({
  docType, existing, userId, token, onUploaded,
}: {
  docType:    string;
  existing:   MyDocument | undefined;
  userId:     string;
  token:      string;
  onUploaded: () => void;
}) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",        file);
      fd.append("entity_type", "DRIVER");
      fd.append("entity_id",   userId);
      fd.append("doc_type",    docType);

      const res  = await fetch("/api/documents/upload", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Upload failed"); return; }
      toast.success("Document uploaded — pending review");
      onUploaded();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const canUpload = !existing || existing.status !== "APPROVED";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">{DOC_LABELS[docType] ?? docType}</p>
        {existing ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            {STATUS_ICON[existing.status]}
            <span className={`text-xs ${existing.status === "APPROVED" ? "text-leaf" : existing.status === "REJECTED" ? "text-red-500" : "text-gold"}`}>
              {STATUS_LABEL[existing.status]}
            </span>
          </div>
        ) : (
          <p className="text-xs text-sub mt-0.5">Not uploaded</p>
        )}
      </div>
      {canUpload && (
        <>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-semibold text-leaf border border-leaf/30 px-3 py-1.5 rounded-xl disabled:opacity-50 ml-3 flex-shrink-0"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {existing ? "Re-upload" : "Upload"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [docs, setDocs]       = useState<MyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken]     = useState("");
  const [userId, setUserId]   = useState("");

  function fetchDocs(accessToken: string) {
    fetch("/api/documents/my", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((j) => setDocs(j.data ?? []));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const t = session.access_token;
      setToken(t);
      setUserId(session.user.id);
      Promise.all([
        fetch("/api/fleet/driver/profile", { headers: { Authorization: `Bearer ${t}` } })
          .then((r) => r.json())
          .then((j) => setProfile(j.data ?? null)),
        fetch("/api/documents/my", { headers: { Authorization: `Bearer ${t}` } })
          .then((r) => r.json())
          .then((j) => setDocs(j.data ?? [])),
      ]).finally(() => setLoading(false));
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/register";
  }

  const docMap = new Map(docs.map((d) => [d.doc_type, d]));

  return (
    <div className="px-4 py-6">
      <h2 className="font-display text-xl text-forest mb-4">My Profile</h2>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-leaf" /></div>}

      {!loading && profile && (
        <>
          {/* ── Identity card ───────────────────── */}
          <div className="flex items-center gap-4 bg-white border border-border rounded-2xl p-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-leaf/10 flex items-center justify-center">
              <User className="w-7 h-7 text-leaf" />
            </div>
            <div>
              <p className="font-semibold text-text">{profile.user.name ?? "Driver"}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${profile.is_approved ? "bg-leaf/10 text-leaf" : "bg-gold/10 text-gold"}`}>
                  {profile.is_approved ? "Approved" : "Pending"}
                </span>
                {profile.kyc_status && profile.kyc_status !== "NOT_SUBMITTED" && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    profile.kyc_status === "APPROVED" ? "bg-leaf/10 text-leaf" :
                    profile.kyc_status === "REJECTED" ? "bg-red-50 text-red-500" :
                    "bg-gold/10 text-gold"
                  }`}>
                    KYC {profile.kyc_status.charAt(0) + profile.kyc_status.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Profile details ─────────────────── */}
          <div className="bg-white border border-border rounded-2xl px-4 mb-4">
            <Row icon={Phone} label="Phone"          value={`+91 ${profile.user.phone}`} />
            <Row icon={Hash}  label="Licence Number" value={profile.license_number} />
            <Row icon={Car}   label="Vehicle Type"   value={profile.vehicle_type} />
            <Row icon={Car}   label="Vehicle Number" value={profile.vehicle_number} />
            <Row icon={Car}   label="Vehicle Model"  value={profile.vehicle_model} />
          </div>

          {/* ── KYC Documents ───────────────────── */}
          <div className="bg-white border border-border rounded-2xl px-4 mb-4">
            <div className="py-3 border-b border-border">
              <p className="text-xs font-bold text-sub uppercase tracking-wide">KYC Documents</p>
              <p className="text-xs text-sub mt-0.5">Upload JPEG, PNG, WebP or PDF · max 10 MB each</p>
            </div>
            {Object.keys(DOC_LABELS).map((dt) => (
              <DocRow
                key={dt}
                docType={dt}
                existing={docMap.get(dt)}
                userId={userId}
                token={token}
                onUploaded={() => fetchDocs(token)}
              />
            ))}
          </div>

          <button
            onClick={signOut}
            className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 border border-red-200 bg-red-50"
          >
            Sign Out
          </button>
        </>
      )}

      {!loading && !profile && (
        <p className="text-center text-sub text-sm py-12">Profile not found.</p>
      )}
    </div>
  );
}
