import Link from "next/link";
import { Leaf, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="green-container min-h-screen bg-forest flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-leaf flex items-center justify-center mb-6">
        <Leaf className="w-8 h-8 text-white" />
      </div>
      <h1 className="font-display text-5xl text-lime mb-2">404</h1>
      <h2 className="font-display text-2xl text-white mb-3">Page not found</h2>
      <p className="text-lime/60 text-sm mb-8 max-w-xs">
        This page doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-leaf text-white font-semibold px-6 py-3.5 rounded-2xl text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </div>
  );
}
