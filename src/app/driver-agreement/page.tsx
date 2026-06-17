import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Driver Agreement — Green Rides",
  description: "Terms and conditions for drivers registered on the Green Rides platform.",
};

export default function DriverAgreementPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/drivers" className="text-lime/70 hover:text-lime flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white">Driver Agreement</h1>
            <p className="text-lime/60 text-xs mt-0.5">For drivers registered on Green Rides</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-7 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: June 2026 · Effective upon driver registration and approval</p>

        <div className="bg-gold/10 border border-gold/30 rounded-xl p-3">
          <p className="text-xs text-gold font-semibold">Important Notice</p>
          <p className="text-xs mt-1">By registering as a driver on Green Rides, you confirm that you have read, understood, and agree to this Driver Agreement. This Agreement constitutes a legally binding contract under the Indian Contract Act, 1872.</p>
        </div>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">1. Nature of the Relationship</h2>
          <p>You (&ldquo;Driver&rdquo;, &ldquo;Service Provider&rdquo;) are an independent contractor and not an employee, agent, partner, or joint venturer of Green Rides. This Agreement does not create an employer-employee relationship.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>You operate your vehicle as an independent business and are solely responsible for your vehicle, insurance, fuel, maintenance, and all costs of operation.</li>
            <li>Green Rides provides a technology platform that connects you with passengers seeking intercity rides. Green Rides does not direct or control how you provide transportation services.</li>
            <li>You are free to accept or reject any ride request without penalty, subject to the conduct standards in Clause 7.</li>
            <li>This arrangement is consistent with the aggregator model under Chapter V-A of the Motor Vehicles Act, 1988 (as amended 2019).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">2. Eligibility Requirements</h2>
          <p>To register and remain active as a driver on Green Rides, you must at all times:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Be at least 21 years of age.</li>
            <li>Hold a valid, non-expired commercial driving licence (Transport Endorsement) issued by a competent authority in India, valid for the class of vehicle you operate.</li>
            <li>Hold a valid Police Verification Certificate issued by the relevant police authority.</li>
            <li>Not have been convicted of any criminal offence involving moral turpitude, violence, fraud, or offences under the Protection of Children from Sexual Offences Act, 2012, POCSO Act, or similar statutes.</li>
            <li>Not be under the influence of alcohol or any controlled substance while operating a vehicle for a Green Rides trip.</li>
            <li>Be physically fit to drive and not have any medical condition that impairs your ability to operate a vehicle safely.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">3. Vehicle Requirements</h2>
          <p>All vehicles used for Green Rides trips must comply with the following at all times:</p>
          <div className="space-y-2 mt-2">
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Registration</p>
              <p className="text-sub text-xs">Valid commercial vehicle registration certificate (RC) issued by the Regional Transport Office (RTO). Private (non-commercial) vehicle registration is not permitted for fare-earning trips.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Insurance</p>
              <p className="text-sub text-xs">Valid third-party motor insurance is mandatory under the Motor Vehicles Act. Comprehensive commercial vehicle insurance with passenger liability cover is strongly recommended. You are solely responsible for ensuring adequate insurance coverage at all times.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Fitness Certificate</p>
              <p className="text-sub text-xs">Valid Certificate of Fitness (CF) issued by the RTO, where required for your vehicle class.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Pollution Control</p>
              <p className="text-sub text-xs">Valid Pollution Under Control (PUC) certificate as required under the Central Motor Vehicles Rules.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Permit</p>
              <p className="text-sub text-xs">Valid All-India Tourist Permit or Odisha State Permit as applicable for the routes you operate. You are responsible for holding the correct permit for every trip.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Vehicle Condition</p>
              <p className="text-sub text-xs">The vehicle must be maintained in a clean, roadworthy condition. Air conditioning, if advertised, must be functional. Seatbelts must be present and functional for all seats.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">4. KYC and Document Verification</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Before your first trip, you must upload the following documents through the Platform: valid driving licence, vehicle RC, vehicle insurance certificate, Aadhaar card, and a recent photograph.</li>
            <li>All documents will be reviewed by Green Rides administrators. You will be notified of approval or rejection with reasons.</li>
            <li>Submission of false, forged, or expired documents is a criminal offence under the Indian Penal Code (IPC) and constitutes grounds for immediate and permanent removal from the Platform, in addition to any legal action.</li>
            <li>You must update your documents on the Platform before expiry. Operating with expired documents may result in suspension.</li>
            <li>Green Rides may perform periodic re-verification of your documents.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">5. Fare and Earnings</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fares are set by Green Rides based on distance, vehicle type, and route. You agree to charge passengers only the fare displayed on the Platform for the confirmed trip.</li>
            <li>Green Rides charges a platform service fee (&ldquo;Commission&rdquo;) as a percentage of the fare. The current commission rate will be communicated to you upon registration and may be revised with 7 days&apos; notice.</li>
            <li>You may not charge passengers amounts beyond the confirmed fare. Any supplementary charges (tolls, parking, state border tax) must be disclosed to the passenger in advance and require their consent.</li>
            <li>Earnings for trips paid in cash are collected directly by you from the passenger. Earnings for online-paid trips will be remitted to your registered bank account within 7 working days after deduction of the Platform commission.</li>
            <li>You are responsible for maintaining accurate records of your earnings and for paying income tax and GST (if applicable) on your earnings as an independent contractor. Green Rides will provide Form 16A (TDS certificate) if TDS is deducted at source on platform payments.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">6. Trip Obligations</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Upon accepting a ride request, you commit to arriving at the pickup location within the communicated ETA and completing the trip as booked.</li>
            <li>You must verify the passenger&apos;s Trip OTP at the pickup location before commencing the journey.</li>
            <li>You must follow the agreed route unless a deviation is explicitly requested and agreed to by the passenger.</li>
            <li>You must not sub-contract or allow another person to drive on a trip you have accepted, without prior written approval from Green Rides.</li>
            <li>If you are unable to fulfil a confirmed trip, you must cancel through the Platform as early as possible and at minimum 30 minutes before the scheduled pickup time. Repeated last-minute cancellations of confirmed trips will result in suspension.</li>
            <li>You must mark trips as &ldquo;Started&rdquo; and &ldquo;Completed&rdquo; on the Platform accurately. Falsely marking trips affects passenger trust and your rating.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">7. Conduct Standards</h2>
          <p>You agree to maintain high standards of professional conduct:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Treat all passengers with courtesy and respect, regardless of gender, caste, religion, or disability.</li>
            <li>Do not use abusive, threatening, or discriminatory language towards passengers.</li>
            <li>Do not solicit passengers&apos; personal contact information for non-trip purposes.</li>
            <li>Do not make uninvited physical contact with passengers.</li>
            <li>Do not smoke or consume alcohol inside the vehicle while on duty.</li>
            <li>Maintain the vehicle in clean condition; air fresheners and clean interiors are expected.</li>
            <li>Do not use a mobile phone without a hands-free device while driving, as prohibited under the Central Motor Vehicles Rules.</li>
            <li>Observe all traffic laws, speed limits, and road safety regulations at all times.</li>
            <li>Do not deviate from the agreed route or stop at unscheduled locations without passenger consent.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">8. Safety and Emergencies</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>In case of a road accident, your first duty is to ensure passenger safety and call emergency services (Ambulance: 108, Police: 112).</li>
            <li>You must report any accident involving a Green Rides trip to Green Rides within 2 hours via the Platform or by calling our support line.</li>
            <li>You must ensure all passengers are wearing seatbelts before commencing travel, as required by law.</li>
            <li>Do not exceed the passenger capacity of your vehicle.</li>
            <li>If you feel unsafe or threatened by a passenger, you may terminate the trip immediately and report the incident to Green Rides and, if necessary, law enforcement.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">9. Insurance and Liability</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You bear sole responsibility for maintaining adequate vehicle insurance. Passengers travelling in your vehicle are covered by your commercial vehicle insurance, not by Green Rides.</li>
            <li>Green Rides is not responsible for accidents, injuries, or property damage arising from your operation of the vehicle.</li>
            <li>You shall indemnify and hold harmless Green Rides from any claims, losses, liabilities, or expenses arising from your negligence, violation of law, or breach of this Agreement.</li>
            <li>In the event of a claim against Green Rides arising from your conduct, Green Rides may seek indemnity from you.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">10. Ratings and Performance</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Passengers may rate you after each trip on a 1–5 star scale. Ratings are used to determine dispatch priority.</li>
            <li>Drivers with an average rating below 3.5 stars over the last 50 rated trips may be suspended pending review.</li>
            <li>You may view your ratings on the Platform. You may dispute a rating that you believe is fraudulent by contacting support.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">11. Suspension and Termination</h2>
          <p>Green Rides may suspend or permanently remove you from the Platform, with or without prior notice, for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Submitting false or forged documents.</li>
            <li>Operating with expired licence, insurance, or vehicle permit.</li>
            <li>Conduct involving physical, sexual, or verbal abuse of passengers.</li>
            <li>Driving under the influence of alcohol or controlled substances.</li>
            <li>Repeated or serious traffic violations.</li>
            <li>Soliciting passengers outside the Platform to avoid Platform commission.</li>
            <li>Overcharging passengers beyond the confirmed fare.</li>
            <li>Any criminal conviction or FIR relating to theft, assault, harassment, or fraud.</li>
            <li>Sustained low ratings or repeated passenger complaints.</li>
          </ul>
          <p className="mt-2">You may voluntarily deactivate your account at any time by contacting support. Pending trip obligations must be fulfilled before deactivation.</p>
          <p className="mt-2">On termination, any outstanding earnings due will be remitted within 30 days after reconciliation.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">12. Data and Privacy</h2>
          <p>Green Rides collects and processes your personal data (including KYC documents and trip records) as described in our Privacy Policy. By registering, you consent to this processing. Your phone number is shared with passengers only for the duration of their trip with you.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">13. Governing Law and Dispute Resolution</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>This Agreement is governed by the laws of India.</li>
            <li>Disputes shall first be attempted to be resolved through negotiation. If unresolved within 30 days, disputes will be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996, with the seat in Koraput, Odisha.</li>
            <li>Courts in Koraput, Odisha shall have jurisdiction over any legal proceedings.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">14. Contact and Grievance</h2>
          <div className="bg-pale border border-border rounded-xl p-3 space-y-1">
            <p><strong>Support:</strong> support@greenrides.co.in</p>
            <p><strong>Address:</strong> Green Rides, Koraput, Odisha – 764020</p>
          </div>
        </section>

        <div className="pt-4 border-t border-border space-y-2">
          <Link href="/terms" className="block text-leaf text-sm font-semibold">Terms of Service →</Link>
          <Link href="/privacy" className="block text-leaf text-sm font-semibold">Privacy Policy →</Link>
          <Link href="/fleet-agreement" className="block text-leaf text-sm font-semibold">Fleet Owner Agreement →</Link>
        </div>
      </div>
    </div>
  );
}
