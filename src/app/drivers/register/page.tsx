import { ChevronLeft, Leaf } from "lucide-react";
import Link from "next/link";
import { RegisterForm } from "@/components/drivers/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="green-container min-h-screen bg-cream pb-10">
      <header className="bg-forest px-4 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/drivers" className="w-8 h-8 rounded-full bg-forest-mid flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-lime" />
          </Link>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-lime" />
            <span className="font-display text-xl text-lime">Become a Driver</span>
          </div>
        </div>
      </header>
      <div className="px-4 mt-6">
        <p className="text-sm text-sub mb-6">
          Complete the steps below to join Green Rides as a driver. Your account will be reviewed within 24 hours.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
