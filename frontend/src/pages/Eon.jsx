import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Send,
  Mic,
  MicOff,
  Loader2,
  LogOut,
  ArrowRight,
  Sparkles,
  Trash2,
  Plus,
  Menu,
  X as XIcon,
  MessageSquare,
  LayoutDashboard,
  ListChecks,
  Bot,
  Wallet as WalletIcon,
  Newspaper,
  Activity,
  Play,
  Search,
  PenLine,
  BarChart3,
  ListTree,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import "./Eon.css";
import { BACKEND_URL } from "../lib/config";

// ---------------------------------------------------------------------------
const API = `${BACKEND_URL}/api/eon-app`;
const TOKEN_KEY = "eon_token";
const PENDING_PROMPT_KEY = "eon_pending_prompt";
const ACTIVE_VIEW_KEY = "eon_active_view";

const eonClient = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});
eonClient.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ---------------------------------------------------------------------------
// Animated background — drifting starfield + slow nebula glows. (unchanged)
// ---------------------------------------------------------------------------
const NebulaCanvas = () => {
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
      const isMobile = c.clientWidth < 700;
      const divisor = isMobile ? 5500 : 3800;
      const count = Math.min(
        Math.floor((c.width * c.height) / divisor),
        isMobile ? 380 : 900
      );
      stars = new Array(count).fill(0).map(() => {
        const layer = Math.random();
        const z =
          layer < 0.55 ? 0.2 : layer < 0.85 ? 0.4 : layer < 0.97 ? 0.7 : 1.0;
        return {
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          z,
          baseVx: 0.012 * z * dpr,
          baseVy: -0.006 * z * dpr,
          wx: Math.random() * Math.PI * 2,
          wy: Math.random() * Math.PI * 2,
          wf: 0.15 + Math.random() * 0.25,
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
      const t = Date.now() / 24000;
      const gx = c.width * (0.5 + Math.sin(t) * 0.18);
      const gy = c.height * (0.45 + Math.cos(t * 0.9) * 0.12);
      const g = ctx.createRadialGradient(
        gx, gy, 0, gx, gy, Math.max(c.width, c.height) * 0.6
      );
      g.addColorStop(0, "rgba(70,110,210,0.10)");
      g.addColorStop(0.5, "rgba(30,40,90,0.03)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      const now = Date.now() / 1000;
      for (const s of stars) {
        s.x += s.baseVx + Math.sin(now * s.wf + s.wx) * 0.02 * s.z * dpr;
        s.y += s.baseVy + Math.cos(now * s.wf + s.wy) * 0.02 * s.z * dpr;
        if (s.x < 0) s.x += c.width;
        if (s.x > c.width) s.x -= c.width;
        if (s.y < 0) s.y += c.height;
        if (s.y > c.height) s.y -= c.height;
        const alpha = (0.32 + Math.sin(now * s.tf + s.tw) * 0.36) * s.z;
        ctx.globalAlpha = Math.max(0.04, Math.min(1, alpha));
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
  return <canvas ref={ref} className="eon-canvas" aria-hidden="true" />;
};

const Galaxy = ({ phase }) => (
  <div className={`eon-galaxy eon-galaxy-${phase}`} aria-hidden="true">
    <div className="eon-galaxy-disc" />
    <div className="eon-galaxy-core" />
    <div className="eon-galaxy-haze" />
  </div>
);

const Planets = ({ phase }) => {
  if (phase === "chat" || phase === "warp" || phase === "app") return null;
  return (
    <div className="eon-planets" aria-hidden="true">
      <div className="eon-planet eon-planet-1" />
      <div className="eon-planet eon-planet-2" />
      <div className="eon-planet eon-planet-3" />
    </div>
  );
};

const EonMark = ({ size = 56, interactive = false }) => {
  const [scale, setScale] = useState(1);
  const idleRef = useRef(null);
  const stepDown = useCallback(() => {
    setScale((s) => {
      const next = Math.max(1, +(s - 0.08).toFixed(3));
      if (next > 1) idleRef.current = setTimeout(stepDown, 220);
      else idleRef.current = null;
      return next;
    });
  }, []);
  const handleActivate = useCallback(() => {
    if (!interactive) return;
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
    setScale((s) => Math.min(1.7, +(s + 0.12).toFixed(3)));
    idleRef.current = setTimeout(stepDown, 1500);
  }, [interactive, stepDown]);
  useEffect(() => () => idleRef.current && clearTimeout(idleRef.current), []);
  return (
    <div
      className={`eon-mark ${interactive ? "eon-mark-interactive" : ""}`}
      style={{ width: size, height: size, transform: `scale(${scale})` }}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleActivate();
        }
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "EON" : undefined}
      data-active={scale > 1 ? "true" : "false"}
      data-testid={interactive ? "eon-orb-interactive" : "eon-orb"}
    >
      <div className="eon-mark-orb" />
      <div className="eon-mark-ring" />
      <div className="eon-mark-core" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Splash — EON-only branding
// ---------------------------------------------------------------------------
const Splash = ({ onDone }) => {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    const t = setTimeout(() => {
      firedRef.current = true;
      onDone();
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="eon-splash" data-testid="eon-splash">
      <div className="eon-splash-stack">
        <EonMark size={92} />
        <div className="eon-splash-word">EON</div>
        <div className="eon-splash-tag">Personal AI agent system</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Auth gate (modal) — pops only when user takes a gated action
// ---------------------------------------------------------------------------
const GoogleSVG = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.4l-6.5-5.3C29.4 34.7 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2.1 3.9-3.9 5.2l6.5 5.3C40.9 36.1 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

const AuthGate = ({ pendingPrompt, onAuthed, onClose }) => {
  const [mode, setMode] = useState("signup"); // signup feels lower-friction here
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    access_code: "",
  });
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data } = await eonClient.post("/auth/signup", {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          password: form.password,
          access_code: form.access_code || undefined,
        });
        localStorage.setItem(TOKEN_KEY, data.token);
        onAuthed(data.user);
      } else {
        const { data } = await eonClient.post("/auth/login", {
          email: form.email.trim(),
          password: form.password,
        });
        localStorage.setItem(TOKEN_KEY, data.token);
        onAuthed(data.user);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Couldn't sign you in.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="eon-modal-veil" data-testid="eon-auth-modal">
      <div className="eon-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          className="eon-modal-close"
          onClick={onClose}
          aria-label="Close"
          data-testid="eon-auth-close"
        >
          <XIcon size={16} />
        </button>
        <div className="eon-modal-head">
          <EonMark size={48} />
          <div className="eon-modal-title">
            {mode === "signup" ? "Create your EON account" : "Welcome back"}
          </div>
          <div className="eon-modal-sub">
            {mode === "signup"
              ? "Save your work, run agent tasks, and keep your history."
              : "Sign in to continue with EON."}
          </div>
        </div>

        <div className="eon-tab-row">
          <button
            type="button"
            className={`eon-tab ${mode === "signin" ? "is-on" : ""}`}
            onClick={() => setMode("signin")}
            data-testid="eon-tab-signin"
          >
            Sign in
          </button>
          <button
            type="button"
            className={`eon-tab ${mode === "signup" ? "is-on" : ""}`}
            onClick={() => setMode("signup")}
            data-testid="eon-tab-signup"
          >
            Sign up
          </button>
        </div>

        <form
          onSubmit={submit}
          className="eon-form"
          data-testid="eon-auth-form"
          style={{ marginTop: 14 }}
        >
          {mode === "signup" && (
            <div className="eon-row-2">
              <input
                className="eon-input"
                placeholder="First name"
                value={form.first_name}
                onChange={set("first_name")}
                required
                data-testid="eon-input-first"
              />
              <input
                className="eon-input"
                placeholder="Last name"
                value={form.last_name}
                onChange={set("last_name")}
                required
                data-testid="eon-input-last"
              />
            </div>
          )}
          <input
            className="eon-input"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            required
            data-testid="eon-input-email"
          />
          <input
            className="eon-input"
            placeholder="Password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={form.password}
            onChange={set("password")}
            required
            minLength={mode === "signup" ? 6 : 1}
            data-testid="eon-input-password"
          />
          {mode === "signup" && (
            <input
              className="eon-input eon-input-quiet"
              placeholder="Access code (optional)"
              value={form.access_code}
              onChange={set("access_code")}
              data-testid="eon-input-code"
            />
          )}
          <button
            type="submit"
            className="eon-btn-primary"
            disabled={busy}
            data-testid="eon-auth-submit"
          >
            {busy ? (
              <Loader2 className="eon-icon-spin" size={16} />
            ) : (
              <>
                {mode === "signin" ? "Sign in" : "Create account"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {mode === "signin" && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setForgotMode(true)}
              style={{
                background: "none",
                border: "none",
                color: "#7aa9ff",
                fontSize: 13,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {forgotMode && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#ccc" }}>Reset password</h4>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await eonClient.post("/auth/reset-password", { email: forgotEmail });
                  toast.success("Check your email for reset instructions.");
                  setForgotMode(false);
                } catch (err) {
                  toast.error(err.response?.data?.detail || "Could not send reset email.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                className="eon-input"
                type="email"
                placeholder="Your email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="eon-btn-primary"
                disabled={busy}
                style={{ marginTop: 8 }}
              >
                {busy ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </div>
        )}

        {pendingPrompt ? (
          <div className="eon-modal-prompt-note" data-testid="eon-pending-note">
            Your prompt is saved: <em>“{pendingPrompt.slice(0, 100)}{pendingPrompt.length > 100 ? "…" : ""}”</em> — we'll send it as soon as you're in.
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "tasks", label: "Tasks", icon: ListChecks },
];

const Sidebar = ({ view, setView, user, onSignOut, mobileOpen, setMobileOpen }) => (
  <aside
    className={`eon-side ${mobileOpen ? "is-open" : ""}`}
    data-testid="eon-sidebar"
  >
    <div className="eon-side-brand">
      <EonMark size={36} />
      <div>
        <div className="eon-side-brand-name">EON</div>
        <div className="eon-side-brand-tag">Agent Platform</div>
      </div>
    </div>

    <div className="eon-nav-section">Workspace</div>
    {NAV_ITEMS.map(({ id, label, icon: Icon, soon }) => (
      <button
        type="button"
        key={id}
        className={`eon-nav-item ${view === id ? "is-on" : ""}`}
        onClick={() => {
          setView(id);
          setMobileOpen(false);
        }}
        data-testid={`eon-nav-${id}`}
      >
        <Icon size={16} />
        <span>{label}</span>
        {soon ? <span className="eon-nav-item-soon">Soon</span> : null}
      </button>
    ))}

    <div className="eon-side-foot">
      {user ? (
        <>
          <div style={{ padding: "0 6px" }}>
            Signed in as <strong style={{ color: "var(--eon-fg)" }}>{user.first_name || user.email}</strong>
            {user.is_admin ? " · admin" : ` · ${user.remaining < 0 ? "∞" : user.remaining} left`}
          </div>
          <button type="button" onClick={onSignOut} data-testid="eon-signout">
            <LogOut size={13} /> Sign out
          </button>
        </>
      ) : (
        <div style={{ padding: "0 6px" }}>
          Browsing as guest. Tasks &amp; history activate after sign in.
        </div>
      )}
    </div>
  </aside>
);

// ---------------------------------------------------------------------------
// Agent (chat) view
// ---------------------------------------------------------------------------
const TypingDots = () => (
  <span className="eon-typing"><span /> <span /> <span /></span>
);

const AGENT_ICONS = {
  researcher: Search,
  planner: ListTree,
  writer: PenLine,
  analyst: BarChart3,
};

const AgentView = ({ user, setUser, openAuth }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const recRef = useRef(null);

  const loadCurrent = useCallback(async () => {
    if (!user) {
      setMessages([]);
      return;
    }
    try {
      const { data } = await eonClient.get("/conversation");
      const items = (data.messages || []).map((m) => ({
        role: m.role === "assistant" ? "ai" : "me",
        text: m.text,
      }));
      setMessages(items);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  // Auto-resume pending prompt after auth
  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem(PENDING_PROMPT_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_PROMPT_KEY);
      // tiny delay so the chat UI has mounted
      setTimeout(() => send(pending), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const SR =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleListen = () => {
    if (!SR) {
      toast.message("Voice input isn't supported on this browser.");
      return;
    }
    if (listening) {
      try { recRef.current?.stop(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let txt = "";
      for (let i = 0; i < ev.results.length; i++) {
        txt += ev.results[i][0].transcript;
      }
      setInput(txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const send = async (override) => {
    const t = (override ?? input).trim();
    if (!t || busy || limitHit) return;

    // If not signed in, save prompt and open auth.
    if (!user) {
      sessionStorage.setItem(PENDING_PROMPT_KEY, t);
      setInput("");
      openAuth(t);
      return;
    }

    setMessages((m) => [...m, { role: "me", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await eonClient.post("/chat", { message: t });
      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
      setUser((u) =>
        u ? {
          ...u,
          message_count: data.message_count,
          remaining: data.remaining,
          is_admin: data.is_admin,
        } : u
      );
    } catch (err) {
      if (err.response?.status === 402) {
        setLimitHit(true);
        setMessages((m) => [
          ...m,
          { role: "ai", text: "You've reached your free access limit.", limit: true },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "ai", text: "EON is unavailable right now. Please try again in a moment." },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const heroChips = [
    "Plan my next 3 hours.",
    "Research the EV market in 2026.",
    "Draft a 2-line bio for a designer.",
    "Compare three project ideas.",
  ];

  return (
    <div className="eon-agent-page" data-testid="eon-agent-page">
      <div className="eon-agent-hero">
        <EonMark size={72} interactive />
        <div className="eon-agent-hero-text">
          <div className="eon-page-eyebrow">Agent</div>
          <div className="eon-page-title">Hi, I'm EON.</div>
          <div className="eon-page-sub">
            A personal AI agent system built to help you research, organize,
            automate workflows, and execute tasks faster.
          </div>
          <div className="eon-agent-chips">
            {heroChips.map((q) => (
              <button
                key={q}
                type="button"
                className="eon-agent-chip"
                onClick={() => send(q)}
                data-testid={`eon-chip-${q.slice(0, 6)}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="eon-chat-scroll" ref={scrollRef} style={{ position: "relative" }}>
        {messages.length === 0 ? (
          <div className="eon-empty">
            Start a conversation — your messages and history are saved
            once you're signed in.
          </div>
        ) : (
          <div className="eon-msg-stack">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`eon-msg ${m.role === "me" ? "eon-msg-me" : "eon-msg-ai"} ${m.limit ? "eon-msg-limit" : ""}`}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="eon-msg eon-msg-ai eon-msg-thinking">
                <TypingDots />
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="eon-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button
          type="button"
          className={`eon-mic ${listening ? "is-on" : ""}`}
          onClick={toggleListen}
          aria-label="Voice input"
          data-testid="eon-mic"
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <input
          className="eon-input eon-input-msg"
          placeholder={limitHit ? "You've reached your free access limit." : "Ask EON anything…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={limitHit}
          data-testid="eon-msg-input"
        />
        <button
          type="submit"
          className="eon-send"
          disabled={!input.trim() || busy || limitHit}
          data-testid="eon-send"
          aria-label="Send"
        >
          {busy ? <Loader2 size={15} className="eon-icon-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const StatCard = ({ label, value, sub }) => (
  <div className="eon-card">
    <div className="eon-stat-label">{label}</div>
    <div className="eon-stat-value">{value}</div>
    {sub ? <div className="eon-stat-sub">{sub}</div> : null}
  </div>
);

const relTime = (iso) => {
  try {
    const d = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - d);
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return "";
  }
};

const DashboardView = ({ user, openAuth, agents, setView }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    eonClient
      .get("/dashboard")
      .then((res) => setData(res.data))
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, [user]);

  const stats = data?.stats || {
    messages_sent: 0,
    active_threads: 0,
    tasks_total: 0,
    tasks_done: 0,
    tasks_running: 0,
    tasks_queued: 0,
  };
  const agentStats = data?.agents || agents.map((a) => ({ ...a, task_count: 0 }));
  const activity = data?.recent_activity || [];

  return (
    <div data-testid="eon-dashboard">
      <div className="eon-page-head">
        <div>
          <div className="eon-page-eyebrow">Dashboard</div>
          <div className="eon-page-title">
            Good to see you{user?.first_name ? `, ${user.first_name}` : ""}.
          </div>
          <div className="eon-page-sub">
            High-level view of your agent activity, tasks, and recent work.
          </div>
        </div>
        <button
          type="button"
          className="eon-dash-orb-btn"
          onClick={() => setView("agent")}
          data-testid="eon-dash-start"
          aria-label="Talk to EON"
        >
          <EonMark size={56} interactive={false} />
        </button>
      </div>

      {!user ? (
        <div className="eon-card eon-card-glass" style={{ marginBottom: 22, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                Browsing as guest
              </div>
              <div style={{ fontSize: 13, color: "var(--eon-fg-dim)" }}>
                Sign in to track tasks, save threads, and unlock agent execution.
              </div>
            </div>
            <button
              type="button"
              className="eon-btn eon-btn-solid"
              onClick={() => openAuth()}
              data-testid="eon-guest-signin"
            >
              Sign in <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="eon-grid-stats">
        <StatCard label="Messages" value={stats.messages_sent} sub="all-time, this account" />
        <StatCard label="Active threads" value={stats.active_threads} />
        <StatCard
          label="Tasks · running"
          value={stats.tasks_running}
          sub={`${stats.tasks_queued} queued · ${stats.tasks_done} done`}
        />
        <StatCard
          label="Tasks · total"
          value={stats.tasks_total}
          sub={loading ? "loading…" : "across all agents"}
        />
      </div>

      <div className="eon-grid-two">
        <div className="eon-card">
          <div className="eon-section-title">
            Specialist agents
            <span className="eon-section-count">{agentStats.length} ready</span>
          </div>
          <div className="eon-agents-grid">
            {agentStats.map((a) => {
              const Icon = AGENT_ICONS[a.id] || Bot;
              return (
                <div
                  key={a.id}
                  className="eon-agent-card"
                  onClick={() => setView("tasks")}
                  role="button"
                  tabIndex={0}
                  data-testid={`eon-agent-card-${a.id}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="eon-agent-dot" style={{ color: a.color }} />
                    <Icon size={14} style={{ color: a.color }} />
                    <span className="eon-agent-name">{a.name}</span>
                  </div>
                  <div className="eon-agent-tagline">{a.tagline}</div>
                  <div className="eon-agent-meta">
                    {a.task_count || 0} task{a.task_count === 1 ? "" : "s"} · tools: {a.tools.join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="eon-card">
          <div className="eon-section-title">
            <Activity size={14} /> Recent activity
          </div>
          {!user ? (
            <div className="eon-empty">Sign in to see your activity log.</div>
          ) : activity.length === 0 ? (
            <div className="eon-empty">No activity yet — kick things off with EON.</div>
          ) : (
            <div>
              {activity.map((a) => (
                <div key={a.id} className="eon-activity-row">
                  <span className="eon-activity-kind">{a.kind.replace(/_/g, " ")}</span>
                  <span className="eon-activity-summary">{a.summary}</span>
                  <span className="eon-activity-time">{relTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const TasksView = ({ user, openAuth, agents }) => {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks([]);
      return;
    }
    try {
      const { data } = await eonClient.get("/tasks");
      setTasks(data.tasks || []);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (e) => {
    e?.preventDefault();
    if (!title.trim()) return;
    if (!user) {
      openAuth();
      return;
    }
    setCreating(true);
    try {
      const { data } = await eonClient.post("/tasks", {
        title: title.trim(),
        agent_id: agentId || undefined,
      });
      setTasks((arr) => [data.task, ...arr]);
      setTitle("");
      toast.success(`Task queued for ${agents.find((a) => a.id === agentId)?.name || "EON"}`);
    } catch {
      toast.error("Couldn't create task.");
    } finally {
      setCreating(false);
    }
  };

  const run = async (id) => {
    if (!user) {
      openAuth();
      return;
    }
    setRunningId(id);
    setTasks((arr) => arr.map((t) => (t.id === id ? { ...t, status: "running" } : t)));
    try {
      const { data } = await eonClient.post(`/tasks/${id}/run`);
      setTasks((arr) => arr.map((t) => (t.id === id ? data.task : t)));
      toast.success("Task complete.");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error("Free access limit reached.");
      } else {
        toast.error("Task failed.");
      }
      setTasks((arr) => arr.map((t) => (t.id === id ? { ...t, status: "failed" } : t)));
    } finally {
      setRunningId(null);
    }
  };

  const del = async (id) => {
    if (!user) return;
    if (!window.confirm("Delete this task?")) return;
    try {
      await eonClient.delete(`/tasks/${id}`);
      setTasks((arr) => arr.filter((t) => t.id !== id));
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  return (
    <div data-testid="eon-tasks">
      <div className="eon-page-head">
        <div>
          <div className="eon-page-eyebrow">Tasks</div>
          <div className="eon-page-title">Run things, not just chats.</div>
          <div className="eon-page-sub">
            Queue a goal, pick a specialist agent, and let EON execute it end-to-end.
          </div>
        </div>
      </div>

      <form className="eon-task-bar" onSubmit={create}>
        <input
          className="eon-task-input"
          placeholder="e.g. Summarize the latest EV market trends in 5 bullets"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="eon-task-title"
        />
        <select
          className="eon-task-agent-select"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          data-testid="eon-task-agent"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="eon-btn eon-btn-solid"
          disabled={!title.trim() || creating}
          data-testid="eon-task-create"
        >
          {creating ? <Loader2 size={14} className="eon-icon-spin" /> : <Plus size={14} />} Add task
        </button>
      </form>

      {!user ? (
        <div className="eon-card eon-card-glass" style={{ padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "var(--eon-fg-dim)" }}>
            Sign in to create and run tasks — your queue is per-account.
          </div>
          <button
            type="button"
            className="eon-btn eon-btn-solid"
            onClick={() => openAuth()}
            style={{ marginTop: 14 }}
            data-testid="eon-tasks-signin"
          >
            Sign in <ArrowRight size={14} />
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="eon-empty">No tasks yet. Add your first one above.</div>
      ) : (
        <div>
          {tasks.map((t) => {
            const agent = agents.find((a) => a.id === t.agent_id);
            const Icon = AGENT_ICONS[t.agent_id] || Bot;
            return (
              <div key={t.id} className="eon-task-row" data-testid={`eon-task-${t.id}`}>
                <Icon size={16} style={{ color: agent?.color || "var(--eon-fg-dim)" }} />
                <div>
                  <div className="eon-task-title">{t.title}</div>
                  {t.description ? <div className="eon-task-desc">{t.description}</div> : null}
                  <div className="eon-task-desc">
                    {agent ? agent.name : "EON"} · {relTime(t.created_at)}
                  </div>
                </div>
                <div className="eon-status-pill" data-s={t.status}>{t.status}</div>
                <button
                  type="button"
                  className="eon-btn eon-btn-ghost"
                  onClick={() => run(t.id)}
                  disabled={runningId === t.id || t.status === "running"}
                  data-testid={`eon-task-run-${t.id}`}
                  title="Run task"
                >
                  {runningId === t.id ? <Loader2 size={13} className="eon-icon-spin" /> : <Play size={13} />}
                  {t.status === "done" ? "Re-run" : "Run"}
                </button>
                <button
                  type="button"
                  className="eon-btn eon-btn-ghost"
                  onClick={() => del(t.id)}
                  title="Delete"
                  data-testid={`eon-task-del-${t.id}`}
                >
                  <Trash2 size={13} />
                </button>
                {t.result ? (
                  <div className="eon-task-result" data-testid={`eon-task-result-${t.id}`}>
                    {t.result}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Coming-soon placeholder
// ---------------------------------------------------------------------------
const ComingSoon = ({ title, sub, testid }) => (
  <div className="eon-coming-wrap" data-testid={testid}>
    <div className="eon-coming-card">
      <div className="eon-coming-pill">Coming Soon</div>
      <div className="eon-coming-title">{title}</div>
      <div className="eon-coming-sub">{sub}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------
const Eon = () => {
  const hasStoredToken =
    typeof window !== "undefined" && !!localStorage.getItem(TOKEN_KEY);

  const [phase, setPhase] = useState(hasStoredToken ? "resuming" : "splash");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    return localStorage.getItem(ACTIVE_VIEW_KEY) || "dashboard";
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    document.title = "EON · Personal AI Agent";
  }, []);

  // Persist active view
  useEffect(() => {
    try { localStorage.setItem(ACTIVE_VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);

  // Resume existing session on mount
  useEffect(() => {
    // Capture Google-OAuth callback token from URL hash, if present.
    if (typeof window !== "undefined" && window.location.hash.includes("token=")) {
      try {
        const hash = window.location.hash.replace(/^#/, "");
        const params = new URLSearchParams(hash);
        const incoming = params.get("token");
        const err = params.get("auth_error");
        if (incoming) {
          localStorage.setItem(TOKEN_KEY, incoming);
        }
        if (err) {
          toast.error(decodeURIComponent(err).replace(/\+/g, " "));
        }
        // Clean the hash so refresh doesn't re-trigger
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch { /* ignore */ }
    }
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    eonClient
      .get("/me")
      .then((res) => {
        setUser(res.data);
        setPhase("app");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setPhase("splash");
      });
  }, []);

  // Load agents (static, no auth needed)
  useEffect(() => {
    eonClient
      .get("/agents")
      .then((res) => setAgents(res.data.agents || []))
      .catch(() => {/* ignore */});
  }, []);

  const handleAuthed = (u) => {
    setUser(u);
    setAuthOpen(false);
    setPendingPrompt("");
    toast.success(`Welcome${u?.first_name ? `, ${u.first_name}` : ""}.`);
  };

  const handleSignOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setView("dashboard");
    toast.message("Signed out.");
  };

  const handleSplashDone = useCallback(() => setPhase("app"), []);

  const openAuth = (promptText = "") => {
    setPendingPrompt(promptText);
    setAuthOpen(true);
  };

  const renderView = () => {
    switch (view) {
      case "agent":
        return <AgentView user={user} setUser={setUser} openAuth={openAuth} />;
      case "tasks":
        return <TasksView user={user} openAuth={openAuth} agents={agents} />;
      default:
        return (
          <DashboardView
            user={user}
            openAuth={openAuth}
            agents={agents}
            setView={setView}
          />
        );
    }
  };

  return (
    <div className={`eon-root eon-phase-${phase}`} data-testid="eon-root">
      <NebulaCanvas />
      <Galaxy phase={phase} />
      <Planets phase={phase} />
      <div className="eon-vignette" />

      {(phase === "splash") && <Splash onDone={handleSplashDone} />}
      {phase === "resuming" && (
        <div
          className="eon-splash"
          style={{ background: "rgba(2,2,6,0.65)" }}
          data-testid="eon-resuming"
          aria-hidden="true"
        >
          <div className="eon-splash-stack" style={{ gap: 18 }}>
            <EonMark size={64} />
            <Loader2 className="eon-icon-spin" size={18} color="rgba(255,255,255,0.55)" />
          </div>
        </div>
      )}

      {phase === "app" && (
        <div className="eon-shell">
          <Sidebar
            view={view}
            setView={setView}
            user={user}
            onSignOut={handleSignOut}
            mobileOpen={mobileNav}
            setMobileOpen={setMobileNav}
          />
          {mobileNav && (
            <div
              className="eon-side-veil"
              onClick={() => setMobileNav(false)}
              aria-hidden="true"
            />
          )}
          <main className="eon-main">
            <div className="eon-mobile-bar">
              <button
                type="button"
                className="eon-icon-btn"
                onClick={() => setMobileNav(true)}
                aria-label="Open menu"
                data-testid="eon-mobile-menu"
              >
                <Menu size={16} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <EonMark size={22} />
                <strong style={{ letterSpacing: "0.1em" }}>EON</strong>
              </div>
              {user ? (
                <button
                  type="button"
                  className="eon-icon-btn"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  data-testid="eon-mobile-signout"
                >
                  <LogOut size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="eon-btn eon-btn-ghost"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => openAuth()}
                  data-testid="eon-mobile-signin"
                >
                  Sign in
                </button>
              )}
            </div>
            {renderView()}
          </main>
        </div>
      )}

      {authOpen && (
        <AuthGate
          pendingPrompt={pendingPrompt}
          onAuthed={handleAuthed}
          onClose={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
};

export default Eon;
