import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Section {
  heading: string;
  content: React.ReactNode;
}

interface LegalPageProps {
  title:       string;
  subtitle?:   string;
  updated:     string;
  backHref?:   string;
  sections:    Section[];
  footer?:     React.ReactNode;
}

export function LegalPage({ title, subtitle, updated, backHref = "/", sections, footer }: LegalPageProps) {
  return (
    <div className="green-container min-h-screen bg-cream">
      <header className="bg-forest px-6 pt-safe-top pb-6">
        <div className="pt-4 flex items-center gap-3">
          <Link href={backHref} className="text-lime/70 hover:text-lime flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-lime/60 text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </header>

      <div className="px-6 py-8 space-y-7 text-sm text-text leading-relaxed">
        <p className="text-sub text-xs">Last updated: {updated} · Effective immediately upon use</p>

        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-semibold text-base text-forest mb-2">{i + 1}. {s.heading}</h2>
            {s.content}
          </section>
        ))}

        {footer && (
          <div className="pt-4 border-t border-border space-y-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
