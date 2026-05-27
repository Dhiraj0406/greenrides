import { Clock, Phone } from "lucide-react";

export default function FleetPendingPage() {
  return (
    <div className="green-container min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-gold" />
      </div>
      <h1 className="font-display text-2xl text-forest mb-3">Application Under Review</h1>
      <p className="text-sm text-sub max-w-xs mb-6">
        Your application has been submitted. Our team reviews applications within 24–48 hours.
        You will receive a notification once approved.
      </p>
      <a href="tel:+919999999999"
        className="flex items-center gap-2 text-sm text-leaf font-semibold">
        <Phone className="w-4 h-4" />
        Contact Support
      </a>
    </div>
  );
}
