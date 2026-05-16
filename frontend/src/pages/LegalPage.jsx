import { ChevronLeft } from "lucide-react";

const Section = ({ title, children }) => (
  <section className="mt-10">
    <h2 className="wc-display text-[26px] md:text-[30px] text-white leading-tight mb-4">
      {title}
    </h2>
    <div className="space-y-4 text-[14.5px] leading-relaxed text-white/70 wc-font">
      {children}
    </div>
  </section>
);

export const LegalPage = ({ title, effective, children }) => {
  return (
    <div className="min-h-screen text-white wc-bg wc-font">
      <header className="max-w-3xl mx-auto px-6 md:px-10 pt-10 pb-6">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[13px] wc-mono uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors group"
          data-testid="legal-back"
        >
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/15 group-hover:border-white/35 group-hover:bg-white/[0.04] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </span>
          Back to Jwood Technologies
        </a>
      </header>
      <main className="max-w-3xl mx-auto px-6 md:px-10 pb-24">
        <h1 className="wc-display text-[44px] md:text-[56px] leading-[1.05] text-white">
          {title}
        </h1>
        <div className="wc-mono text-[11px] uppercase tracking-[0.28em] text-white/40 mt-4">
          Effective · {effective}
        </div>
        <div className="mt-8">{children}</div>
      </main>
      <footer className="max-w-3xl mx-auto px-6 md:px-10 pb-12">
        <div className="hairline pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] font-mono tracking-[0.18em] text-white/40 uppercase">
          <div>© {new Date().getFullYear()} Jwood Technologies</div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export { Section };
export default LegalPage;
