"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline  = () => { setIsOffline(false); toast.success("Back online"); };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, []);

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 bg-gold text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 transition-all ${
        isOffline ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <WifiOff className="w-4 h-4" />
      You&apos;re offline — check your connection
    </div>
  );
}
