import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Green Rides",
  description: "Terms and conditions for using the Green Rides platform.",
};

export default function TermsPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/" className="text-lime/70 hover:text-lime">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-2xl text-white">Terms of Service</h1>
        </div>
      </header>

      <div className="px-6 py-8 space-y-6 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: May 2026</p>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">1. Acceptance</h2>
          <p>By using Green Rides, you agree to these terms. If you do not agree, please do not use the platform.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">2. Service Description</h2>
          <p>Green Rides is an intercity cab booking platform connecting riders with verified drivers on Odisha&apos;s hill routes including Koraput, Jeypore, and surrounding areas.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">3. User Responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide accurate booking information including pickup location, travel date, and contact number.</li>
            <li>Be present at the pickup point at the agreed time.</li>
            <li>Treat drivers respectfully.</li>
            <li>Do not misuse the platform for fraudulent bookings.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">4. Bookings and Cancellations</h2>
          <p>Ride requests are confirmed subject to driver availability. Cancellations must be communicated via WhatsApp or phone as early as possible. Green Rides reserves the right to cancel requests that cannot be fulfilled.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">5. Pricing</h2>
          <p>Fares displayed are estimates. Final fare may vary based on route, fuel costs, and driver discretion. All payments are collected by the driver directly unless online payment is used.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">6. Limitation of Liability</h2>
          <p>Green Rides is a technology platform and is not responsible for accidents, delays, or driver behaviour. Rides are undertaken at the user&apos;s own risk.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">7. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">8. Contact</h2>
          <p>
            For questions, reach us on{" "}
            <a href="https://wa.me/919668021577" className="text-leaf underline">WhatsApp</a>.
          </p>
        </section>

        <div className="pt-4 border-t border-border">
          <Link href="/privacy" className="text-leaf text-sm underline">Privacy Policy →</Link>
        </div>
      </div>
    </div>
  );
}
