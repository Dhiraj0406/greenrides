import { ChevronLeft, Leaf } from "lucide-react";
import Link from "next/link";
import { RideForm } from "@/components/driver/RideForm";

export default function PostRidePage() {
  return (
    <div className="green-container min-h-screen bg-cream pb-10">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link
            href="/driver/dashboard"
            className="w-8 h-8 rounded-full bg-forest-mid flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-lime" />
          </Link>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-lime" />
            <span className="font-display text-xl text-lime">Post a Ride</span>
          </div>
        </div>
      </header>

      <div className="px-4 mt-6">
        <p className="text-sm text-sub mb-6">
          Fill in your route details. Riders in Odisha hill towns will see your listing.
        </p>
        <RideForm />
      </div>
    </div>
  );
}
