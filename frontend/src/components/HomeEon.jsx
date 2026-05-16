import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

// ---------------------------------------------------------------------------
// Animated starfield (canvas) — premium drifting stars for the modal
// ---------------------------------------------------------------------------
const Starfield = () => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    let raf;
    let stars = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      const count = Math.min(Math.floor((c.width * c.height) / 4500), 600);
      stars = new Array(count).fill(0).map(() => {
        const z = Math.random() < 0.6 ? 0.3 : Math.random() < 0.9 ? 0.6 : 1.0;
        return {
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          z,
          vx: 0.015 * z * dpr,
          vy: -0.008 * z * dpr,
          tw: Math.random() * Math.PI * 2,
          tf: 0.5 + Math.random() * 1.4,
        };
      });
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.fillStyle = "rgb(2,2,6)";
      ctx.fillRect(0, 0, c.width, c.height);
      const t = Date.now() / 22000;
      const gx = c.width * (0.5 + Math.sin(t) * 0.2);
      const gy = c.height * (0.45 + Math.cos(t * 0.9) * 0.12);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(c.width, c.height) * 0.65);
      g.addColorStop(0, "rgba(80,120,220,0.14)");
      g.addColorStop(0.5, "rgba(30,40,90,0.04)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      const now = Date.now() / 1000;
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x += c.width;
        if (s.x > c.width) s.x -= c.width;
        if (s.y < 0) s.y += c.height;
        if (s.y > c.height) s.y -= c.height;
        const alpha = (0.28 + Math.sin(now * s.tf + s.tw) * 0.38) * s.z;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
        const r = s.z * 1.25 * dpr;
        if (s.z > 0.7) {
          ctx.fillStyle = "rgba(220,230,255,0.55)";
          ctx.beginPath();
          ctx.arc(s.x, s.y, r * 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#e8edff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="home-eon-canvas" aria-hidden="true" />;
};

// ---------------------------------------------------------------------------
// Orb visuals (reuse wc-orb classes from existing CSS)
// ---------------------------------------------------------------------------
const Orb = ({ size = 64 }) => (
  <div className="relative shrink-0 home-orb" style={{ width: size, height: size }} aria-hidden="true">
    <div className="wc-orb wc-orb-a absolute inset-0 rounded-full" />
    <div className="wc-orb wc-orb-b absolute inset-0 rounded-full" />
    <div className="wc-orb wc-orb-c absolute inset-0 rounded-full" />
    <div className="wc-orb-core absolute inset-[22%] rounded-full" />
    <div className="wc-orb-ring absolute inset-[8%] rounded-full" />
  </div>
);

// ---------------------------------------------------------------------------
// Conversational chatbot — step-by-step lead capture
// ---------------------------------------------------------------------------
const STEPS = [
  { id: "first_name", greet: "Hey, this is EON — how can I help you today?\nWhat's your first name?",
    accept: (v, ctx) => `Nice to meet you, ${v}. What's your last name?` },
  { id: "last_name", greet: "",
    accept: (v, ctx) => `Thanks, ${ctx.first_name} ${v}. What's the best email to reach you at?` },
  { id: "email", greet: "",
    accept: () => "Got it. So — anything we can build for you, or do you have a question about one of our products?",
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Hmm, that email doesn't look right — try again." },
  { id: "message", greet: "",
    accept: () => "Got it — Jwood Technologies will get back to you within 24–48 hours. Thanks for reaching out." },
];

const HomeEon = () => {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState([]);  // [{role:'eon'|'me', text}]
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [data, setData] = useState({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, busy]);

  const reset = useCallback(() => {
    setThread([]);
    setStep(0);
    setInput("");
    setData({});
    setDone(false);
    setBusy(false);
  }, []);

  // Open → seed greeting
  useEffect(() => {
    if (open && thread.length === 0) {
      setThread([{ role: "eon", text: STEPS[0].greet }]);
    }
  }, [open, thread.length]);

  const close = () => {
    setOpen(false);
    setTimeout(reset, 240);
  };

  const submitFinal = async (collected) => {
    setBusy(true);
    try {
      await apiClient.post("/eon-app/contact-lead", {
        first_name: collected.first_name,
        last_name: collected.last_name,
        email: collected.email,
        message: collected.message,
      });
      setDone(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Couldn't send right now. Try again in a moment.";
      toast.error(msg);
      setThread((t) => [...t, { role: "eon", text: "Hm, something went wrong sending that. Mind retrying?" }]);
    } finally {
      setBusy(false);
    }
  };

  const send = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy || done) return;
    const current = STEPS[step];
    if (current.validate) {
      const v = current.validate(text);
      if (v !== true) {
        setThread((t) => [...t, { role: "me", text }, { role: "eon", text: v }]);
        setInput("");
        return;
      }
    }
    const nextData = { ...data, [current.id]: text };
    setData(nextData);
    const reply = current.accept(text, nextData);
    setThread((t) => [...t, { role: "me", text }, { role: "eon", text: reply }]);
    setInput("");
    const nextStep = step + 1;
    if (nextStep >= STEPS.length) {
      submitFinal(nextData);
    } else {
      setStep(nextStep);
    }
  };

  return (
    <>
      {/* Floating launcher orb */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 home-eon-launcher"
        data-testid="home-eon-launcher"
        aria-label="Open EON"
      >
        <Orb size={56} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" data-testid="home-eon-dialog">
          <Starfield />
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={close}
            aria-label="Close"
            style={{ background: "transparent" }}
          />
          <div className="home-eon-shell" data-testid="home-eon-modal">
            <header className="home-eon-head">
              <div className="flex items-center gap-3">
                <Orb size={36} />
                <div className="leading-tight">
                  <div className="home-eon-title">EON</div>
                  <div className="home-eon-tag">Jwood Technologies</div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="home-eon-close"
                data-testid="home-eon-close"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>

            <div className="home-eon-thread" ref={scrollRef}>
              {thread.map((m, i) => (
                <div key={i} className={`home-eon-msg ${m.role === "me" ? "home-eon-msg-me" : "home-eon-msg-eon"}`}>
                  {m.text}
                </div>
              ))}
              {busy && (
                <div className="home-eon-msg home-eon-msg-eon home-eon-typing">
                  <span /><span /><span />
                </div>
              )}
            </div>

            <form onSubmit={send} className="home-eon-compose" data-testid="home-eon-form">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={done ? "Conversation complete." : "Type your reply…"}
                disabled={done || busy}
                data-testid="home-eon-input"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim() || done || busy}
                className="home-eon-send-btn"
                data-testid="home-eon-submit"
                aria-label="Send"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default HomeEon;
