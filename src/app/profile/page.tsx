"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";
import { AppBar } from "@/components/shared/AppBar";
import { Loader2, MessageCircle, Phone, Shield, Car, ChevronRight, Pencil, Check, X } from "lucide-react";
import { SUPPORT_WA, SUPPORT_PHONE } from "@/data/constants";
import { toast } from "sonner";

interface Profile {
  name:  string;
  phone: string;
}

export default function AccountPage() {
  const router                        = useRouter();
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [signingOut, setSigningOut]   = useState(false);
  const [editing, setEditing]         = useState(false);
  const [nameInput, setNameInput]     = useState("");
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); router.replace("/login?next=/profile"); return; }
      const name  = (session.user.user_metadata?.name as string | undefined) ?? "—";
      const phone = session.user.phone ?? "—";
      setProfile({ name, phone });
      setLoading(false);
    });
  }, [router]);

  function startEdit() {
    setNameInput(profile?.name ?? "");
    setEditing(true);
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: trimmed } });
      if (error) throw error;
      setProfile((p) => p ? { ...p, name: trimmed } : p);
      toast.success("Name updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login");
    } catch {
      toast.error("Sign out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--paper)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--green)" }} />
      </div>
    );
  }

  const initials = (profile?.name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const menuItems = [
    {
      icon:     MessageCircle,
      label:    "WhatsApp Support",
      href:     SUPPORT_WA,
      external: true,
      color:    "#075e54",
    },
    {
      icon:     Phone,
      label:    "Call Us",
      href:     `tel:${SUPPORT_PHONE}`,
      external: false,
      color:    "var(--green)",
    },
    {
      icon:     Shield,
      label:    "Safety & Trust",
      href:     "/terms",
      external: false,
      color:    "var(--green-2)",
    },
    {
      icon:     Car,
      label:    "Used Cars",
      href:     "/used-cars",
      external: false,
      color:    "var(--green-3)",
    },
  ];

  return (
    <div className="green-container min-h-screen pb-24" style={{ background: "var(--paper-2)" }}>
      <AppBar />

      <div className="px-4 pt-6 space-y-4">
        {/* Profile card */}
        <div
          className="rounded-2xl p-5 text-center"
          style={{ background: "var(--paper)" }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white mx-auto mb-3 font-display text-xl font-bold"
            style={{ background: "var(--green)" }}
          >
            {initials}
          </div>

          {editing ? (
            <div className="flex items-center gap-2 justify-center mt-1 mb-1">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                className="text-base font-semibold text-center rounded-lg px-3 py-1.5 border outline-none"
                style={{ borderColor: "var(--green)", color: "var(--ink)", background: "var(--paper-2)", width: 180 }}
                maxLength={60}
              />
              <button
                onClick={saveName}
                disabled={saving || !nameInput.trim()}
                className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40"
                style={{ background: "var(--green)" }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Check className="w-3.5 h-3.5 text-white" />}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "var(--paper-3)" }}
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--ink-3)" }} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2
                className="font-display text-xl font-bold"
                style={{ color: "var(--ink)" }}
              >
                {profile?.name}
              </h2>
              <button
                onClick={startEdit}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "var(--paper-3)" }}
              >
                <Pencil className="w-3 h-3" style={{ color: "var(--ink-3)" }} />
              </button>
            </div>
          )}

          <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
            {profile?.phone}
          </p>
        </div>

        {/* Menu group */}
        <div
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: "var(--border)", background: "var(--paper)" }}
        >
          {menuItems.map(({ icon: Icon, label, href, external, color }, i) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 px-4 py-4"
              style={{
                borderBottom:
                  i < menuItems.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--paper-3)" }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span
                className="flex-1 text-sm font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {label}
              </span>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--ink-4)" }} />
            </a>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-4 rounded-2xl text-sm font-bold border-2 transition-colors disabled:opacity-60"
          style={{ borderColor: "#ef4444", color: "#ef4444" }}
        >
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
