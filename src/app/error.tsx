"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Leaf, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="green-container min-h-screen bg-forest flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-leaf flex items-center justify-center mb-6">
        <Leaf className="w-8 h-8 text-white" />
      </div>
      <h1 className="font-display text-2xl text-white mb-2">Something went wrong</h1>
      <p className="text-lime/60 text-sm mb-8 max-w-xs">
        An unexpected error occurred. Try refreshing or go back home.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-leaf text-white font-semibold px-5 py-3 rounded-xl text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-white/10 text-lime font-semibold px-5 py-3 rounded-xl text-sm"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
