import { useEffect, useRef, useState, useCallback } from "react";
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
  Archive,
  ArchiveRestore,
  X as XIcon,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import "./Eon.css";

// ---------------------------------------------------------------------------
const API = `${process.env.REACT_APP_BACKEND_URL}/api/eon-app`;
const TOKEN_KEY = "eon_token";

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
// Animated background — drifting starfield + slow nebula glows. Pure CSS
// would feel cheap; canvas gives us depth + parallax.
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
      // Even denser field — capped on small screens to keep mobile smooth
      const isMobile = c.clientWidth < 700;
      const divisor = isMobile ? 5500 : 3800;
      const count = Math.min(
        Math.floor((c.width * c.height) / divisor),
        isMobile ? 380 : 900
      );
      stars = new Array(count).fill(0).map(() => {
        // Four parallax depth layers — far / mid-far / mid / near
        const layer = Math.random();
        const z =
          layer < 0.55
            ? 0.2
            : layer < 0.85
            ? 0.4
            : layer < 0.97
            ? 0.7
            : 1.0;
        return {
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          z,
          // Gentle directional flow + small per-star wobble. Far stars
          // barely move; near stars drift visibly. Direction is consistent
          // for the depth layer so it reads like real parallax.
          baseVx: 0.012 * z * dpr,
          baseVy: -0.006 * z * dpr,
          // Tiny wobble — randomized so the field isn't a marching grid
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
      // Pure black base
      ctx.fillStyle = "rgb(2,2,6)";
      ctx.fillRect(0, 0, c.width, c.height);

      // ONE subtle, very slow blue glow drifting — not violet, not busy
      const t = Date.now() / 24000;
      const gx = c.width * (0.5 + Math.sin(t) * 0.18);
      const gy = c.height * (0.45 + Math.cos(t * 0.9) * 0.12);
      const g = ctx.createRadialGradient(
        gx,
        gy,
        0,
        gx,
        gy,
        Math.max(c.width, c.height) * 0.6
      );
      g.addColorStop(0, "rgba(70,110,210,0.10)");
      g.addColorStop(0.5, "rgba(30,40,90,0.03)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);

      // Stars — cool whites with faint blue, rendered as soft circles
      const now = Date.now() / 1000;
      for (const s of stars) {
        // Drift = consistent flow + tiny per-star wobble (sin/cos)
        s.x += s.baseVx + Math.sin(now * s.wf + s.wx) * 0.02 * s.z * dpr;
        s.y += s.baseVy + Math.cos(now * s.wf + s.wy) * 0.02 * s.z * dpr;
        if (s.x < 0) s.x += c.width;
        if (s.x > c.width) s.x -= c.width;
        if (s.y < 0) s.y += c.height;
        if (s.y > c.height) s.y -= c.height;
        // Twinkle: depth-weighted so distant stars shimmer subtly
        const alpha =
          (0.32 + Math.sin(now * s.tf + s.tw) * 0.36) * s.z;
        ctx.globalAlpha = Math.max(0.04, Math.min(1, alpha));
        // Near stars get a soft halo
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

// ---------------------------------------------------------------------------
// Galaxy — slow swirling spiral, peaks during splash. Pure CSS so it
// composites cheaply on top of the canvas. The conic-gradient creates the
// spiral arms; the radial mask gives it a disk shape; rotation animates.
// ---------------------------------------------------------------------------
const Galaxy = ({ phase }) => (
  <div
    className={`eon-galaxy eon-galaxy-${phase}`}
    aria-hidden="true"
  >
    <div className="eon-galaxy-disc" />
    <div className="eon-galaxy-core" />
    <div className="eon-galaxy-haze" />
  </div>
);

// ---------------------------------------------------------------------------
// Planets — a few distant orbs with radial gradients that drift slowly.
// Visible on splash + auth, hidden during chat so reading isn't busy.
// ---------------------------------------------------------------------------
const Planets = ({ phase }) => {
  if (phase === "chat" || phase === "warp") return null;
  return (
    <div className="eon-planets" aria-hidden="true">
      <div className="eon-planet eon-planet-1" />
      <div className="eon-planet eon-planet-2" />
      <div className="eon-planet eon-planet-3" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// EON wordmark / mark
// ---------------------------------------------------------------------------
// EON circuit — interactive when `interactive` is true. Each tap/click
// pushes the scale up by a small step (capped). After `idleMs` of inactivity
// the scale eases back down toward 1.0 in soft increments. This lives in
// chat intro + splash; the tiny header copy is non-interactive so the
// layout never moves.
const EonMark = ({ size = 56, interactive = false }) => {
  const [scale, setScale] = useState(1);
  const idleRef = useRef(null);

  const stepDown = useCallback(() => {
    setScale((s) => {
      const next = Math.max(1, +(s - 0.08).toFixed(3));
      if (next > 1) {
        idleRef.current = setTimeout(stepDown, 220);
      } else {
        idleRef.current = null;
      }
      return next;
    });
  }, []);

  const handleActivate = useCallback(() => {
    if (!interactive) return;
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
    // Bump the scale on each tap; cap so it never breaks the layout.
    setScale((s) => Math.min(1.7, +(s + 0.12).toFixed(3)));
    // Schedule the auto-shrink to kick in after a brief pause.
    idleRef.current = setTimeout(stepDown, 1500);
  }, [interactive, stepDown]);

  useEffect(() => {
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, []);

  return (
    <div
      className={`eon-mark ${interactive ? "eon-mark-interactive" : ""}`}
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
      }}
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

// EON wordmark — bold custom typography with a single distinctive touch:
// the E's middle arm is shorter and ends in a 45° angled cut, giving the
// mark a subtle geometric edge without feeling overdesigned.
const EonWordmark = ({ size = 64, className = "" }) => {
  // viewBox tuned so the three glyphs read as a single, tight wordmark.
  // Stroke widths and gaps are deliberate — adjust here only.
  return (
    <svg
      viewBox="0 0 360 96"
      width="auto"
      height={size}
      className={`eon-wordmark ${className}`}
      aria-label="EON"
      role="img"
    >
      <defs>
        <linearGradient id="eon-wm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#c8d2f0" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <g fill="url(#eon-wm-grad)">
        {/* E — top arm full width, middle arm shorter with 45° cut, bottom arm full. */}
        <path d="M 4 4 H 100 V 22 H 26 V 38 H 80 L 70 50 H 26 V 74 H 100 V 92 H 4 Z" />
        {/* O — geometric, slightly squared */}
        <path d="M 168 4 C 142 4 128 22 128 48 C 128 74 142 92 168 92 C 194 92 208 74 208 48 C 208 22 194 4 168 4 Z M 168 22 C 184 22 190 32 190 48 C 190 64 184 74 168 74 C 152 74 146 64 146 48 C 146 32 152 22 168 22 Z" />
        {/* N — bold, sharp diagonals */}
        <path d="M 234 4 H 254 L 322 64 V 4 H 342 V 92 H 322 L 254 32 V 92 H 234 Z" />
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Splash — 2.6s premium intro
// ---------------------------------------------------------------------------
const Splash = ({ onDone }) => {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    const t = setTimeout(() => {
      firedRef.current = true;
      onDone();
    }, 2600);
    return () => clearTimeout(t);
    // run once on mount; ignore onDone identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="eon-splash" data-testid="eon-splash">
      <div className="eon-splash-stack">
        <EonMark size={84} />
        <div className="eon-splash-word">EON</div>
        <div className="eon-splash-tag">Powered by Wood AI</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Auth — glass card with sign-in / sign-up tabs
// ---------------------------------------------------------------------------
const AuthScreen = ({ onAuthed }) => {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    access_code: "",
  });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
      const msg =
        err.response?.data?.detail || "Could not complete that request.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="eon-auth-wrap" data-testid="eon-auth">
      <div className="eon-auth-card">
        <div className="eon-auth-head">
          <EonMark size={44} />
          <div className="eon-auth-title">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </div>
          <div className="eon-auth-sub">
            {mode === "signin"
              ? "Sign in to continue talking with EON."
              : "A premium AI assistant by Jwood Technologies."}
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

        <form onSubmit={submit} className="eon-form" data-testid="eon-auth-form">
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

        <div className="eon-auth-foot">
          Powered by <span className="eon-accent">Wood AI</span> ·
          <span className="eon-muted"> Jwood Technologies</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chat — full-bleed assistant interface
// ---------------------------------------------------------------------------
const TypingDots = () => (
  <span className="eon-typing">
    <span /> <span /> <span />
  </span>
);

const Chat = ({ user, setUser, onSignOut }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const recRef = useRef(null);

  // Threads
  const [threads, setThreads] = useState([]);
  const [archived, setArchived] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("active"); // active | archived

  const refreshThreads = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        eonClient.get("/threads"),
        eonClient.get("/threads", { params: { archived: true } }),
      ]);
      setThreads(a.data.threads || []);
      setArchived(b.data.threads || []);
    } catch {
      /* ignore */
    }
  }, []);

  // Load the user's current thread + history
  const loadCurrent = useCallback(async () => {
    try {
      const { data } = await eonClient.get("/conversation");
      const items = (data.messages || []).map((m) => ({
        role: m.role === "assistant" ? "ai" : "me",
        text: m.text,
      }));
      setActiveThreadId(data.thread?.id || null);
      setMessages(items);
    } catch {
      /* ignore */
    }
  }, []);

  const loadThread = useCallback(async (tid) => {
    try {
      const { data } = await eonClient.get(`/threads/${tid}`);
      const items = (data.messages || []).map((m) => ({
        role: m.role === "assistant" ? "ai" : "me",
        text: m.text,
      }));
      setActiveThreadId(tid);
      setMessages(items);
      setLimitHit(false);
      setDrawerOpen(false);
    } catch {
      toast.error("Couldn't open that thread.");
    }
  }, []);

  useEffect(() => {
    loadCurrent();
    refreshThreads();
  }, [loadCurrent, refreshThreads]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  // Speech recognition (Web Speech API)
  const SR =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleListen = () => {
    if (!SR) {
      toast.message("Voice input isn't supported on this browser.");
      return;
    }
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
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
    setMessages((m) => [...m, { role: "me", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await eonClient.post("/chat", {
        message: t,
        thread_id: activeThreadId || undefined,
      });
      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
      if (data.thread_id && data.thread_id !== activeThreadId) {
        setActiveThreadId(data.thread_id);
      }
      setUser((u) =>
        u
          ? {
              ...u,
              message_count: data.message_count,
              remaining: data.remaining,
              is_admin: data.is_admin,
            }
          : u
      );
      // refresh thread list (titles auto-update on first message)
      refreshThreads();
    } catch (err) {
      if (err.response?.status === 402) {
        setLimitHit(true);
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            text: "You've reached your free access limit.",
            limit: true,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            text: "EON is unavailable right now. Please try again in a moment.",
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const startNewThread = async () => {
    try {
      const { data } = await eonClient.post("/threads", {});
      setActiveThreadId(data.thread.id);
      setMessages([]);
      setLimitHit(false);
      setDrawerOpen(false);
      refreshThreads();
      toast.success("New thread started.");
    } catch {
      toast.error("Couldn't start a new thread.");
    }
  };

  const clearConvo = async () => {
    if (!window.confirm("Clear messages in this thread?")) return;
    try {
      await eonClient.delete("/conversation");
      setMessages([]);
      refreshThreads();
      toast.success("Thread cleared.");
    } catch {
      toast.error("Couldn't clear thread.");
    }
  };

  const archiveThread = async (tid) => {
    try {
      await eonClient.delete(`/threads/${tid}`);
      // If we just archived the active thread, fall back to another active
      // one or create a fresh thread.
      if (tid === activeThreadId) {
        await loadCurrent();
      }
      refreshThreads();
      toast.success("Thread archived.");
    } catch {
      toast.error("Couldn't archive.");
    }
  };

  const restoreThread = async (tid) => {
    try {
      await eonClient.patch(`/threads/${tid}`, { archived: false });
      refreshThreads();
      toast.success("Thread restored.");
    } catch {
      toast.error("Couldn't restore.");
    }
  };

  const deleteThreadPermanent = async (tid) => {
    if (
      !window.confirm(
        "Permanently delete this thread and all its messages?"
      )
    )
      return;
    try {
      await eonClient.delete(`/threads/${tid}`, {
        params: { permanent: true },
      });
      refreshThreads();
      toast.success("Thread deleted.");
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  const intro = (
    <div className="eon-intro" data-testid="eon-intro">
      <EonMark size={92} interactive />
      <div className="eon-intro-title">Hi, I'm EON.</div>
      <div className="eon-intro-sub">Powered by Wood AI.</div>
      <div className="eon-prompt-row">
        {[
          "Tell me something interesting.",
          "Plan my next 3 hours.",
          "Sharp two-line bio for a designer.",
        ].map((q) => (
          <button
            key={q}
            type="button"
            className="eon-prompt-pill"
            onClick={() => send(q)}
            data-testid={`eon-prompt-${q.slice(0, 8)}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );

  const renderThreadList = (list, isArchived) => {
    if (list.length === 0) {
      return (
        <div className="eon-threads-empty">
          {isArchived ? "No archived threads yet." : "No threads yet."}
        </div>
      );
    }
    return list.map((t) => (
      <div
        key={t.id}
        className={`eon-thread-row ${
          !isArchived && t.id === activeThreadId ? "is-active" : ""
        }`}
        data-testid={`eon-thread-${t.id}`}
      >
        <button
          type="button"
          className="eon-thread-main"
          onClick={() =>
            isArchived ? restoreThread(t.id) : loadThread(t.id)
          }
          title={isArchived ? "Restore thread" : "Open thread"}
        >
          <MessageSquare size={13} className="eon-thread-icon" />
          <span className="eon-thread-title">{t.title}</span>
          <span className="eon-thread-count">{t.message_count}</span>
        </button>
        {isArchived ? (
          <>
            <button
              type="button"
              className="eon-thread-action"
              onClick={() => restoreThread(t.id)}
              title="Restore"
            >
              <ArchiveRestore size={13} />
            </button>
            <button
              type="button"
              className="eon-thread-action"
              onClick={() => deleteThreadPermanent(t.id)}
              title="Delete permanently"
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="eon-thread-action"
            onClick={() => archiveThread(t.id)}
            title="Archive"
          >
            <Archive size={13} />
          </button>
        )}
      </div>
    ));
  };

  return (
    <div className="eon-chat" data-testid="eon-chat">
      {/* Threads drawer */}
      {drawerOpen && (
        <>
          <div
            className="eon-drawer-veil"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="eon-drawer" data-testid="eon-threads-drawer">
            <div className="eon-drawer-head">
              <div className="eon-chat-name">EON</div>
              <button
                type="button"
                className="eon-icon-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
              >
                <XIcon size={14} />
              </button>
            </div>
            <button
              type="button"
              className="eon-new-thread-btn"
              onClick={startNewThread}
              data-testid="eon-new-thread"
            >
              <Plus size={14} /> New thread
            </button>
            <div className="eon-drawer-tabs">
              <button
                type="button"
                className={`eon-drawer-tab ${
                  drawerTab === "active" ? "is-on" : ""
                }`}
                onClick={() => setDrawerTab("active")}
                data-testid="eon-tab-active"
              >
                Active
              </button>
              <button
                type="button"
                className={`eon-drawer-tab ${
                  drawerTab === "archived" ? "is-on" : ""
                }`}
                onClick={() => setDrawerTab("archived")}
                data-testid="eon-tab-archived"
              >
                Archived
              </button>
            </div>
            <div className="eon-thread-list">
              {drawerTab === "active"
                ? renderThreadList(threads, false)
                : renderThreadList(archived, true)}
            </div>
          </aside>
        </>
      )}

      <header className="eon-chat-head">
        <div className="eon-chat-head-left">
          <button
            type="button"
            className="eon-icon-btn eon-menu-btn"
            onClick={() => {
              setDrawerOpen(true);
              refreshThreads();
            }}
            aria-label="Threads"
            data-testid="eon-open-threads"
          >
            <Menu size={15} />
          </button>
          <EonMark size={26} />
          <div>
            <div className="eon-chat-name">EON</div>
            <div className="eon-chat-meta">
              {user.is_admin ? "Admin · unlimited" : "Powered by Wood AI"}
            </div>
          </div>
        </div>
        <div className="eon-chat-head-right">
          <button
            type="button"
            className="eon-icon-btn"
            onClick={startNewThread}
            title="Start new thread"
            data-testid="eon-new-thread-head"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="eon-icon-btn"
            onClick={clearConvo}
            title="Clear this thread"
            data-testid="eon-clear"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className="eon-icon-btn"
            onClick={onSignOut}
            title="Sign out"
            data-testid="eon-signout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="eon-chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          intro
        ) : (
          <div className="eon-msg-stack">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`eon-msg ${
                  m.role === "me" ? "eon-msg-me" : "eon-msg-ai"
                } ${m.limit ? "eon-msg-limit" : ""}`}
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
          placeholder={
            limitHit
              ? "You've reached your free access limit."
              : "Ask EON anything…"
          }
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
          {busy ? (
            <Loader2 size={15} className="eon-icon-spin" />
          ) : (
            <Send size={15} />
          )}
        </button>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------
const Eon = () => {
  // If a stored token exists at boot, skip the splash entirely and go
  // straight into the chat experience as soon as /me resolves. Splash is
  // a first-touch experience only.
  const hasStoredToken =
    typeof window !== "undefined" && !!localStorage.getItem(TOKEN_KEY);

  const [phase, setPhase] = useState(hasStoredToken ? "resuming" : "splash");
  const [user, setUser] = useState(null);

  useEffect(() => {
    document.title = "EON";
  }, []);

  // Resume existing session on mount
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    eonClient
      .get("/me")
      .then((res) => {
        setUser(res.data);
        setPhase("chat");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setPhase("auth");
      });
  }, []);

  const handleAuthed = (u) => {
    setUser(u);
    setPhase("chat");
  };

  const handleSignOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setPhase("auth");
  };

  // Splash → 2.4s warp → auth. Only first-touch users see this.
  const handleSplashDone = useCallback(() => {
    setPhase("warp");
    setTimeout(() => setPhase("auth"), 2400);
  }, []);

  return (
    <div
      className={`eon-root eon-phase-${phase}`}
      data-testid="eon-root"
    >
      <NebulaCanvas />
      <Galaxy phase={phase} />
      <Planets phase={phase} />
      <div className="eon-vignette" />
      {(phase === "splash" || phase === "warp") && (
        <Splash onDone={handleSplashDone} />
      )}
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
      {phase === "warp" && (
        <div className="eon-warp-layer" data-testid="eon-warp" aria-hidden="true">
          <div className="eon-warp-streaks" />
          <div className="eon-warp-flash" />
        </div>
      )}
      {phase === "auth" && <AuthScreen onAuthed={handleAuthed} />}
      {phase === "chat" && user && (
        <Chat user={user} setUser={setUser} onSignOut={handleSignOut} />
      )}
      {phase !== "splash" && phase !== "warp" && (
        <div className="eon-corner">
          <Sparkles size={11} />
          EON · Powered by Wood AI
        </div>
      )}
    </div>
  );
};

export default Eon;

