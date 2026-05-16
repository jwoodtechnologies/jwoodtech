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
import VideoBackground from "@/components/VideoBackground";
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

const Home = () => {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  // Hidden 3-tap on logo → /vineyard
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
    <div className="relative min-h-screen overflow-x-hidden text-white" data-testid="home-page">
      <VideoBackground />

      {/* Top bar — logo only, no nav links */}
      <header
        className="relative z-10 px-6 md:px-12 pt-8 md:pt-10 flex items-center justify-between"
        data-testid="home-header"
      >
        <div className="fade-up">
          <JwoodLogo onClick={handleLogoTap} />
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative z-10 px-6 md:px-12 pt-24 md:pt-40 pb-20 max-w-6xl mx-auto"
        data-testid="hero"
      >
        <h1
          className="fade-up delay-2 mt-2 font-light tracking-tighter leading-[0.95] text-white text-5xl sm:text-6xl md:text-7xl lg:text-[88px]"
          data-testid="hero-headline"
        >
          Intelligence,
          <br />
          <span className="italic font-extralight text-white/85">redefined.</span>
        </h1>
        <p
          className="fade-up delay-3 mt-8 max-w-xl text-white/70 text-base md:text-lg leading-relaxed"
          data-testid="hero-sub"
        >
          A technology firm building AI-native products, bespoke software, apps,
          and websites.
        </p>

        <div
          className="fade-up delay-4 mt-10 flex flex-wrap items-center gap-4"
          data-testid="hero-actions"
        >
          <a
            href="#inquiry"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-white/90"
            data-testid="hero-cta-share"
          >
            Share a project
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
          <a
            href="mailto:info@jwoodtechnologies.com"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-md px-6 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            data-testid="hero-cta-email"
          >
            <Mail className="h-4 w-4" />
            info@jwoodtechnologies.com
          </a>
        </div>
      </section>

      {/* Capability strip */}
      <Reveal
        as="section"
        className="relative z-10 px-6 md:px-12 pb-20 max-w-6xl mx-auto"
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
                <h3 className="text-2xl font-light text-white">Inquiry received.</h3>
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
                    <Select value={form.timeline} onValueChange={set("timeline")}>
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
          {/* Products of Jwood Technologies */}
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

          {/* Legal row + socials */}
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

      {/* Floating EON chatbot */}
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
