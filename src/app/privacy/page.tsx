import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Green Rides",
  description: "How Green Rides collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/" className="text-lime/70 hover:text-lime">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-2xl text-white">Privacy Policy</h1>
        </div>
      </header>

      <div className="px-6 py-8 space-y-6 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: May 2026</p>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">1. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Phone number</strong> — used for OTP login and driver communication.</li>
            <li><strong>Location</strong> — optionally detected to suggest your nearest city. Not stored continuously.</li>
            <li><strong>Booking details</strong> — origin, destination, travel date, and fare for fulfilling your ride.</li>
            <li><strong>Usage data</strong> — anonymised analytics via PostHog to improve the product.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">2. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To confirm and fulfill your ride booking.</li>
            <li>To send ride updates via WhatsApp (only if you consent).</li>
            <li>To contact you in case of driver or schedule changes.</li>
            <li>To improve platform reliability and features.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">3. Data Sharing</h2>
          <p>We share your phone number with your assigned driver so they can contact you. We do not sell your data to third parties.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">4. Data Retention</h2>
          <p>Booking records are retained for up to 12 months for operational and dispute resolution purposes. You may request deletion by contacting us.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">5. Your Rights</h2>
          <p>Under India&apos;s Digital Personal Data Protection Act (DPDPA) 2023, you have the right to access, correct, and request deletion of your personal data. Contact us via WhatsApp to exercise these rights.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">6. Security</h2>
          <p>All data is stored on Supabase with row-level security policies. OTP authentication ensures only you can access your account.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">7. Contact</h2>
          <p>
            Privacy questions? Reach us on{" "}
            <a href="https://wa.me/919668021577" className="text-leaf underline">WhatsApp</a>.
          </p>
        </section>

        <div className="pt-4 border-t border-border">
          <Link href="/terms" className="text-leaf text-sm underline">Terms of Service →</Link>
        </div>
      </div>
    </div>
  );
}
