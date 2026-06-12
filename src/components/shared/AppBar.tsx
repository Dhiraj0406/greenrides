// src/components/shared/AppBar.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AppBar() {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.name) {
        setFirstName((data.user.user_metadata.name as string).split(" ")[0]);
      }
    });
  }, []);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--paper)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="green-container mx-auto flex items-center justify-between px-4 h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--green)" }}
          >
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <span
            className="font-display text-xl font-bold"
            style={{ color: "var(--green)" }}
          >
            Green
          </span>
          <span
            className="w-2 h-2 rounded-full animate-live-pulse"
            style={{ background: "var(--green-3)" }}
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a
            href="tel:+919668021577"
            className="w-9 h-9 rounded-full flex items-center justify-center border"
            style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
            aria-label="Call us"
          >
            <Phone className="w-4 h-4" />
          </a>
          {firstName ? (
            <Link
              href="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{
                background: "var(--green-5)",
                borderColor: "var(--green-4)",
                color: "var(--green)",
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: "var(--green)" }}
              >
                {firstName[0].toUpperCase()}
              </span>
              {firstName}
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "var(--green-5)", color: "var(--green)" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
