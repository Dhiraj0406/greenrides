"use client";

import { Leaf, WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-forest flex items-center justify-center mb-6 shadow-lg shadow-forest/30">
        <Leaf className="w-8 h-8 text-lime" />
      </div>

      <WifiOff className="w-8 h-8 text-sub mb-4" />

      <h1 className="font-display text-2xl text-forest mb-2">You're offline</h1>
      <p className="text-sm text-sub mb-8 max-w-xs">
        No internet connection. To book a ride, call us directly.
      </p>

      <a
        href="tel:+919668021577"
        className="flex items-center gap-2 bg-forest text-white text-sm font-semibold px-6 py-3.5 rounded-2xl shadow-lg shadow-forest/30 mb-4"
      >
        Call: +91 96680 21577
      </a>

      <button
        onClick={() => window.location.reload()}
        className="text-sm text-leaf font-semibold underline underline-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
