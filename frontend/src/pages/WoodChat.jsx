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
import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api/woodchat`;
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
// Logo
// ---------------------------------------------------------------------------
const WxLogo = () => (
  <div className="wx-logo-circle" aria-hidden="true">WX</div>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div className="wx-modal-title">
              {mode === "login" ? "Welcome back to WoodX" : "Create your WoodX account"}
            </div>
            <div className="wx-modal-sub">
              {intent ||
                "Sign in to message, join groups, and unlock the full WoodX experience."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="wx-btn wx-btn-ghost"
            style={{ padding: "6px 8px" }}
            data-testid="wx-auth-close"
            aria-label="Close"
          >
            <XIcon size={14} />
          </button>
        </div>

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
            style={{ width: "100%", justifyContent: "center" }}
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
              marginTop: 10,
            }}
          >
            Encrypted. Private. No spam.
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
  { id: "chats",   label: "Chats",        icon: MessageSquare },
  { id: "groups",  label: "Groups",       icon: Users },
  { id: "contacts",label: "Contacts",     icon: ContactIcon },
  { id: "wallet",  label: "Wallet",       icon: WalletIcon,  soon: true },
  { id: "news",    label: "Market / News",icon: Newspaper,   soon: true },
  { id: "eon",     label: "EON",          icon: Sparkles,    soon: true },
];

const Sidebar = ({ view, setView, user, theme, toggleTheme, onSignOut, openAuth, mobileOpen, setMobileOpen }) => (
  <aside className={`wx-side ${mobileOpen ? "is-open" : ""}`} data-testid="wx-sidebar">
    <div className="wx-brand">
      <WxLogo />
      <div>
        <div className="wx-brand-name">WoodX</div>
        <div className="wx-brand-tag">Encrypted messaging</div>
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
        {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
        {theme === "dark" ? "Dark mode" : "Light mode"}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--wx-fg-quiet)" }}>
          Toggle
        </span>
      </button>

      {user ? (
        <>
          <div style={{ padding: "0 6px" }}>
            <div style={{ color: "var(--wx-fg)", fontWeight: 500 }}>
              {user.first_name || user.username || user.email}
            </div>
            <div style={{ fontSize: 11, color: "var(--wx-fg-quiet)" }}>
              @{user.username || user.email?.split("@")[0]}
            </div>
          </div>
          <button type="button" className="wx-btn wx-btn-ghost" onClick={onSignOut} data-testid="wx-signout">
            <LogOut size={13} /> Sign out
          </button>
        </>
      ) : (
        <button type="button" className="wx-btn wx-btn-solid" onClick={() => openAuth()} data-testid="wx-side-signin">
          Sign in to WoodX <ArrowRight size={13} />
        </button>
      )}

      <div className="wx-products">
        <a href="/" data-testid="wx-side-home">Home</a>
        <a href="/eon" data-testid="wx-side-eon">EON ↗</a>
        <a href="https://nxtone.tech" target="_blank" rel="noreferrer noopener" data-testid="wx-side-nxt1">
          <span className="wx-nxt-dot" /> NXT1 ↗
        </a>
      </div>
    </div>
  </aside>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const WoodChat = () => {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem(WX_THEME_KEY) || "light"
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

  // Resume session on load
  useEffect(() => {
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
    eon: "EON Messaging Agent — coming soon.",
  };

  const renderContent = () => {
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
    if (view === "eon") {
      return (
        <ComingSoon
          title="EON Messaging Agent"
          sub="EON for WoodX is coming soon — an AI messaging agent built to help summarize conversations, organize communication, and surface important updates."
          testid="wx-eon-soon"
          Icon={Sparkles}
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
            >
              <Menu size={14} />
            </button>
            <div>
              <div className="wx-page-title">{titleByView[view]}</div>
              <div className="wx-page-sub">{subByView[view]}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
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
          </div>
        </header>

        <section className="wx-content">
          {!user && view !== "wallet" && view !== "news" && view !== "eon" ? (
            <div className="wx-guest-banner" data-testid="wx-guest-banner">
              <Sparkles size={14} />
              You're browsing as a guest. Sign in to message, join groups, and save contacts.
            </div>
          ) : null}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderContent()}
          </div>
          <footer className="wx-foot">
            <div>© {new Date().getFullYear()} Jwood Technologies · WoodX</div>
            <div>
              <a href="/" data-testid="wx-foot-home">Home</a>
              <a href="/eon" data-testid="wx-foot-eon">EON ↗</a>
              <a
                href="https://nxtone.tech"
                target="_blank"
                rel="noreferrer noopener"
                data-testid="wx-foot-nxt1"
              >
                <span className="wx-nxt-dot" /> NXT1 ↗
              </a>
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
