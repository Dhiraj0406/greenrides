import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Fleet Owner Agreement — Green Rides",
  description: "Terms and conditions for fleet owners and vehicle operators registered on the Green Rides platform.",
};

export default function FleetAgreementPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href="/fleet" className="text-lime/70 hover:text-lime flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white">Fleet Owner Agreement</h1>
            <p className="text-lime/60 text-xs mt-0.5">For vehicle owners and fleet operators</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-7 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: June 2026 · Effective upon fleet owner registration and approval</p>

        <div className="bg-gold/10 border border-gold/30 rounded-xl p-3">
          <p className="text-xs text-gold font-semibold">Important Notice</p>
          <p className="text-xs mt-1">By registering as a Fleet Owner on Green Rides, you confirm that you have read, understood, and agree to this Fleet Owner Agreement in addition to our Terms of Service and Privacy Policy. This Agreement constitutes a legally binding contract under the Indian Contract Act, 1872.</p>
        </div>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">1. Definitions</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>&ldquo;Fleet Owner&rdquo; / &ldquo;Owner&rdquo;</strong>: A person or business entity that owns or controls one or more commercial vehicles and registers them on the Green Rides Platform.</li>
            <li><strong>&ldquo;Fleet Driver&rdquo;</strong>: A driver employed by or contracted to the Fleet Owner to operate fleet vehicles on Green Rides trips.</li>
            <li><strong>&ldquo;Fleet Vehicle&rdquo;</strong>: A vehicle registered under the Fleet Owner&apos;s account on the Platform.</li>
            <li><strong>&ldquo;Platform&rdquo;</strong>: The Green Rides technology platform connecting passengers with fleet vehicles and drivers.</li>
            <li><strong>&ldquo;Commission&rdquo;</strong>: The platform service fee deducted from trip earnings.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">2. Nature of the Relationship</h2>
          <p>You are an independent business operator and not an employee, partner, or agent of Green Rides. This Agreement does not create an employment relationship between you, your drivers, and Green Rides.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>You are the principal employer of your Fleet Drivers and bear all obligations as an employer or principal contractor under applicable Indian labour laws, including the Contract Labour (Regulation and Abolition) Act, 1970, and the Employees&apos; Provident Funds and Miscellaneous Provisions Act, 1952, where applicable.</li>
            <li>Green Rides is not a party to the employment relationship between you and your Fleet Drivers.</li>
            <li>You operate as an independent transport business using the Green Rides Platform as a marketplace to source passengers.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">3. Eligibility and Registration</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 18 years of age or, if a company/LLP/partnership, duly incorporated or registered under applicable Indian law.</li>
            <li>You must provide accurate business details, a valid PAN, and a registered mobile number.</li>
            <li>You must provide proof of ownership or legal control of each vehicle registered under your account.</li>
            <li>Your account becomes active only after Green Rides reviews and approves your registration, which may take up to 7 working days.</li>
            <li>Green Rides reserves the right to decline registration applications without providing reasons.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">4. Vehicle Registration and Compliance</h2>
          <p>Every vehicle you register on the Platform must comply with the following requirements at all times. You are responsible for ensuring compliance. Green Rides may audit compliance at any time:</p>
          <div className="space-y-2 mt-2">
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Commercial Registration</p>
              <p className="text-sub text-xs">Valid commercial vehicle RC issued by the competent RTO. The use of non-commercial (white plate) vehicles for fare-earning trips is illegal under the Motor Vehicles Act, 1988.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Insurance</p>
              <p className="text-sub text-xs">Comprehensive commercial vehicle insurance with third-party and passenger liability cover. You must ensure uninterrupted insurance coverage. Lapses in insurance must be reported to Green Rides immediately and the vehicle deactivated.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Fitness Certificate</p>
              <p className="text-sub text-xs">Valid Certificate of Fitness issued by the RTO, renewed as required.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Permit</p>
              <p className="text-sub text-xs">Valid All-India Tourist Permit or appropriate state permit for intercity routes. Permits must cover all routes operated. Operating without a valid permit is a criminal offence under the Motor Vehicles Act.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">PUC Certificate</p>
              <p className="text-sub text-xs">Valid Pollution Under Control certificate as required under the Central Motor Vehicles Rules.</p>
            </div>
            <div className="border-l-2 border-forest pl-3">
              <p className="font-semibold text-sm">Vehicle Condition</p>
              <p className="text-sub text-xs">Vehicles must be maintained in roadworthy, clean condition. Tyres, brakes, lights, and wipers must be in full working order. Seat belts must be functional for all seats.</p>
            </div>
          </div>
          <p className="mt-3">You must immediately deactivate any vehicle from the Platform that becomes non-compliant (expired insurance, permit, CF, etc.). Operating non-compliant vehicles may result in immediate suspension of your account and legal liability.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">5. Fleet Driver Management</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are responsible for ensuring that all drivers operating your vehicles meet the driver eligibility requirements set out in the Green Rides Driver Agreement and hold valid licences, police clearances, and are otherwise fit to drive.</li>
            <li>You must register each Fleet Driver on the Platform before they operate your vehicles for Green Rides trips.</li>
            <li>You are responsible for the conduct of your Fleet Drivers while operating your vehicles. Passenger complaints about Fleet Drivers will be escalated to you.</li>
            <li>You must ensure your Fleet Drivers have received adequate training in safe driving practices and passenger service standards.</li>
            <li>You must not permit any person who does not hold a valid commercial driving licence or has been suspended from the Platform to operate a Fleet Vehicle.</li>
            <li>If a Fleet Driver is suspended from the Platform, you must ensure they do not use your vehicles for Green Rides trips during the suspension.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">6. Revenue, Commission, and Payouts</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>The platform commission payable by fleet owners on trips completed through the Platform will be communicated at registration and may be revised with 14 days&apos; written notice.</li>
            <li>For online-paid trips, Green Rides will remit earnings (net of commission) to your registered bank account within 7 working days of trip completion.</li>
            <li>For cash-paid trips, the driver collects the full fare. You are responsible for collecting the Platform commission from your driver and remitting it to Green Rides as per the agreed payment schedule.</li>
            <li>Green Rides will provide a monthly earnings statement for reconciliation purposes.</li>
            <li>You are responsible for all tax obligations on your earnings, including GST registration and filing (if applicable) and income tax. Green Rides will deduct TDS as required under the Income Tax Act, 1961, and issue Form 16A.</li>
            <li>Disputed payouts must be raised within 30 days of the relevant earnings statement. Disputes raised thereafter may not be entertained.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">7. Insurance and Liability</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You bear sole and exclusive responsibility for insuring your vehicles and ensuring passenger liability coverage is in place at all times.</li>
            <li>In the event of an accident involving your Fleet Vehicle, you and your insurer are solely responsible for all claims, compensation, and liabilities arising, including third-party motor accident claims under the Motor Vehicles Act.</li>
            <li>Green Rides is not a party to any insurance claim and provides no indemnity for accidents, injuries, or property damage arising from Fleet Vehicle operations.</li>
            <li>You shall indemnify and hold Green Rides harmless from any claims, losses, costs, or liabilities arising out of the operation of your Fleet Vehicles, conduct of your Fleet Drivers, or your breach of this Agreement.</li>
            <li>It is strongly recommended that you obtain a commercial fleet insurance policy covering all registered vehicles and a public liability insurance policy.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">8. Conduct and Service Standards</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You and your Fleet Drivers must comply with all requirements of the Green Rides Driver Agreement, which is incorporated by reference into this Agreement.</li>
            <li>You must maintain a minimum Fleet Driver rating average above 3.5 stars to remain active. Fleets consistently below this threshold may be suspended.</li>
            <li>You must address passenger complaints escalated to you within 48 hours.</li>
            <li>You must not engage in predatory pricing, collusion with other fleet owners, or any conduct that harms the interests of passengers or the Platform.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">9. Intellectual Property and Branding</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Green Rides grants you a limited, non-exclusive, non-transferable licence to use the Green Rides name and logo solely in connection with your participation on the Platform and as authorised by Green Rides.</li>
            <li>You may not hold yourself out as a representative or subsidiary of Green Rides, or use Green Rides branding in a manner that suggests an employment or agency relationship.</li>
            <li>You may affix Green Rides decals or branding on your vehicles only if and to the extent authorised by Green Rides in writing.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">10. Suspension and Termination</h2>
          <p>Green Rides may suspend or terminate your Fleet Owner account with immediate effect for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Operating vehicles with expired or lapsed insurance, permit, or registration.</li>
            <li>Permitting unlicensed or suspended drivers to operate Fleet Vehicles.</li>
            <li>Submitting false documents or information during registration or any subsequent verification.</li>
            <li>Repeated passenger complaints or sustained low ratings not remedied after notice.</li>
            <li>Failure to remit Platform commission on time.</li>
            <li>Any conduct that brings Green Rides into disrepute or violates applicable law.</li>
            <li>Criminal conviction of you or a Fleet Driver relating to operations on the Platform.</li>
          </ul>
          <p className="mt-2">On termination by either party, all outstanding trips must be completed. Outstanding earnings will be remitted within 30 days after final reconciliation. Obligations of confidentiality, indemnity, and liability survive termination.</p>
          <p className="mt-2">You may terminate this Agreement with 15 days&apos; written notice to Green Rides, provided there are no outstanding bookings or disputes.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">11. Confidentiality</h2>
          <p>You agree to keep confidential all non-public information provided by Green Rides, including Platform algorithms, pricing logic, driver ranking methodology, and business data. This obligation survives termination of this Agreement for a period of 2 years.</p>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">12. Compliance with Law</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You shall at all times comply with all applicable central and state laws, including the Motor Vehicles Act, 1988; Motor Vehicles (Amendment) Act, 2019; Odisha Motor Vehicles Rules; Central Motor Vehicles Rules, 1989; Income Tax Act, 1961; and GST laws.</li>
            <li>You shall obtain and maintain all licences, permits, and registrations required for your fleet operations.</li>
            <li>Green Rides may report violations of transport law to the relevant transport authority (Odisha STA) if discovered.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">13. Governing Law and Disputes</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>This Agreement is governed by the laws of India.</li>
            <li>Disputes shall first be attempted to be resolved through good-faith negotiation within 30 days of notice.</li>
            <li>If unresolved, disputes shall be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996, with the seat in Koraput, Odisha. The arbitrator shall be mutually agreed upon or appointed by the Koraput District Court.</li>
            <li>Courts in Koraput, Odisha shall have exclusive jurisdiction.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base text-forest mb-2">14. Contact</h2>
          <div className="bg-pale border border-border rounded-xl p-3 space-y-1">
            <p><strong>Fleet Support:</strong> support@greenrides.co.in</p>
            <p><strong>Address:</strong> Green Rides, Koraput, Odisha – 764020</p>
          </div>
        </section>

        <div className="pt-4 border-t border-border space-y-2">
          <Link href="/terms" className="block text-leaf text-sm font-semibold">Terms of Service →</Link>
          <Link href="/privacy" className="block text-leaf text-sm font-semibold">Privacy Policy →</Link>
          <Link href="/driver-agreement" className="block text-leaf text-sm font-semibold">Driver Agreement →</Link>
        </div>
      </div>
    </div>
  );
}
