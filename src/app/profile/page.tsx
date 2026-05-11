"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BottomNav } from "@/components/shared/BottomNav";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ phone: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      const phone       = data.user.phone ?? "";
      const displayName = data.user.user_metadata?.name ?? "";
      setUser({ phone, name: displayName });
      setName(displayName);
      setLoading(false);
    });
  }, [router]);

  async function handleSaveName() {
    setSaving(true);
    await supabase.auth.updateUser({ data: { name } });
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) return (
    <div className="green-container min-h-screen bg-cream flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-leaf" />
    </div>
  );

  return (
    <div className="green-container min-h-screen bg-cream pb-24">
      <header className="bg-forest px-4 pt-safe-top pb-8">
        <div className="pt-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-leaf/20 flex items-center justify-center mb-3">
            <User className="w-8 h-8 text-lime" />
          </div>
          <p className="text-white font-semibold text-lg">{name || "Green Rider"}</p>
          <p className="text-lime/60 text-sm">+91 {user?.phone?.replace("+91", "")}</p>
        </div>
      </header>

      <div className="px-4 mt-6 space-y-4">
        {/* Name edit */}
        <div className="bg-white border border-border rounded-2xl p-4">
          <label className="text-xs text-sub font-semibold uppercase tracking-wide mb-2 block">
            Display Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 bg-warm rounded-2xl px-3 py-2.5 text-sm text-text outline-none focus:ring-1 focus:ring-leaf/30"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || name === user?.name}
              className="touch-target bg-leaf disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl"
            >
              {saving ? "..." : "Save"}
            </button>
          </div>
        </div>

        {/* Phone (read-only) */}
        <div className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
          <Phone className="w-4 h-4 text-sub" />
          <div>
            <p className="text-xs text-sub">Mobile number</p>
            <p className="text-sm font-semibold text-text">+91 {user?.phone?.replace("+91", "")}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="touch-target w-full flex items-center justify-center gap-2 border border-red-200
                     text-red-500 font-semibold py-4 rounded-2xl text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>

        {/* Admin */}
        <div className="text-center pt-2">
          <Link href="/admin" className="text-xs text-sub/50 hover:text-sub transition-colors">
            Admin →
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
