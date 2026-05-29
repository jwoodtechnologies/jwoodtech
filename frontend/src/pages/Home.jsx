import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import JwoodLogo from "@/components/JwoodLogo";
import { Reveal } from "@/components/Reveal";
import HomeEon from "@/components/HomeEon";
import VideoBackground from "@/components/VideoBackground";
import { apiClient } from "@/lib/api";

const PROJECT_TYPES = [
  "AI / Machine Learning",
  "Custom Software",
  "Web Application",
  "Mobile Application",
  "Data / Analytics Platform",
  "Automation / Integrations",
  "Other",
];
const BUDGETS = [
  "< $10K",
  "$10K – $25K",
  "$25K – $50K",
  "$50K – $100K",
  "$100K – $250K",
  "$250K +",
];
const TIMELINES = [
  "ASAP / 1–2 weeks",
  "1 month",
  "2–3 months",
  "3–6 months",
  "Flexible",
];

const initial = {
  name: "",
  email: "",
  phone: "",
  project_type: "",
  description: "",
  budget: "",
  timeline: "",
};

const MARQUEE_ITEMS = [
  { label: "Websites",         letter: "W" },
  { label: "AI Chatbots",      letter: "A" },
  { label: "Automation",       letter: "U" },
  { label: "Campaign Tech",    letter: "C" },
  { label: "Business Systems", letter: "B" },
  { label: "Custom Apps",      letter: "X" },
];

const PRODUCTS = [
  {
    name: "EON",
    desc: "Personal AI agent system",
    detail: "Intelligent assistant that learns, executes tasks, and manages your digital work.",
    href: "/eon",
    external: false,
  },
  {
    name: "WoodX",
    desc: "Encrypted messaging platform",
    detail: "End-to-end encrypted group and direct messaging built for teams and communities.",
    href: "/woodchat",
    external: false,
  },
  {
    name: "NXT1",
    desc: "No-code platform",
    detail: "Build apps, websites, and MVPs without writing a single line of code.",
    href: "https://nxtone.tech",
    external: true,
  },
];

function MarqueeTrack() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden">
      <div className="hero-marquee-track flex items-center" style={{ gap: "4rem" }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0">
            <div className="liquid-glass w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold text-white/80">
              {item.letter}
            </div>
            <span className="text-sm font-semibold text-white/80 whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const Home = () => {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const tapsRef = useRef({ count: 0, last: 0 });
  const handleLogoTap = () => {
    const now = Date.now();
    const t = tapsRef.current;
    if (now - t.last > 800) t.count = 0;
    t.last = now;
    t.count += 1;
    if (t.count >= 3) { t.count = 0; navigate("/vineyard"); }
  };

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.project_type || !form.description || !form.budget || !form.timeline) {
      toast.error("Please complete the required fields.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/contact", form);
      setDone(true);
      setForm(initial);
      toast.success("Inquiry received.");
    } catch {
      toast.error("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-x-hidden text-white" data-testid="home-page">

      {/* Full-page video backdrop — fixed, sits behind entire site */}
      <VideoBackground />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col"
        style={{ zIndex: 1 }}
        data-testid="hero"
      >
        {/* Blurred shape — depth behind hero text only */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: "min(984px, 95vw)",
            height: "min(527px, 65vw)",
            background: "hsl(260 87% 3%)",
            opacity: 0.7,
            filter: "blur(80px)",
            zIndex: 0,
          }}
        />

        {/* Navbar — logo left, CTA right only */}
        <nav
          className="relative w-full flex items-center justify-between py-5 px-6 md:px-8"
          style={{ zIndex: 2 }}
          data-testid="home-header"
        >
          <JwoodLogo onClick={handleLogoTap} className="h-[22px] md:h-[26px] w-auto" />

          <a
            href="#inquiry"
            className="hero-glass-btn inline-flex items-center rounded-full text-white/90 text-sm font-medium transition-all"
            style={{ padding: "9px 18px" }}
            data-testid="hero-cta-nav"
          >
            Get Started
          </a>
        </nav>

        {/* Divider */}
        <div
          className="relative w-full h-px"
          style={{
            zIndex: 2,
            background: "linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)",
          }}
        />

        {/* Hero content */}
        <div
          className="relative flex-1 flex items-start md:items-center justify-center px-6 pt-10 pb-6 md:py-16"
          style={{ zIndex: 2 }}
        >
          <div className="text-center w-full max-w-4xl mx-auto">
            <h1
              className="font-normal leading-[1.05] tracking-[-0.024em]"
              style={{
                fontFamily: '"General Sans", system-ui, sans-serif',
                fontSize: "clamp(2.4rem, 9vw, 140px)",
              }}
              data-testid="hero-headline"
            >
              <em style={{ fontStyle: "italic", fontWeight: 300 }}>Intelligence,</em>
              <br />
              <span
                style={{
                  backgroundImage: "linear-gradient(to left, #6366f1, #a855f7, #fcd34d)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  display: "inline-block",
                }}
              >
                Redefined.
              </span>
            </h1>

            <p
              className="text-sm md:text-base leading-6 md:leading-7 max-w-xs md:max-w-md mx-auto mt-4 px-2 md:px-0"
              style={{ color: "hsl(40 6% 82%)", opacity: 0.65 }}
              data-testid="hero-sub"
            >
              AI-powered websites, automations, and digital systems built for
              businesses, campaigns, and creators.
            </p>

            <div className="flex flex-row flex-wrap items-center justify-center gap-2 md:gap-3 mt-7 md:mt-8">
              <a
                href="#inquiry"
                className="hero-glass-btn inline-flex items-center gap-2 rounded-full text-white/95 text-sm font-medium transition-all"
                style={{ padding: "12px 22px" }}
                data-testid="hero-cta-share"
              >
                Share a Project
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="mailto:info@jwoodtechnologies.com"
                className="hero-glass-btn hero-glass-btn--dim inline-flex items-center gap-2 rounded-full text-white/60 text-sm font-medium transition-all"
                style={{ padding: "12px 20px" }}
                data-testid="hero-cta-email"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">info@jwoodtechnologies.com</span>
                <span className="sm:hidden">Email us</span>
              </a>
            </div>
          </div>
        </div>

        {/* Service marquee */}
        <div className="relative pb-8 md:pb-10" style={{ zIndex: 2 }}>
          <div className="max-w-5xl mx-auto px-6 md:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
              <p className="text-xs text-white/35 leading-snug shrink-0 hidden sm:block">
                Trusted technology for
                <br />
                modern organizations
              </p>
              <div className="flex-1 w-full overflow-hidden">
                <MarqueeTrack />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ─────────────────────────────────────────────────── */}
      <Reveal
        as="section"
        className="relative px-6 md:px-12 py-20 md:py-28 max-w-6xl mx-auto"
        style={{ zIndex: 1 }}
        data-testid="products-section"
      >
        <h2
          className="text-2xl md:text-3xl font-light tracking-tight text-white mb-10 md:mb-14"
          style={{ fontFamily: '"General Sans", system-ui, sans-serif' }}
        >
          Our Products
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {PRODUCTS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target={p.external ? "_blank" : undefined}
              rel={p.external ? "noreferrer noopener" : undefined}
              className="group relative rounded-2xl p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 liquid-glass hover:bg-white/[0.04]"
              style={{
                background: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 8px 32px -8px rgba(0,0,0,0.5)",
              }}
              data-testid={`product-${p.name.toLowerCase()}`}
            >
              {/* Name + arrow */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-xl font-semibold text-white tracking-tight">
                  {p.name}
                </span>
                <ArrowUpRight className="h-4 w-4 text-white/30 group-hover:text-white/70 transition-colors shrink-0 mt-1" />
              </div>

              {/* Short desc */}
              <p className="text-sm text-white/55 font-medium">{p.desc}</p>

              {/* Detail */}
              <p className="text-sm text-white/35 leading-relaxed mt-auto">{p.detail}</p>
            </a>
          ))}
        </div>
      </Reveal>

      {/* ── INQUIRY FORM ─────────────────────────────────────────────── */}
      <section
        id="inquiry"
        className="relative px-6 md:px-12 pb-20 md:pb-28 max-w-6xl mx-auto"
        style={{ zIndex: 1 }}
        data-testid="inquiry-section"
      >
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 items-start">

          {/* Left copy */}
          <Reveal>
            <p className="font-mono text-[11px] tracking-[0.3em] text-white/40 uppercase">
              · Start a project
            </p>
            <h2 className="mt-4 text-3xl md:text-4xl font-light tracking-tight text-white leading-tight">
              Let's build something.
            </h2>
            <p className="mt-4 text-sm text-white/50 leading-relaxed max-w-xs">
              Share the details and we'll reach out within one business day.
            </p>
            <div className="mt-8 flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-white/50 shrink-0" />
              <a
                href="mailto:info@jwoodtechnologies.com"
                className="text-white/70 hover:text-white underline-offset-4 hover:underline transition-colors"
                data-testid="contact-email-link"
              >
                info@jwoodtechnologies.com
              </a>
            </div>
          </Reveal>

          {/* Right form */}
          <Reveal
            delay={120}
            className="rounded-2xl p-6 md:p-8 backdrop-blur-2xl liquid-glass"
            style={{
              background: "rgba(255,255,255,0.05)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), 0 20px 60px -20px rgba(0,0,0,0.6)",
            }}
            data-testid="inquiry-card"
          >
            {done ? (
              <div className="flex flex-col items-start gap-4 py-10" data-testid="inquiry-success">
                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                <h3 className="text-xl font-light text-white">Inquiry received.</h3>
                <p className="text-sm text-white/50">We'll be in touch shortly.</p>
                <Button
                  variant="outline"
                  className="mt-2 border-white/15 bg-transparent text-white/80 hover:bg-white/5 hover:text-white rounded-full"
                  onClick={() => setDone(false)}
                  data-testid="inquiry-send-another"
                >
                  Send another
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5" data-testid="inquiry-form" noValidate>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Name" htmlFor="f-name" required>
                    <Input id="f-name" data-testid="form-name" className="input-premium h-11 rounded-lg" value={form.name} onChange={set("name")} placeholder="Your name" required />
                  </Field>
                  <Field label="Email" htmlFor="f-email" required>
                    <Input id="f-email" type="email" data-testid="form-email" className="input-premium h-11 rounded-lg" value={form.email} onChange={set("email")} placeholder="you@company.com" required />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Phone" htmlFor="f-phone">
                    <Input id="f-phone" data-testid="form-phone" className="input-premium h-11 rounded-lg" value={form.phone} onChange={set("phone")} placeholder="Optional" />
                  </Field>
                  <Field label="Project type" required>
                    <Select value={form.project_type} onValueChange={set("project_type")}>
                      <SelectTrigger className="input-premium h-11 rounded-lg" data-testid="form-project-type">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0c14] border-white/10 text-white">
                        {PROJECT_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Budget range" required>
                    <Select value={form.budget} onValueChange={set("budget")}>
                      <SelectTrigger className="input-premium h-11 rounded-lg" data-testid="form-budget">
                        <SelectValue placeholder="Estimate" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0c14] border-white/10 text-white">
                        {BUDGETS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Timeline" required>
                    <Select value={form.timeline} onValueChange={set("timeline")}>
                      <SelectTrigger className="input-premium h-11 rounded-lg" data-testid="form-timeline">
                        <SelectValue placeholder="When" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0c14] border-white/10 text-white">
                        {TIMELINES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Project description" required>
                  <Textarea data-testid="form-description" className="input-premium min-h-[120px] rounded-lg" value={form.description} onChange={set("description")} placeholder="What are you building?" required />
                </Field>
                <div className="pt-1 flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="rounded-full bg-white px-6 h-11 text-black hover:bg-white/90 disabled:opacity-60 text-sm font-medium"
                    data-testid="form-submit"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending</>
                    ) : (
                      <>Send inquiry<ArrowUpRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer
        className="relative px-6 md:px-12 pb-10 max-w-6xl mx-auto"
        style={{ zIndex: 1 }}
        data-testid="home-footer"
      >
        <div
          className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[11px] font-mono tracking-[0.18em] text-white/30 uppercase">
            © {new Date().getFullYear()} Jwood Technologies
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono tracking-[0.18em] text-white/30 uppercase">
            <a href="/privacy" className="hover:text-white/60 transition-colors" data-testid="home-privacy">Privacy</a>
            <a href="/terms"   className="hover:text-white/60 transition-colors" data-testid="home-terms">Terms</a>
            <a
              href="https://www.instagram.com/jwoodtechnologies"
              target="_blank" rel="noreferrer noopener"
              aria-label="Instagram"
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-colors"
              data-testid="home-instagram"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3 w-3 text-white/50 group-hover:text-white transition-colors">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/jwoodnxt/"
              target="_blank" rel="noreferrer noopener"
              aria-label="LinkedIn"
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-colors"
              data-testid="home-linkedin"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[11px] w-[11px] text-white/50 group-hover:text-white transition-colors">
                <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8h4.56v14H.22V8zm7.42 0h4.37v1.92h.06c.61-1.15 2.1-2.36 4.32-2.36 4.63 0 5.48 3.05 5.48 7.02V22h-4.56v-6.1c0-1.46-.03-3.34-2.04-3.34-2.04 0-2.36 1.59-2.36 3.23V22H7.64V8z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {/* Floating EON chatbot — active, visible, functional */}
      <HomeEon />
    </div>
  );
};

const Field = ({ label, required, htmlFor, children }) => (
  <div className="space-y-2">
    <Label htmlFor={htmlFor} className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/45">
      {label}{required && <span className="ml-1 text-white/25">*</span>}
    </Label>
    {children}
  </div>
);

export default Home;
