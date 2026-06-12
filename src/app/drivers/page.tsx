import Link from "next/link";
import { Car, Clock, TrendingUp, Shield, Leaf, ChevronRight } from "lucide-react";

export default function DriversLandingPage() {
  return (
    <div className="green-container min-h-screen bg-cream">
      {/* Hero */}
      <div className="bg-forest px-6 pt-safe-top pb-12 text-center">
        <div className="pt-8 flex items-center justify-center gap-2 mb-6">
          <Leaf className="w-6 h-6 text-lime" />
          <span className="font-display text-2xl text-lime">Green Rides</span>
        </div>
        <h1 className="text-3xl font-display text-white mb-3 leading-tight">
          Drive with us.<br />Earn on your terms.
        </h1>
        <p className="text-lime/70 text-sm mb-8 max-w-xs mx-auto">
          Join Odisha&apos;s trusted cab network. Set your own schedule, choose your routes, get paid fairly.
        </p>
        <Link
          href="/login?next=/drivers"
          className="inline-flex items-center gap-2 bg-leaf text-white font-bold px-8 py-4 rounded-2xl text-base shadow-lg"
        >
          Become a Driver <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Benefits */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-display text-text mb-6 text-center">Why drive with Green?</h2>
        <div className="space-y-4">
          {[
            { icon: Clock, title: "Your schedule", desc: "Set availability day by day. Take rest days whenever you need." },
            { icon: TrendingUp, title: "Fair rides", desc: "Our algorithm ensures rides are distributed equally across all drivers." },
            { icon: Car, title: "Simple app", desc: "Accept ride requests in one tap. Get Telegram notifications instantly." },
            { icon: Shield, title: "Safe & trusted", desc: "Every driver is manually verified and approved by our team." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-border rounded-2xl p-4 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-pale flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-leaf" />
              </div>
              <div>
                <p className="font-semibold text-text text-sm">{title}</p>
                <p className="text-sub text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="px-6 pb-12">
        <h2 className="text-lg font-display text-text mb-6 text-center">How it works</h2>
        <div className="space-y-3">
          {[
            { n: "1", text: "Sign up with your phone number" },
            { n: "2", text: "Add your vehicle details and link Telegram" },
            { n: "3", text: "Wait for approval (usually within 24 hours)" },
            { n: "4", text: "Go online, set your schedule, start earning" },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-leaf text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                {n}
              </div>
              <p className="text-sm text-text">{text}</p>
            </div>
          ))}
        </div>
        <Link
          href="/login?next=/drivers"
          className="mt-8 w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold px-6 py-4 rounded-2xl text-base"
        >
          Get started <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
