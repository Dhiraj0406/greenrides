import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Green Rides",
  description: "How Green Rides collects, uses, protects and processes your personal data under DPDP Act 2023.",
};

export default function PrivacyPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/" className="text-lime/70 hover:text-lime flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white">Privacy Policy</h1>
            <p className="text-lime/60 text-xs mt-0.5">DPDP Act 2023 Compliant</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-7 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: June 2026 · Effective immediately upon use of the platform</p>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">1. Identity of the Data Fiduciary</h2>
          <p>This Privacy Policy describes how Green Rides (&ldquo;Data Fiduciary&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), operating from Koraput, Odisha, India, processes personal data of users (&ldquo;Data Principals&rdquo;) in accordance with the Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;), the Information Technology Act, 2000, and other applicable Indian law.</p>
          <p className="mt-2">By using the Green Rides Platform, you provide free, specific, informed, and unambiguous consent to the processing of your personal data as described herein, in accordance with Section 6 of the DPDP Act.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">2. Personal Data We Collect</h2>
          <p className="mb-2">We collect only the minimum data necessary for the stated purposes:</p>

          <div className="space-y-3">
            <div className="bg-pale border border-border rounded-xl p-3">
              <p className="font-semibold text-forest text-xs uppercase tracking-wide mb-1">Identity &amp; Contact</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Mobile phone number</strong> — for OTP-based login and account security</li>
                <li><strong>Name</strong> — optionally provided, used for personalisation and driver communication</li>
              </ul>
            </div>
            <div className="bg-pale border border-border rounded-xl p-3">
              <p className="font-semibold text-forest text-xs uppercase tracking-wide mb-1">Trip Data</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Origin and destination city</strong></li>
                <li><strong>Travel date and time</strong></li>
                <li><strong>Fare agreed</strong></li>
                <li><strong>Trip status and OTP</strong> (for ride verification)</li>
                <li><strong>Notes</strong> you voluntarily provide</li>
              </ul>
            </div>
            <div className="bg-pale border border-border rounded-xl p-3">
              <p className="font-semibold text-forest text-xs uppercase tracking-wide mb-1">Device &amp; Usage Data</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Approximate location</strong> — detected from IP address at session start to suggest your nearest city. Not tracked continuously. Not stored.</li>
                <li><strong>Anonymised usage events</strong> — page views, button clicks, booking funnel steps — collected via PostHog analytics to improve the Platform</li>
              </ul>
            </div>
            <div className="bg-pale border border-border rounded-xl p-3">
              <p className="font-semibold text-forest text-xs uppercase tracking-wide mb-1">Drivers &amp; Fleet Owners Only</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Driving licence number</li>
                <li>Vehicle registration number, model, insurance details</li>
                <li>PAN / Aadhaar (for KYC and tax purposes)</li>
                <li>Scanned copies of identity and vehicle documents</li>
                <li>Bank account details (for payouts)</li>
                <li>Telegram user ID (optional, for dispatch notifications)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">3. Purposes of Processing</h2>
          <p>We process your personal data only for the following specified, lawful purposes under Section 4 and 7 of the DPDP Act:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Service provision:</strong> Matching passengers with drivers, confirming bookings, and managing the trip lifecycle.</li>
            <li><strong>Communication:</strong> Sending booking confirmation, trip updates, and driver contact details via WhatsApp (through Interakt) or SMS.</li>
            <li><strong>Safety:</strong> Maintaining trip records for dispute resolution and passenger safety.</li>
            <li><strong>Driver onboarding:</strong> Verifying driver identity, vehicle compliance, and KYC documentation as required under the Motor Vehicles Act.</li>
            <li><strong>Payments:</strong> Processing online payments via Razorpay and managing driver payouts.</li>
            <li><strong>Legal compliance:</strong> Maintaining records as required under applicable tax, transport, and consumer protection laws.</li>
            <li><strong>Platform improvement:</strong> Analysing anonymised usage data to improve features and performance.</li>
          </ul>
          <p className="mt-2">We do not process your personal data for profiling, targeted advertising, or sale to third parties.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">4. Data Sharing and Third Parties</h2>
          <p>We share your personal data only where necessary, with the following categories of recipients:</p>
          <div className="space-y-2 mt-2">
            <div className="border-l-2 border-leaf pl-3">
              <p className="font-semibold text-sm">Assigned Driver</p>
              <p className="text-sub text-xs">Your name and phone number are shared with the driver assigned to your trip, solely for trip coordination.</p>
            </div>
            <div className="border-l-2 border-leaf pl-3">
              <p className="font-semibold text-sm">Supabase Inc. (USA)</p>
              <p className="text-sub text-xs">Our database and authentication infrastructure provider. Data is stored on AWS servers (ap-southeast-1 region). Supabase acts as a Data Processor under our instructions. Transfer is made under standard contractual clauses.</p>
            </div>
            <div className="border-l-2 border-leaf pl-3">
              <p className="font-semibold text-sm">Razorpay Software Pvt. Ltd. (India)</p>
              <p className="text-sub text-xs">Payment processing for online transactions. Razorpay is PCI-DSS compliant. We share only the transaction amount and booking reference, not your card details.</p>
            </div>
            <div className="border-l-2 border-leaf pl-3">
              <p className="font-semibold text-sm">Interakt (Jio Haptik Technologies)</p>
              <p className="text-sub text-xs">WhatsApp Business API provider for trip notifications. Your phone number and booking details are shared for message delivery only.</p>
            </div>
            <div className="border-l-2 border-leaf pl-3">
              <p className="font-semibold text-sm">PostHog Inc. (USA)</p>
              <p className="text-sub text-xs">Analytics platform. Usage data is anonymised and does not include your phone number or personal identifiers.</p>
            </div>
          </div>
          <p className="mt-3">We do not sell, rent, or trade your personal data with any other party. We do not share data with law enforcement except in response to lawful orders or as required to prevent imminent harm.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">5. Data Retention</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Trip records:</strong> Retained for 24 months for dispute resolution and legal compliance under the Consumer Protection Act, 2019.</li>
            <li><strong>Driver KYC documents:</strong> Retained for the duration of the driver&apos;s engagement plus 5 years, as required under applicable financial and transport regulations.</li>
            <li><strong>Account data:</strong> Retained until you request deletion, subject to legal hold obligations.</li>
            <li><strong>Anonymised analytics:</strong> May be retained indefinitely as they contain no personal identifiers.</li>
          </ul>
          <p className="mt-2">On expiry of retention periods, data is deleted or irreversibly anonymised.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">6. Your Rights as a Data Principal</h2>
          <p>Under the DPDP Act, 2023, you have the following rights:</p>
          <div className="space-y-2 mt-2">
            <div className="border-l-2 border-gold pl-3">
              <p className="font-semibold text-sm">Right to Access (Section 11)</p>
              <p className="text-sub text-xs">Request a summary of the personal data we hold about you and the purposes for which it is processed.</p>
            </div>
            <div className="border-l-2 border-gold pl-3">
              <p className="font-semibold text-sm">Right to Correction and Erasure (Section 12)</p>
              <p className="text-sub text-xs">Request correction of inaccurate data or erasure of data where processing is no longer necessary, subject to legal retention obligations.</p>
            </div>
            <div className="border-l-2 border-gold pl-3">
              <p className="font-semibold text-sm">Right to Withdraw Consent (Section 6)</p>
              <p className="text-sub text-xs">Withdraw consent for processing at any time. Withdrawal does not affect prior lawful processing. Withdrawal may prevent you from using the Platform.</p>
            </div>
            <div className="border-l-2 border-gold pl-3">
              <p className="font-semibold text-sm">Right to Grievance Redressal (Section 13)</p>
              <p className="text-sub text-xs">Raise a complaint with our Grievance Officer (details below) and, if unsatisfied, with the Data Protection Board of India.</p>
            </div>
            <div className="border-l-2 border-gold pl-3">
              <p className="font-semibold text-sm">Right of Nomination (Section 14)</p>
              <p className="text-sub text-xs">Nominate a person to exercise your rights in the event of your death or incapacity.</p>
            </div>
          </div>
          <p className="mt-2">To exercise any of these rights, contact our Grievance Officer at support@greenrides.co.in. We will respond within 30 days.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">7. Security Measures</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All data is transmitted over TLS 1.2+ encrypted connections.</li>
            <li>Database access is protected by Supabase Row-Level Security (RLS) policies, ensuring each user can only access their own data.</li>
            <li>Authentication uses OTP-only login; no passwords are stored.</li>
            <li>Sensitive driver documents are stored in private, access-controlled Supabase Storage buckets.</li>
            <li>Admin access requires a separate secret token and is not accessible to the public.</li>
            <li>We conduct periodic reviews of access controls and data handling practices.</li>
          </ul>
          <p className="mt-2">Despite these measures, no data transmission over the internet can be guaranteed to be 100% secure. If you suspect a data breach, please contact us immediately at support@greenrides.co.in.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">8. Children&apos;s Privacy</h2>
          <p>The Platform is not intended for children under 18. We do not knowingly collect personal data from minors. If a parent or guardian believes a minor has provided personal data, they should contact us for immediate deletion. Under the DPDP Act, we will obtain verifiable parental consent before processing personal data of children.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">9. Cross-Border Data Transfer</h2>
          <p>Your data is stored on Supabase infrastructure located in the AWS ap-southeast-1 (Singapore) region. Such transfer is necessary for the provision of our services. We ensure appropriate safeguards through data processing agreements with Supabase. Transfers outside India are made in compliance with Section 16 of the DPDP Act and applicable Government notifications.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">10. Cookies and Analytics</h2>
          <p>The Green Rides web application uses local storage for authentication session management. We use PostHog for anonymised behavioural analytics. PostHog is configured to anonymise all event data and does not track personal identifiers. You may opt out of analytics by using a browser with privacy mode enabled.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">11. Grievance Officer</h2>
          <p>In accordance with Section 13 of the DPDP Act and Rule 5 of the IT (Intermediary Guidelines) Rules, our Grievance Officer is:</p>
          <div className="bg-pale border border-border rounded-xl p-3 mt-2 space-y-1">
            <p><strong>Grievance Officer:</strong> Green Rides Support</p>
            <p><strong>Email:</strong> support@greenrides.co.in</p>
            <p><strong>Address:</strong> Green Rides, Koraput, Odisha – 764020, India</p>
            <p><strong>Acknowledgement:</strong> Within 24 hours of receipt</p>
            <p><strong>Resolution:</strong> Within 30 days as mandated by law</p>
          </div>
          <p className="mt-2">If your complaint is not resolved satisfactorily, you may escalate to the <strong>Data Protection Board of India</strong> (once operational) or approach the appropriate Consumer Disputes Redressal Commission.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">12. Changes to This Policy</h2>
          <p>We will notify you of material changes to this Privacy Policy through the Platform or by SMS/WhatsApp to your registered number at least 7 days before changes take effect. Your continued use of the Platform after the effective date constitutes acceptance of the revised Policy.</p>
        </section>

        <div className="pt-4 border-t border-border space-y-2">
          <Link href="/terms" className="block text-leaf text-sm font-semibold">Terms of Service →</Link>
          <Link href="/driver-agreement" className="block text-leaf text-sm font-semibold">Driver Agreement →</Link>
          <Link href="/fleet-agreement" className="block text-leaf text-sm font-semibold">Fleet Owner Agreement →</Link>
        </div>
      </div>
    </div>
  );
}
