import { Leaf } from "lucide-react";
import { StatsCards } from "@/components/admin/StatsCards";
import { GlobalDiscount } from "@/components/admin/GlobalDiscount";
import { FareTable } from "@/components/admin/FareTable";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="green-container min-h-screen bg-cream pb-10">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-lime" />
            <span className="font-display text-xl text-lime">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/drivers" className="text-xs text-lime/70">Drivers</Link>
            <Link href="/admin/bookings" className="text-xs text-lime/70">Bookings</Link>
          </div>
        </div>
      </header>

      <div className="px-4 mt-6 space-y-6">
        {/* Stats */}
        <section>
          <h2 className="text-sm font-semibold text-sub uppercase tracking-wide mb-3">
            Today's Overview
          </h2>
          <StatsCards />
        </section>

        {/* Global discount */}
        <section>
          <h2 className="text-sm font-semibold text-sub uppercase tracking-wide mb-3">
            Promotions
          </h2>
          <GlobalDiscount />
        </section>

        {/* Fare table */}
        <section>
          <h2 className="text-sm font-semibold text-sub uppercase tracking-wide mb-3">
            Fare Configuration
          </h2>
          <FareTable />
        </section>
      </div>
    </div>
  );
}
