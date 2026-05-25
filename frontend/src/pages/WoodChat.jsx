/**
 * WoodChat (a.k.a. WoodX)
 * -----------------------
 * Premium encrypted messaging platform. Built on the existing WoodX
 * JWT auth (no change to backend `/api/wc/*`) and bridged into
 * CometChat's React UI Kit for the chat surface.
 *
 * Sidebar nav:
 *   • Chats           — CometChat Conversations
 *   • Groups          — CometChat Groups
 *   • Contacts        — CometChat Users
 *   • Wallet          — Coming Soon
 *   • Market / News   — Coming Soon
 *   • EON             — Coming Soon (EON Messaging Agent)
 *
 * Guest mode: page is fully viewable; "Send message", "Start chat",
 * etc. open the auth modal instead of working anonymously.
 */
import { useEffect, useMemo, useState, useCallback, useRef, lazy, Suspense } from "react";
import {
  MessageSquare,
  Users,
  Contact as ContactIcon,
  Wallet as WalletIcon,
  Newspaper,
  Sparkles,
  Sun,
  Moon,
  Menu,
  LogOut,
  X as XIcon,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import "./WoodChat.css";
import { BACKEND_URL, googleLoginUrl } from "../lib/config";

const API = `${BACKEND_URL}/api/woodchat`;
const WX_TOKEN_KEY = "wc_token";
const WX_THEME_KEY = "wx_theme";
const WX_VIEW_KEY = "wx_view";

const wcClient = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});
wcClient.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(WX_TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const COMETCHAT_APP_ID = process.env.REACT_APP_COMETCHAT_APP_ID || "";
const COMETCHAT_REGION = process.env.REACT_APP_COMETCHAT_REGION || "us";
const COMETCHAT_AUTH_KEY = process.env.REACT_APP_COMETCHAT_AUTH_KEY || "";

// Lazy-load CometChat UI Kit so its bundle only ships when needed.
const CometChatSurface = lazy(() => import("../components/CometChatSurface"));

// ---------------------------------------------------------------------------
// Logo (real WoodX mark — white PNG; light theme inverts via CSS filter)
// ---------------------------------------------------------------------------
const WxLogo = ({ className = "wx-brand-logo" }) => (
  <img src="/woodx-logo.png" alt="WoodX" className={className} />
);

// ---------------------------------------------------------------------------
// Google icon
// ---------------------------------------------------------------------------
const GoogleSVG = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.4l-6.5-5.3C29.4 34.7 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2.1 3.9-3.9 5.2l6.5 5.3C40.9 36.1 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

// ---------------------------------------------------------------------------
// Auth modal
// ---------------------------------------------------------------------------
const AuthModal = ({ onAuthed, onClose, intent }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body =
        mode === "register"
          ? {
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              username: form.username.trim().toLowerCase(),
              email: form.email.trim().toLowerCase(),
              password: form.password,
            }
          : {
              email: form.email.trim().toLowerCase(),
              password: form.password,
            };
      const { data } = await wcClient.post(`/auth/${mode}`, body);
      localStorage.setItem(WX_TOKEN_KEY, data.token);
      onAuthed(data.user);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wx-modal-veil" data-testid="wx-auth-modal">
      <div className="wx-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          onClick={onClose}
          className="wx-modal-close"
          data-testid="wx-auth-close"
          aria-label="Close"
        >
          <XIcon size={15} />
        </button>

        <div className="wx-modal-head">
          <WxLogo className="wx-modal-logo" />
          <div className="wx-modal-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </div>
          <div className="wx-modal-sub">
            {intent ||
              (mode === "login"
                ? "Sign in to continue on WoodX."
                : "Encrypted messaging, end-to-end private.")}
          </div>
        </div>

        <button
          type="button"
          className="wx-google-btn"
          onClick={() => {
            window.location.href = googleLoginUrl({
              app: "woodchat",
              next: "/woodchat",
            });
          }}
          data-testid="wx-google-btn"
        >
          <GoogleSVG />
          Continue with Google
        </button>

        <div className="wx-or-divider">or</div>

        <div className="wx-tab-row">
          <button
            type="button"
            className={`wx-tab ${mode === "login" ? "is-on" : ""}`}
            onClick={() => setMode("login")}
            data-testid="wx-tab-login"
          >
            Sign in
          </button>
          <button
            type="button"
            className={`wx-tab ${mode === "register" ? "is-on" : ""}`}
            onClick={() => setMode("register")}
            data-testid="wx-tab-register"
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} data-testid="wx-auth-form">
          {mode === "register" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  className="wx-input"
                  placeholder="First name"
                  value={form.first_name}
                  onChange={set("first_name")}
                  required
                  data-testid="wx-first"
                />
                <input
                  className="wx-input"
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={set("last_name")}
                  required
                  data-testid="wx-last"
                />
              </div>
              <input
                className="wx-input"
                placeholder="Username"
                value={form.username}
                onChange={set("username")}
                required
                data-testid="wx-username"
              />
            </>
          )}
          <input
            className="wx-input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            required
            data-testid="wx-email"
          />
          <input
            className="wx-input"
            type="password"
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
            required
            minLength={mode === "register" ? 6 : 1}
            data-testid="wx-password"
          />
          <button
            type="submit"
            className="wx-btn wx-btn-solid"
            disabled={busy}
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            data-testid="wx-auth-submit"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight size={14} />
              </>
            )}
          </button>
          <p
            style={{
              fontSize: 11,
              color: "var(--wx-fg-quiet)",
              textAlign: "center",
              marginTop: 12,
              fontFamily: "var(--wx-font-mono)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Encrypted · Private · No spam
          </p>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Coming-soon panel
// ---------------------------------------------------------------------------
const ComingSoon = ({ title, sub, testid, Icon }) => (
  <div className="wx-empty" data-testid={testid}>
    <div className="wx-empty-icon">{Icon ? <Icon size={22} /> : null}</div>
    <div className="wx-soon-pill">Coming Soon</div>
    <div className="wx-empty-title">{title}</div>
    <div style={{ maxWidth: 380, lineHeight: 1.55 }}>{sub}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const NAV = [
  { id: "chats",   label: "Chats",         icon: MessageSquare },
  { id: "groups",  label: "Groups",        icon: Users },
  { id: "contacts",label: "Contacts",      icon: ContactIcon },
  { id: "eon",     label: "EON",           icon: Sparkles },
  { id: "wallet",  label: "Wallet",        icon: WalletIcon,  soon: true },
  { id: "news",    label: "Market / News", icon: Newspaper,   soon: true },
];

const initials = (u) => {
  if (!u) return "";
  const f = (u.first_name || "").charAt(0);
  const l = (u.last_name || "").charAt(0);
  return ((f + l) || (u.username || u.email || "?").charAt(0)).toUpperCase();
};

const Sidebar = ({ view, setView, user, theme, toggleTheme, onSignOut, openAuth, mobileOpen, setMobileOpen }) => (
  <aside className={`wx-side ${mobileOpen ? "is-open" : ""}`} data-testid="wx-sidebar">
    <div className="wx-brand">
      <WxLogo />
      <div>
        <div className="wx-brand-name">WoodX</div>
        <div className="wx-brand-tag">Encrypted</div>
      </div>
    </div>

    <div className="wx-side-label">Workspace</div>
    {NAV.map(({ id, label, icon: Icon, soon }) => (
      <button
        type="button"
        key={id}
        className={`wx-nav-item ${view === id ? "is-on" : ""}`}
        onClick={() => {
          setView(id);
          setMobileOpen(false);
        }}
        data-testid={`wx-nav-${id}`}
      >
        <Icon size={16} />
        <span>{label}</span>
        {soon ? <span className="wx-nav-soon">Soon</span> : null}
      </button>
    ))}

    <div className="wx-side-foot">
      <button type="button" className="wx-theme-toggle" onClick={toggleTheme} data-testid="wx-theme-toggle">
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>

      {user ? (
        <div className="wx-side-user">
          <div className="wx-avatar">{initials(user)}</div>
          <div className="wx-user-text" style={{ flex: 1, minWidth: 0 }}>
            <div className="wx-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.first_name || user.username || "WoodX user"}
            </div>
            <div className="wx-user-handle">
              @{(user.username || user.email?.split("@")[0] || "").slice(0, 16)}
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="wx-btn wx-btn-ghost"
            style={{ padding: "6px 8px" }}
            data-testid="wx-signout"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      ) : (
        <button type="button" className="wx-btn wx-btn-solid" onClick={() => openAuth()} data-testid="wx-side-signin" style={{ justifyContent: "center" }}>
          Sign in <ArrowRight size={13} />
        </button>
      )}
    </div>
  </aside>
);

// ---------------------------------------------------------------------------
// EON Agent panel — live AI chat embedded in WoodX
// ---------------------------------------------------------------------------
const WX_EON_HISTORY_KEY = "wx_eon_history";

const EonAgentPanel = ({ user, openAuth }) => {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = sessionStorage.getItem(WX_EON_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(WX_EON_HISTORY_KEY, JSON.stringify(messages.slice(-40)));
    } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  const send = async (override) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    if (!user) {
      openAuth("Sign in to chat with EON.");
      return;
    }
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await wcClient.post("/eon/chat", { message: text, history });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "EON is unavailable right now. Please try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    if (!window.confirm("Clear this conversation with EON?")) return;
    setMessages([]);
    try { sessionStorage.removeItem(WX_EON_HISTORY_KEY); } catch { /* ignore */ }
  };

  const prompts = [
    "Summarize my last conversation.",
    "Draft a quick reply.",
    "Plan my next 3 hours.",
    "What should I follow up on today?",
  ];

  return (
    <div className="wx-eon-stage" data-testid="wx-eon-stage">
      <div className="wx-eon-hero">
        <div className="wx-eon-orb">
          <span className="wx-orb-glow" />
          <span className="wx-orb-core" />
        </div>
        <div className="wx-eon-hero-text">
          <h2>EON</h2>
          <p>Your AI agent inside WoodX — summarize threads, draft replies, plan tasks, research.</p>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            className="wx-btn wx-btn-ghost"
            onClick={clearChat}
            data-testid="wx-eon-clear"
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="wx-eon-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="wx-eon-empty">
            <div style={{ marginBottom: 16 }}>Try one of these:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="wx-btn wx-btn-ghost"
                  style={{ fontSize: 12, padding: "7px 12px" }}
                  onClick={() => send(p)}
                  data-testid={`wx-eon-chip-${p.slice(0, 6)}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`wx-eon-msg ${m.role === "user" ? "wx-eon-msg-me" : "wx-eon-msg-ai"}`}
            >
              {m.content}
            </div>
          ))
        )}
        {busy && (
          <div className="wx-eon-msg wx-eon-msg-ai wx-eon-typing" data-testid="wx-eon-typing">
            <span /><span /><span />
          </div>
        )}
      </div>

      <form
        className="wx-eon-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          placeholder={user ? "Ask EON anything…" : "Sign in to chat with EON…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          data-testid="wx-eon-input"
        />
        <button
          type="submit"
          className="wx-eon-send"
          disabled={!input.trim() || busy}
          data-testid="wx-eon-send"
          aria-label="Send"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        </button>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const WoodChat = () => {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem(WX_THEME_KEY) || "dark"
  );
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem(WX_VIEW_KEY) || "chats");
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    document.title = "WoodX · Encrypted Messaging";
  }, []);

  useEffect(() => {
    localStorage.setItem(WX_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(WX_VIEW_KEY, view);
  }, [view]);

  // Resume session on load + capture Google-OAuth token hash
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("token=")) {
      try {
        const hash = window.location.hash.replace(/^#/, "");
        const params = new URLSearchParams(hash);
        const incoming = params.get("token");
        const err = params.get("auth_error");
        if (incoming) {
          localStorage.setItem(WX_TOKEN_KEY, incoming);
        }
        if (err) {
          toast.error(decodeURIComponent(err).replace(/\+/g, " "));
        }
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch { /* ignore */ }
    }
    const t = localStorage.getItem(WX_TOKEN_KEY);
    if (!t) {
      setBooting(false);
      return;
    }
    wcClient
      .get("/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(WX_TOKEN_KEY))
      .finally(() => setBooting(false));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const openAuth = useCallback((intent = "") => {
    setAuthIntent(intent);
    setAuthOpen(true);
  }, []);

  const handleAuthed = (u) => {
    setUser(u);
    setAuthOpen(false);
    toast.success(`Welcome${u?.first_name ? `, ${u.first_name}` : ""}.`);
  };

  const handleSignOut = () => {
    localStorage.removeItem(WX_TOKEN_KEY);
    setUser(null);
    toast.message("Signed out.");
  };

  // CometChat session settings for the surface component
  const cometchatProps = useMemo(
    () => ({
      appId: COMETCHAT_APP_ID,
      region: COMETCHAT_REGION,
      authKey: COMETCHAT_AUTH_KEY,
      uid: user?.id || user?.username || "",
      displayName:
        user?.first_name
          ? `${user.first_name} ${user.last_name || ""}`.trim()
          : user?.username || user?.email || "",
      theme,
      view, // chats | groups | contacts
    }),
    [user, theme, view]
  );

  const ready = !booting;

  if (!ready) {
    return (
      <div className="wx-root" data-theme={theme}>
        <div style={{ display: "grid", placeItems: "center", gridColumn: "1 / -1" }}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      </div>
    );
  }

  const titleByView = {
    chats: "Chats",
    groups: "Groups",
    contacts: "Contacts",
    wallet: "Wallet",
    news: "Market / News",
    eon: "EON",
  };

  const subByView = {
    chats: "Encrypted 1:1 and small-group conversations.",
    groups: "Team and community channels.",
    contacts: "People on WoodX you can reach.",
    wallet: "Send and receive value — coming soon.",
    news: "Live market signals — coming soon.",
    eon: "Your AI agent — built into WoodX.",
  };

  // ---- EON-in-WoodX chat panel ----------------------------------------
  const renderEonAgent = () => (
    <EonAgentPanel user={user} openAuth={openAuth} />
  );

  const renderContent = () => {
    if (view === "eon") return renderEonAgent();
    if (view === "wallet") {
      return (
        <ComingSoon
          title="Wallet"
          sub="Send, receive, and manage digital payments inside WoodX. Pairs with the EON agent for spend insights."
          testid="wx-wallet"
          Icon={WalletIcon}
        />
      );
    }
    if (view === "news") {
      return (
        <ComingSoon
          title="Market / News"
          sub="Live market signals and news, curated and pushed into your chat. Your Researcher agent does the work."
          testid="wx-news"
          Icon={Newspaper}
        />
      );
    }

    // Chats / Groups / Contacts: render the CometChat surface, gated for guests.
    if (!user) {
      return (
        <div className="wx-empty" data-testid="wx-guest-empty">
          <div className="wx-empty-icon"><MessageSquare size={22} /></div>
          <div className="wx-empty-title">Sign in to start messaging</div>
          <div style={{ maxWidth: 420, lineHeight: 1.55 }}>
            WoodX is an encrypted multi-purpose messaging platform built for
            communication, collaboration, and digital payments. Browse freely —
            sign in when you're ready to message.
          </div>
          <button
            type="button"
            className="wx-btn wx-btn-solid"
            onClick={() => openAuth("Sign in to start messaging on WoodX.")}
            data-testid="wx-guest-signin"
          >
            Sign in <ArrowRight size={14} />
          </button>
        </div>
      );
    }

    return (
      <Suspense
        fallback={
          <div className="wx-empty">
            <Loader2 size={20} className="animate-spin" />
            <div>Loading conversations…</div>
          </div>
        }
      >
        <CometChatSurface view={view} />
      </Suspense>
    );
  };

  return (
    <div className="wx-root" data-theme={theme} data-testid="wx-root">
      <Sidebar
        view={view}
        setView={setView}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        onSignOut={handleSignOut}
        openAuth={openAuth}
        mobileOpen={mobileNav}
        setMobileOpen={setMobileNav}
      />
      {mobileNav && (
        <div className="wx-side-veil" onClick={() => setMobileNav(false)} aria-hidden="true" />
      )}

      <main className="wx-main">
        <header className="wx-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              type="button"
              className="wx-btn wx-btn-ghost wx-mobile-only"
              onClick={() => setMobileNav(true)}
              data-testid="wx-mobile-menu"
              style={{ padding: "6px 10px" }}
              aria-label="Open menu"
            >
              <Menu size={14} />
            </button>
            <div>
              <div className="wx-page-title">{titleByView[view]}</div>
              <div className="wx-page-sub">{subByView[view]}</div>
            </div>
          </div>
          {!user ? (
            <button
              type="button"
              className="wx-btn wx-btn-solid"
              onClick={() => openAuth("Sign in to use this section.")}
              data-testid="wx-top-signin"
            >
              Sign in <ArrowRight size={14} />
            </button>
          ) : null}
        </header>

        <section className="wx-content">
          {!user && (view === "chats" || view === "groups" || view === "contacts" || view === "eon") ? (
            <div className="wx-guest-banner" data-testid="wx-guest-banner">
              <Sparkles size={14} />
              <span>
                Browsing as <strong>guest</strong>. Sign in to message, run EON, and save contacts.
              </span>
            </div>
          ) : null}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderContent()}
          </div>
          <footer className="wx-foot">
            <div>© {new Date().getFullYear()} Jwood Technologies · WoodX</div>
            <div className="wx-foot-links">
              <a href="/privacy" data-testid="wx-foot-privacy">Privacy</a>
              <a href="/terms" data-testid="wx-foot-terms">Terms</a>
            </div>
          </footer>
        </section>
      </main>

      {authOpen && (
        <AuthModal
          onAuthed={handleAuthed}
          onClose={() => setAuthOpen(false)}
          intent={authIntent}
        />
      )}
    </div>
  );
};

export default WoodChat;
