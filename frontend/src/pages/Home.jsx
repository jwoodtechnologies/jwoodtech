import { useRef, useState, useEffect } from "react";
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
  { label: "Websites", letter: "W" },
  { label: "AI Chatbots", letter: "A" },
  { label: "Automation", letter: "Au" },
  { label: "Campaign Tech", letter: "C" },
  { label: "Business Systems", letter: "B" },
  { label: "Custom Apps", letter: "Ca" },
];

const NAV_LINKS = [
  { label: "EON", href: "/eon" },
  { label: "WoodX", href: "/woodchat" },
  { label: "NXT1", href: "https://nxtone.tech", external: true },
];

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4";

function HeroVideo() {
  const videoRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    function fadeIn() {
      if (cancelled) return;
      const start = performance.now();
      const duration = 500;
      function tick(now) {
        if (cancelled) return;
        const t = Math.min((now - start) / duration, 1);
        video.style.opacity = t;
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function fadeOut(onDone) {
      if (cancelled) return;
      const start = performance.now();
      const duration = 500;
      function tick(now) {
        if (cancelled) return;
        const t = Math.min((now - start) / duration, 1);
        video.style.opacity = 1 - t;
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onDone();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function handleTimeUpdate() {
      if (!video.duration) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.5 && video.style.opacity > 0) {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        fadeOut(() => {});
      }
    }

    function handleEnded() {
      video.style.opacity = 0;
      setTimeout(() => {
        if (cancelled) return;
        video.currentTime = 0;
        video.play().catch(() => {});
        video.addEventListener("timeupdate", handleTimeUpdate);
        fadeIn();
      }, 100);
    }

    video.style.opacity = 0;
    video.play().catch(() => {});
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    fadeIn();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        className="bg-video absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        loop={false}
        style={{ opacity: 0 }}
      />
    </div>
  );
}

function MarqueeTrack() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden">
      <div className="hero-marquee-track flex gap-16 items-center">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0">
            <div className="liquid-glass w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold text-white/80">
              {item.letter[0]}
            </div>
            <span className="text-base font-semibold text-white/90 whitespace-nowrap">
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
    if (t.count >= 3) {
      t.count = 0;
      navigate("/vineyard");
    }
  };

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (
      !form.name ||
      !form.email ||
      !form.project_type ||
      !form.description ||
      !form.budget ||
      !form.timeline
    ) {
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

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section
        className="hero-section relative min-h-screen flex flex-col"
        data-testid="hero"
        style={{ background: "hsl(260 87% 3%)" }}
      >
        {/* Full-screen video backdrop */}
        <HeroVideo />

        {/* Blurred overlay shape behind content */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[984px] h-[527px] opacity-90 bg-gray-950 pointer-events-none"
          style={{ filter: "blur(82px)", zIndex: 1 }}
        />

        {/* Navbar */}
        <nav
          className="relative w-full py-5 px-8 flex flex-row items-center justify-between"
          style={{ zIndex: 10 }}
          data-testid="home-header"
        >
          {/* Logo */}
          <div>
            <JwoodLogo onClick={handleLogoTap} />
          </div>

          {/* Center nav links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer noopener" : undefined}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right CTA */}
          <a
            href="#inquiry"
            className="rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
            data-testid="hero-cta-nav"
          >
            Get Started
          </a>
        </nav>

        {/* Divider */}
        <div
          className="relative w-full h-px mt-[3px]"
          style={{
            zIndex: 10,
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)",
          }}
        />

        {/* Hero content */}
        <div
          className="relative flex-1 flex items-center justify-center px-6"
          style={{ zIndex: 10 }}
        >
          <div className="text-center max-w-5xl mx-auto">
            <h1
              className="font-normal leading-[1.02] tracking-[-0.024em]"
              style={{
                fontFamily: '"General Sans", system-ui, sans-serif',
                fontSize: "clamp(3rem, 12vw, 180px)",
              }}
              data-testid="hero-headline"
            >
              Build{" "}
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(to left, #6366f1, #a855f7, #fcd34d)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                Smarter
              </span>
            </h1>

            <p
              className="text-lg leading-8 max-w-md mx-auto mt-[9px]"
              style={{
                color: "hsl(40 6% 82%)",
                opacity: 0.8,
              }}
              data-testid="hero-sub"
            >
              AI-powered websites, automations, and digital systems built for
              businesses, campaigns, and creators.
            </p>

            <a
              href="#inquiry"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md text-white/90 font-medium hover:bg-white/10 transition-colors mt-[25px]"
              style={{ padding: "24px 29px" }}
              data-testid="hero-cta-share"
            >
              Schedule a Consult
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Logo / Service Marquee */}
        <div className="relative pb-10" style={{ zIndex: 10 }}>
          <div className="max-w-5xl mx-auto px-8 flex flex-col sm:flex-row items-start sm:items-center gap-12">
            {/* Static label */}
            <div className="text-sm text-white/50 leading-snug shrink-0">
              Trusted technology for
              <br />
              modern organizations
            </div>

            {/* Scrolling marquee */}
            <div className="flex-1 overflow-hidden">
              <MarqueeTrack />
            </div>
          </div>
        </div>
      </section>

      {/* ── BELOW-FOLD CONTENT ───────────────────────────────────── */}

      {/* Capability strip */}
      <Reveal
        as="section"
        className="relative z-10 px-6 md:px-12 pb-20 pt-20 max-w-6xl mx-auto"
        data-testid="capabilities"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
          {[
            { k: "01", t: "AI Systems" },
            { k: "02", t: "Software" },
            { k: "03", t: "Data" },
            { k: "04", t: "Strategy" },
          ].map((it, i) => (
            <div
              key={it.k}
              className="bg-black/30 p-6 md:p-8"
              data-testid={`capability-${i}`}
            >
              <div className="font-mono text-[11px] tracking-[0.3em] text-white/45">
                {it.k}
              </div>
              <div className="mt-3 text-white text-lg font-medium">{it.t}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Inquiry form */}
      <section
        id="inquiry"
        className="relative z-10 px-6 md:px-12 pb-32 max-w-6xl mx-auto"
        data-testid="inquiry-section"
      >
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start">
          <Reveal>
            <p className="font-mono text-[11px] tracking-[0.3em] text-white/55 uppercase">
              · 005 / Inquire
            </p>
            <h2 className="mt-4 text-3xl md:text-5xl font-light tracking-tight text-white">
              Start a project.
            </h2>
            <div className="mt-10 space-y-3 text-sm text-white/70">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-white/80" />
                <a
                  href="mailto:info@jwoodtechnologies.com"
                  className="text-white/95 hover:text-white underline-offset-4 hover:underline"
                  data-testid="contact-email-link"
                >
                  info@jwoodtechnologies.com
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal
            delay={120}
            className="rounded-3xl p-6 md:p-10 border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
            data-testid="inquiry-card"
          >
            {done ? (
              <div
                className="flex flex-col items-start gap-4 py-12"
                data-testid="inquiry-success"
              >
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <h3 className="text-2xl font-light text-white">
                  Inquiry received.
                </h3>
                <Button
                  variant="outline"
                  className="mt-2 border-white/15 bg-transparent text-white hover:bg-white/5"
                  onClick={() => setDone(false)}
                  data-testid="inquiry-send-another"
                >
                  Send another
                </Button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="space-y-5"
                data-testid="inquiry-form"
                noValidate
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Name" htmlFor="f-name" required>
                    <Input
                      id="f-name"
                      data-testid="form-name"
                      className="input-premium h-11 rounded-lg"
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Your name"
                      required
                    />
                  </Field>
                  <Field label="Email" htmlFor="f-email" required>
                    <Input
                      id="f-email"
                      type="email"
                      data-testid="form-email"
                      className="input-premium h-11 rounded-lg"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@company.com"
                      required
                    />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Phone" htmlFor="f-phone">
                    <Input
                      id="f-phone"
                      data-testid="form-phone"
                      className="input-premium h-11 rounded-lg"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Project type" required>
                    <Select
                      value={form.project_type}
                      onValueChange={set("project_type")}
                    >
                      <SelectTrigger
                        className="input-premium h-11 rounded-lg"
                        data-testid="form-project-type"
                      >
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0c14] border-white/10 text-white">
                        {PROJECT_TYPES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Budget range" required>
                    <Select value={form.budget} onValueChange={set("budget")}>
                      <SelectTrigger
                        className="input-premium h-11 rounded-lg"
                        data-testid="form-budget"
                      >
                        <SelectValue placeholder="Estimate" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0c14] border-white/10 text-white">
                        {BUDGETS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Timeline" required>
                    <Select
                      value={form.timeline}
                      onValueChange={set("timeline")}
                    >
                      <SelectTrigger
                        className="input-premium h-11 rounded-lg"
                        data-testid="form-timeline"
                      >
                        <SelectValue placeholder="When" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0c14] border-white/10 text-white">
                        {TIMELINES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Project description" required>
                  <Textarea
                    data-testid="form-description"
                    className="input-premium min-h-[140px] rounded-lg"
                    value={form.description}
                    onChange={set("description")}
                    placeholder="What are you building?"
                    required
                  />
                </Field>

                <div className="pt-2 flex items-center justify-end gap-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="rounded-full bg-white px-6 h-11 text-black hover:bg-white/90 disabled:opacity-60"
                    data-testid="form-submit"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        Send inquiry
                        <ArrowUpRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 px-6 md:px-12 pb-10 max-w-6xl mx-auto"
        data-testid="home-footer"
      >
        <div className="hairline pt-8 space-y-5">
          <div className="products-band">
            <div className="products-band-label">Products of Jwood Technologies</div>
            <div className="products-band-grid">
              <a href="/eon" className="products-band-card" data-testid="home-eon-link">
                <div className="products-band-name">EON</div>
                <div className="products-band-desc">Personal AI agent system</div>
                <span className="products-band-arrow">↗</span>
              </a>
              <a href="/woodchat" className="products-band-card" data-testid="home-woodchat-link">
                <div className="products-band-name">WoodX</div>
                <div className="products-band-desc">Encrypted messaging platform</div>
                <span className="products-band-arrow">↗</span>
              </a>
              <a
                href="https://nxtone.tech"
                target="_blank"
                rel="noreferrer noopener"
                className="products-band-card"
                data-testid="home-nxt1-link"
              >
                <div className="products-band-name">NXT1</div>
                <div className="products-band-desc">No-code platform to build apps, websites, and MVPs.</div>
                <span className="products-band-arrow">↗</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] font-mono tracking-[0.18em] text-white/40 uppercase mt-8">
            <div>© {new Date().getFullYear()} Jwood Technologies</div>
            <div className="flex items-center gap-4">
              <a
                href="/privacy"
                className="hover:text-white transition-colors"
                data-testid="home-privacy"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="hover:text-white transition-colors"
                data-testid="home-terms"
              >
                Terms
              </a>
              <a
                href="https://www.instagram.com/jwoodtechnologies"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Instagram"
                className="group inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors"
                data-testid="home-instagram"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-3.5 w-3.5 text-white/70 group-hover:text-white transition-colors"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/jwoodnxt/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="LinkedIn"
                className="group inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors"
                data-testid="home-linkedin"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-[13px] w-[13px] text-white/70 group-hover:text-white transition-colors"
                >
                  <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8h4.56v14H.22V8zm7.42 0h4.37v1.92h.06c.61-1.15 2.1-2.36 4.32-2.36 4.63 0 5.48 3.05 5.48 7.02V22h-4.56v-6.1c0-1.46-.03-3.34-2.04-3.34-2.04 0-2.36 1.59-2.36 3.23V22H7.64V8z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating EON chatbot — must remain active, visible, and functional */}
      <HomeEon />
    </div>
  );
};

const Field = ({ label, required, htmlFor, children }) => (
  <div className="space-y-2">
    <Label
      htmlFor={htmlFor}
      className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/65"
    >
      {label}
      {required && <span className="ml-1 text-white/40">*</span>}
    </Label>
    {children}
  </div>
);

export default Home;
