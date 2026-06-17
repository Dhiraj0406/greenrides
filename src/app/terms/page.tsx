import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Green Rides",
  description: "Terms and conditions for using the Green Rides intercity cab booking platform.",
};

export default function TermsPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/" className="text-lime/70 hover:text-lime flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white">Terms of Service</h1>
            <p className="text-lime/60 text-xs mt-0.5">Green Rides · Passenger Terms</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-7 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: June 2026 · Effective immediately upon use of the platform</p>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">1. About Green Rides</h2>
          <p>Green Rides (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a technology platform operated from Koraput, Odisha, India that connects passengers with independent drivers for intercity and day-trip cab services on hill routes in Odisha. Green Rides is an aggregator as defined under Section 93A of the Motor Vehicles Act, 1988 (inserted by the Motor Vehicles (Amendment) Act, 2019).</p>
          <p className="mt-2">Green Rides does not own any vehicles and does not employ any drivers. All rides are provided by independent drivers and fleet owners who have contracted with the Platform.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">2. Acceptance of Terms</h2>
          <p>By accessing or using Green Rides — including registering an account, requesting a ride, or browsing the Platform — you (&ldquo;User&rdquo;, &ldquo;Passenger&rdquo;, &ldquo;you&rdquo;) agree to be bound by these Terms of Service, our Privacy Policy, and all applicable laws of India, including but not limited to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>The Information Technology Act, 2000 and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</li>
            <li>The Motor Vehicles Act, 1988 (as amended in 2019)</li>
            <li>The Consumer Protection Act, 2019</li>
            <li>The Digital Personal Data Protection Act, 2023</li>
            <li>The Indian Contract Act, 1872</li>
          </ul>
          <p className="mt-2">If you do not agree to these Terms, you must not use the Platform. We may update these Terms from time to time; continued use after any update constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">3. Eligibility</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 18 years of age to create an account and book rides independently.</li>
            <li>Minors under 18 may travel only when accompanied by an adult who has made the booking.</li>
            <li>You must provide a valid Indian mobile number for OTP verification.</li>
            <li>You must not create more than one account per mobile number.</li>
            <li>You confirm that all information you provide is accurate, current, and complete.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">4. Booking and Ride Requests</h2>
          <p>When you submit a ride request on Green Rides:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Your request is transmitted to eligible independent drivers registered on the Platform.</li>
            <li>A ride is confirmed only when a driver explicitly accepts your request.</li>
            <li>Green Rides does not guarantee availability of a driver for every request.</li>
            <li>Upon confirmation, you will receive the driver&apos;s name, contact number, estimated arrival time, and a one-time Trip OTP to verify the driver at pickup.</li>
            <li>The fare shown during booking is the confirmed fare for the trip. Drivers may not demand additional amounts beyond the confirmed fare except for tolls, state border taxes, or parking charges, which are to be paid by the passenger as applicable.</li>
            <li>Booking a cab for outstation travel may be subject to permit conditions under the Motor Vehicles Act, 1988. Drivers are responsible for holding valid outstation permits.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">5. Fares and Payments</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fares are calculated based on distance, route, vehicle type, and demand. Fares are displayed transparently before confirmation.</li>
            <li>Green Rides does not impose surge pricing. Base fares are fixed by the Platform and may be revised with notice.</li>
            <li>Payments may be made in cash directly to the driver, or via online payment if enabled.</li>
            <li>If online payment is selected, payment is processed via Razorpay. Green Rides does not store card or UPI credentials.</li>
            <li>All prices are inclusive of applicable GST where required under the Goods and Services Tax Act, 2017.</li>
            <li>Receipts are available through the Platform&apos;s trip history section.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">6. Cancellation Policy</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You may cancel a confirmed booking through the Platform before the driver begins the trip.</li>
            <li>Cancellations made more than 30 minutes before the scheduled pickup time: no charge.</li>
            <li>Cancellations made within 30 minutes of scheduled pickup: a cancellation fee equal to 10% of the fare may apply to compensate the driver for their time and travel to the pickup point.</li>
            <li>If the driver does not arrive within 15 minutes of the agreed pickup time without notice, you may cancel without any charge.</li>
            <li>Green Rides reserves the right to cancel a booking if no driver is available, in which case any advance payment will be refunded in full within 5–7 business days.</li>
            <li>Repeat cancellations may result in temporary suspension of your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">7. User Conduct</h2>
          <p>As a passenger, you agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Be present at the agreed pickup point at the confirmed time.</li>
            <li>Treat drivers with respect and courtesy. Verbal abuse, threats, or physical harm towards drivers is strictly prohibited and may result in permanent account suspension and police complaint.</li>
            <li>Not request drivers to violate traffic laws, exceed passenger capacity, or take unauthorised routes.</li>
            <li>Not carry prohibited items including illegal substances, unlicensed firearms, or hazardous materials.</li>
            <li>Wear a seatbelt at all times during travel, as required under the Motor Vehicles Act.</li>
            <li>Not smoke, consume alcohol, or cause damage inside the vehicle. You are liable for any damage caused to the vehicle.</li>
            <li>Not use the Platform to make fraudulent, false, or frivolous bookings.</li>
            <li>Not attempt to solicit contact information from drivers to book rides outside the Platform, bypassing driver safety protections.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">8. Safety</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All drivers on Green Rides have undergone identity and document verification including driving licence, vehicle registration certificate, and vehicle insurance.</li>
            <li>In case of an emergency during a trip, please contact the Police Emergency Number (112) immediately.</li>
            <li>Green Rides provides a trip OTP at pickup as an identity verification measure. Please verify the OTP with the driver before boarding.</li>
            <li>Green Rides may record trip metadata (route, time, fare) for safety and dispute resolution purposes.</li>
            <li>Passengers are covered by the driver&apos;s commercial vehicle insurance during travel. This coverage is provided by the driver&apos;s insurer, not Green Rides.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">9. Limitation of Liability</h2>
          <p>Green Rides is a technology intermediary under Section 79 of the IT Act, 2000. To the maximum extent permitted by applicable law:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Green Rides is not liable for any loss, injury, damage, or death arising from the actions, negligence, or misconduct of drivers, passengers, or third parties during a trip.</li>
            <li>Green Rides is not liable for delays, route changes, or trip disruptions caused by traffic, weather, road conditions, or force majeure events including natural disasters, government orders, or civil unrest.</li>
            <li>Green Rides is not liable for any indirect, incidental, special, or consequential damages arising out of use of the Platform.</li>
            <li>Our total liability to you for any direct loss arising from Platform use shall not exceed the fare paid for the specific trip in question.</li>
          </ul>
          <p className="mt-2">Nothing in these Terms limits liability for death or personal injury caused by our own gross negligence or fraud.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">10. Intellectual Property</h2>
          <p>All content on the Green Rides Platform, including its name, logo, design, software, and text, is the property of Green Rides and is protected under applicable intellectual property laws. You may not copy, reproduce, distribute, or create derivative works without written permission.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">11. Account Suspension and Termination</h2>
          <p>Green Rides may suspend or terminate your account, with or without notice, if you:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Violate any provision of these Terms.</li>
            <li>Engage in fraudulent, abusive, or illegal activity.</li>
            <li>Repeatedly cancel confirmed bookings without valid reason.</li>
            <li>Harass, threaten, or harm drivers or other Platform users.</li>
          </ul>
          <p className="mt-2">You may terminate your account at any time by contacting us. On termination, your right to use the Platform ceases immediately.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">12. Grievance Redressal</h2>
          <p>In accordance with the Consumer Protection Act, 2019 and IT Rules, 2021, if you have any complaint or grievance regarding the Platform or a trip, please contact our Grievance Officer:</p>
          <div className="bg-pale border border-border rounded-xl p-3 mt-2 space-y-1">
            <p><strong>Grievance Officer:</strong> Green Rides Support</p>
            <p><strong>Email:</strong> support@greenrides.co.in</p>
            <p><strong>Address:</strong> Green Rides, Koraput, Odisha – 764020, India</p>
            <p><strong>Response time:</strong> We will acknowledge your complaint within 24 hours and resolve it within 30 days as required by law.</p>
          </div>
          <p className="mt-2">If your grievance is not resolved to your satisfaction, you may approach the Consumer Disputes Redressal Commission in your jurisdiction or the National Consumer Helpline (1915).</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">13. Governing Law and Dispute Resolution</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>These Terms are governed by and construed in accordance with the laws of India.</li>
            <li>Any dispute arising from these Terms shall first be attempted to be resolved by mutual negotiation within 30 days.</li>
            <li>If unresolved, disputes shall be subject to binding arbitration under the Arbitration and Conciliation Act, 1996, with the seat of arbitration in Koraput, Odisha.</li>
            <li>For disputes below ₹20,000, you may approach the consumer forum of your district.</li>
            <li>Courts in Koraput, Odisha shall have jurisdiction over any legal proceedings.</li>
          </ul>
        </section>

        <div className="pt-4 border-t border-border space-y-2">
          <Link href="/privacy" className="block text-leaf text-sm font-semibold">Privacy Policy →</Link>
          <Link href="/driver-agreement" className="block text-leaf text-sm font-semibold">Driver Agreement →</Link>
          <Link href="/fleet-agreement" className="block text-leaf text-sm font-semibold">Fleet Owner Agreement →</Link>
        </div>
      </div>
    </div>
  );
}
