// src/components/drivers/OnlineToggle.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Props {
  initialValue: boolean;
  onChanged: (isOnline: boolean) => void;
}

export function OnlineToggle({ initialValue, onChanged }: Props) {
  const [isOnline, setIsOnline] = useState(initialValue);
  const [loading, setLoading]   = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const next = !isOnline;
      const res  = await fetch("/api/drivers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_online: next }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not update status");
        return;
      }

      setIsOnline(next);
      onChanged(next);
      toast.success(next ? "You are now online" : "You are now offline");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all font-semibold text-sm",
        isOnline
          ? "bg-leaf/10 border-leaf text-leaf"
          : "bg-gray-50 border-border text-sub"
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span className={cn("w-3 h-3 rounded-full", isOnline ? "bg-leaf animate-pulse" : "bg-gray-400")} />
      )}
      {isOnline ? "Online — receiving requests" : "Offline — tap to go online"}
    </button>
  );
}
