import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Users,
  Radio,
  Newspaper,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  Send,
  Search,
  Plus,
  Pin,
  BellOff,
  Bell,
  Trash2,
  Phone,
  Video,
  Loader2,
  Info,
  Clock,
  Tag,
  Shield,
  ChevronLeft,
  Hash,
  Mail,
  Wallet,
  User as UserIcon,
  Activity,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ArrowDown,
  ArrowUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { wcClient, setWcToken, getWcToken } from "@/lib/wcClient";

const LOGO_URL = "/woodx-mark.png";

// WoodX wordmark — small mark + tight text. Sizes deliberately reduced
// so the brand reads as compact and premium (X / Tesla minimal feel).
const WordMark = ({ size = "sm", className = "" }) => {
  const dim =
    size === "xl"
      ? "h-12 w-12"
      : size === "lg"
      ? "h-9 w-9"
      : "h-7 w-7";
  const txt =
    size === "xl"
      ? "text-2xl"
      : size === "lg"
      ? "text-lg"
      : "text-sm";
  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
    >
      <img
        src={LOGO_URL}
        alt="WoodX"
        className={`${dim} object-contain`}
        draggable={false}
      />
      <span
        className={`${txt} wc-display tracking-tight font-medium text-white leading-none`}
      >
        WoodX
      </span>
    </span>
  );
};

// ---------------------------------------------------------------------------
const fmtTime = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 7)
      return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const initials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const errMsg = (err, fallback = "Something went wrong.") => {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((x) => x.msg || JSON.stringify(x)).join(" ");
  return fallback;
};

// ---------------------------------------------------------------------------
// Auth screen
// ---------------------------------------------------------------------------
const AuthScreen = ({ onAuthed }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : form;
      const { data } = await wcClient.post(`/auth/${mode}`, body);
      setWcToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      toast.error(errMsg(err, "Authentication failed."));
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div
      className="min-h-screen text-white flex items-center justify-center px-6 py-10 wc-auth-bg wc-font"
      data-testid="woodchat-auth"
    >
      <div className="w-full max-w-md relative pb-16">
        <div className="mb-14">
          <WordMark size="lg" />
          <div className="wc-mono text-[10px] tracking-[0.3em] uppercase text-white/40 mt-3">
            Private messaging
          </div>
        </div>
        <h1 className="wc-display text-5xl md:text-6xl text-white leading-[1.05]">
          {mode === "login" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="mt-5 text-[15px] text-white/55 leading-relaxed max-w-sm">
          {mode === "login"
            ? "Sign in to continue to WoodX."
            : "Build private conversations with the people you trust."}
        </p>

        <form onSubmit={submit} className="mt-10 space-y-5" data-testid="woodchat-auth-form">
          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                    First name
                  </Label>
                  <Input
                    value={form.first_name}
                    onChange={set("first_name")}
                    className="wc-input mt-2 h-12 rounded-lg wc-font"
                    required
                    data-testid="wc-auth-first"
                  />
                </div>
                <div>
                  <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                    Last name
                  </Label>
                  <Input
                    value={form.last_name}
                    onChange={set("last_name")}
                    className="wc-input mt-2 h-12 rounded-lg wc-font"
                    required
                    data-testid="wc-auth-last"
                  />
                </div>
              </div>
              <div>
                <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                  Username
                </Label>
                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 wc-mono text-[14px]">
                    @
                  </span>
                  <Input
                    value={form.username}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, ""),
                      })
                    }
                    placeholder="yourname"
                    className="wc-input h-12 rounded-lg wc-font pl-8"
                    minLength={3}
                    maxLength={24}
                    required
                    data-testid="wc-auth-username"
                  />
                </div>
                <p className="text-[11px] text-white/35 wc-mono mt-1.5">
                  3–24 letters, numbers or underscores. People add you by @username.
                </p>
              </div>
            </>
          )}
          <div>
            <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
              Email
            </Label>
            <Input
              type="email"
              value={form.email}
              onChange={set("email")}
              className="wc-input mt-2 h-12 rounded-lg wc-font"
              required
              data-testid="wc-auth-email"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                Password
              </Label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[11px] text-white/45 hover:text-white wc-font"
                  data-testid="wc-forgot"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              type="password"
              value={form.password}
              onChange={set("password")}
              className="wc-input mt-2 h-12 rounded-lg wc-font"
              minLength={6}
              required
              data-testid="wc-auth-password"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-lg mt-3 wc-font font-medium text-[15px] wc-shine"
            data-testid="wc-auth-submit"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-7 text-[14px] text-white/55 hover:text-white transition-colors"
          data-testid="wc-auth-toggle"
        >
          {mode === "login"
            ? "New to WoodX? Create an account."
            : "Already have an account? Sign in."}
        </button>
      </div>
      <div className="absolute bottom-5 inset-x-0 px-6">
        <div className="max-w-md mx-auto flex items-center justify-between text-[10px] wc-mono uppercase tracking-[0.28em] text-white/30">
          <span>Powered by Jwood Technologies</span>
          <div className="flex items-center gap-3">
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------
const ForgotPasswordDialog = ({ open, onClose }) => {
  const [step, setStep] = useState("request"); // request | reset | done
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("request");
      setEmail("");
      setToken("");
      setNewPw("");
    }
  }, [open]);

  const requestToken = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const { data } = await wcClient.post("/auth/forgot", { email });
      if (data.reset_token) {
        setToken(data.reset_token);
        toast.success("Reset code generated. Use it below.");
      } else {
        toast.success(
          "If an account exists for that email, a reset code has been issued. Contact support to retrieve it."
        );
      }
      setStep("reset");
    } catch (err) {
      toast.error(errMsg(err, "Could not start reset."));
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!token || !newPw) return;
    setBusy(true);
    try {
      await wcClient.post("/auth/reset", {
        token,
        new_password: newPw,
      });
      setStep("done");
    } catch (err) {
      toast.error(errMsg(err, "Reset failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-[#0a0c14] border-white/10 text-white wc-font"
        data-testid="wc-forgot-dialog"
      >
        <DialogHeader>
          <DialogTitle className="wc-display text-[22px]">
            Reset password
          </DialogTitle>
          <DialogDescription className="text-white/55 text-xs">
            {step === "request"
              ? "Enter the email tied to your WoodChat account."
              : step === "reset"
              ? "Paste your reset code and choose a new password."
              : "Password updated. You can sign in now."}
          </DialogDescription>
        </DialogHeader>
        {step === "request" && (
          <div className="space-y-4">
            <div>
              <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                Email
              </Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="wc-input mt-2 h-11"
                data-testid="wc-forgot-email"
              />
            </div>
          </div>
        )}
        {step === "reset" && (
          <div className="space-y-4">
            <div>
              <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                Reset code
              </Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="wc-input mt-2 h-11 wc-mono text-[12px]"
                data-testid="wc-forgot-token"
              />
            </div>
            <div>
              <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
                New password
              </Label>
              <Input
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                type="password"
                minLength={6}
                className="wc-input mt-2 h-11"
                data-testid="wc-forgot-newpw"
              />
            </div>
          </div>
        )}
        {step === "done" && (
          <p className="text-emerald-300 text-sm">
            ✓ Password updated. Close this dialog and sign in.
          </p>
        )}
        <DialogFooter>
          {step === "request" && (
            <Button
              onClick={requestToken}
              disabled={busy || !email}
              className="bg-white text-black hover:bg-white/90"
              data-testid="wc-forgot-submit"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          )}
          {step === "reset" && (
            <Button
              onClick={confirmReset}
              disabled={busy || !token || !newPw}
              className="bg-white text-black hover:bg-white/90"
              data-testid="wc-forgot-confirm"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
            </Button>
          )}
          {step === "done" && (
            <Button
              onClick={onClose}
              className="bg-white text-black hover:bg-white/90"
              data-testid="wc-forgot-close"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Primary shell
// ---------------------------------------------------------------------------
const NAV = [
  { key: "chats", label: "Chats", icon: MessageSquare },
  { key: "markets", label: "Markets", icon: Activity },
  { key: "wallet", label: "Wallet", icon: Wallet },
  { key: "profile", label: "Profile", icon: UserIcon },
];

const EonOrb = ({ size = 36 }) => (
  <div
    className="relative shrink-0"
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.15) 38%, transparent 72%), radial-gradient(circle at 60% 70%, rgba(125,169,255,0.7) 0%, transparent 55%)",
        boxShadow:
          "0 0 14px rgba(125,169,255,0.5), inset 0 -3px 8px rgba(0,0,0,0.45)",
        animation: "wc-orb-core 5s ease-in-out infinite",
      }}
    />
    <div
      className="absolute inset-[-12%] rounded-full pointer-events-none"
      style={{
        border: "1px solid rgba(125,169,255,0.18)",
        animation: "wc-orb-spin 10s linear infinite",
      }}
    />
  </div>
);

const Avatar = ({ name, url, size = 40 }) => (
  <div
    className="shrink-0 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 grid place-items-center overflow-hidden"
    style={{ width: size, height: size }}
  >
    {url ? (
      <img src={url} alt="" className="w-full h-full object-cover" />
    ) : (
      <span className="text-white/80 font-medium" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </span>
    )}
  </div>
);

const Shell = ({ user, setUser }) => {
  const [section, setSection] = useState("chats");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatQuery, setChatQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      const { data } = await wcClient.get("/chats");
      setChats(data);
    } catch (err) {
      toast.error(errMsg(err, "Could not load chats."));
    }
  }, []);

  useEffect(() => {
    loadChats();
    const t = setInterval(loadChats, 8000);
    return () => clearInterval(t);
  }, [loadChats]);

  const filteredChats = useMemo(() => {
    let list = chats;
    if (chatQuery.trim()) {
      const q = chatQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.last_message_text?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [chats, chatQuery]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId),
    [chats, activeChatId]
  );

  const signOut = () => {
    setWcToken(null);
    setUser(null);
  };

  const isChats = section === "chats";
  const [eonOpen, setEonOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Avatar / username header for the mobile drawer
  const handle = user.username ? `@${user.username}` : user.email;

  return (
    <div
      className="min-h-screen text-white flex flex-col md:flex-row wc-bg wc-font"
      data-testid="woodchat-shell"
    >
      {/* Mobile slide-out drawer (avatar trigger lives in ChatList header) */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          data-testid="wc-drawer-root"
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[78%] max-w-[320px] bg-[#0a0c12] border-r border-white/[0.06] flex flex-col"
            style={{ animation: "wc-slide-in 240ms ease-out" }}
            data-testid="wc-drawer"
          >
            <div className="px-5 pt-7 pb-5 border-b border-white/[0.06]">
              <Avatar
                name={`${user.first_name} ${user.last_name}`}
                url={user.avatar_url}
                size={52}
              />
              <div className="text-white text-[18px] font-medium mt-3">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-[rgb(var(--wc-accent))] text-[13px] wc-mono">
                {handle}
              </div>
            </div>
            <nav className="flex-1 py-3 overflow-y-auto">
              {[
                { k: "chats", label: "Chats", Icon: MessageSquare },
                { k: "markets", label: "Markets", Icon: Activity },
                { k: "wallet", label: "Wallet", Icon: Wallet },
                { k: "profile", label: "Profile", Icon: UserIcon },
              ].map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => {
                    setSection(k);
                    setActiveChatId(null);
                    setDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 text-[15.5px] ${
                    section === k
                      ? "text-white bg-white/[0.04]"
                      : "text-white/75 hover:bg-white/[0.03]"
                  }`}
                  data-testid={`wc-drawer-${k}`}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setEonOpen(true);
                  setDrawerOpen(false);
                }}
                className="w-full flex items-center gap-4 px-5 py-3.5 text-[15.5px] text-white/75 hover:bg-white/[0.03]"
                data-testid="wc-drawer-eon"
              >
                <EonOrb size={20} />
                <span>EON</span>
                <span className="ml-auto text-[8.5px] wc-mono bg-[rgb(var(--wc-accent))] text-black px-1.5 py-0.5 rounded">
                  BETA
                </span>
              </button>
            </nav>
            <div className="border-t border-white/[0.06]">
              <button
                onClick={() => {
                  signOut();
                  setDrawerOpen(false);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 text-[15px] text-white/65 hover:bg-white/[0.03]"
                data-testid="wc-drawer-signout"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
                Sign out
              </button>
              <a
                href="/privacy"
                className="w-full flex items-center gap-4 px-5 py-3 text-[12.5px] wc-mono uppercase tracking-[0.2em] text-white/40 hover:text-white"
              >
                Privacy · Terms
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop side nav (mobile has bottom nav only — no top header) */}
      <aside className="hidden md:flex w-[84px] flex-col items-center py-6 wc-sidebar shrink-0 relative z-10">
        <img
          src={LOGO_URL}
          alt="WoodX"
          className="h-9 w-9 object-contain mb-8 select-none"
          draggable={false}
        />
        <nav className="flex flex-col gap-2 flex-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = section === n.key;
            return (
              <button
                key={n.key}
                onClick={() => {
                  setSection(n.key);
                  setActiveChatId(null);
                }}
                title={n.label}
                className={`relative w-12 h-12 rounded-2xl grid place-items-center transition-all ${
                  active
                    ? "bg-white text-black shadow-[0_8px_24px_-10px_rgba(255,255,255,0.35)]"
                    : "text-white/55 hover:text-white hover:bg-white/5"
                }`}
                data-testid={`wc-nav-${n.key}`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
              </button>
            );
          })}
          {/* EON launcher — always visible */}
          <button
            onClick={() => setEonOpen(true)}
            title="EON · Powered by Wood AI"
            className="relative w-12 h-12 rounded-2xl grid place-items-center hover:bg-white/5 transition-all mt-2"
            data-testid="wc-nav-eon"
          >
            <EonOrb size={26} />
            <span className="absolute -top-1 -right-1 text-[8px] wc-mono bg-[rgb(var(--wc-accent))] text-black px-1 rounded">
              BETA
            </span>
          </button>
        </nav>
        <button
          onClick={signOut}
          title="Sign out"
          className="w-12 h-12 rounded-2xl grid place-items-center text-white/50 hover:text-white hover:bg-white/5"
          data-testid="wc-signout"
        >
          <LogOut className="h-[17px] w-[17px]" strokeWidth={1.75} />
        </button>
      </aside>

      {/* Middle panel */}
      <div
        className={`flex-1 flex min-w-0 relative z-10 ${
          isChats && activeChatId ? "max-md:hidden md:flex" : ""
        }`}
      >
        {isChats ? (
          <ChatList
            chats={filteredChats}
            activeId={activeChatId}
            onSelect={setActiveChatId}
            query={chatQuery}
            setQuery={setChatQuery}
            onNewChat={() => setNewChatOpen(true)}
            user={user}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
        ) : section === "markets" ? (
          <MarketsView user={user} onOpenDrawer={() => setDrawerOpen(true)} />
        ) : section === "wallet" ? (
          <WalletView user={user} onOpenDrawer={() => setDrawerOpen(true)} />
        ) : (
          <ProfileView
            user={user}
            setUser={setUser}
            onSignOut={signOut}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
        )}
      </div>

      {/* Right conversation pane */}
      {isChats && (
        <ChatPane
          chat={activeChat}
          user={user}
          onBack={() => setActiveChatId(null)}
          onChatChanged={loadChats}
        />
      )}

      {/* Mobile bottom nav — hidden when a chat is open on mobile.
          WX logo sits dead-center as a brand mark; nav items split 2/2
          either side. */}
      {!(isChats && activeChatId) && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 wc-glass flex items-center justify-around py-2 z-30 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
          data-testid="wc-mobile-nav"
        >
          {NAV.map((n, i) => {
            const Icon = n.icon;
            const active = section === n.key;
            const button = (
              <button
                key={n.key}
                onClick={() => {
                  setSection(n.key);
                  setActiveChatId(null);
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px] rounded-xl transition-colors ${
                  active ? "text-white" : "text-white/45"
                }`}
                data-testid={`wc-mobnav-${n.key}`}
              >
                <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
                <span className="text-[10px] wc-mono uppercase tracking-wider">
                  {n.label}
                </span>
              </button>
            );
            // Insert centered WX brand mark between item 1 and item 2
            if (i === 2) {
              return (
                <span key="wc-brand-center" className="contents">
                  <div
                    className="flex items-center justify-center px-2"
                    aria-hidden="true"
                    data-testid="wc-mobnav-brand"
                  >
                    <img
                      src={LOGO_URL}
                      alt=""
                      className="h-7 w-7 object-contain select-none opacity-90"
                      draggable={false}
                    />
                  </div>
                  {button}
                </span>
              );
            }
            return button;
          })}
        </nav>
      )}

      {/* Floating EON quick-access — bottom-right above mobile nav */}
      {!(isChats && activeChatId) && !eonOpen && (
        <button
          onClick={() => setEonOpen(true)}
          className="md:hidden fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 h-12 w-12 rounded-full bg-black/60 border border-white/10 backdrop-blur grid place-items-center hover:scale-105 transition-transform"
          data-testid="wc-floating-eon"
          aria-label="Open EON"
        >
          <EonOrb size={28} />
        </button>
      )}

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onCreated={(chat) => {
          setNewChatOpen(false);
          loadChats();
          setSection("chats");
          setActiveChatId(chat.id);
        }}
      />
      <EonDialog open={eonOpen} user={user} onClose={() => setEonOpen(false)} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chat list (middle column for direct/group/room)
// ---------------------------------------------------------------------------
const ChatList = ({
  chats,
  activeId,
  onSelect,
  query,
  setQuery,
  onNewChat,
  user,
  onOpenDrawer,
}) => {
  return (
    <div
      className="w-full md:w-[340px] lg:w-[380px] wc-list flex flex-col shrink-0 border-r border-white/[0.04]"
      data-testid="wc-chat-list"
    >
      <header className="px-5 md:px-6 pt-6 md:pt-7 pb-4 flex items-center gap-3">
        {/* Mobile: avatar opens drawer; Desktop: hidden (sidebar handles it) */}
        {onOpenDrawer && (
          <button
            onClick={onOpenDrawer}
            className="md:hidden h-9 w-9 rounded-full overflow-hidden border border-white/10 grid place-items-center hover:border-white/25 shrink-0"
            data-testid="wc-open-drawer"
            aria-label="Menu"
          >
            <Avatar
              name={`${user?.first_name || ""} ${user?.last_name || ""}`}
              url={user?.avatar_url}
              size={36}
            />
          </button>
        )}
        <h1 className="wc-display text-[30px] md:text-[34px] leading-none text-white flex-1">
          Chats
        </h1>
        <Button
          size="sm"
          onClick={onNewChat}
          className="bg-white text-black hover:bg-white/90 h-9 rounded-full px-4 wc-font text-[13px] font-medium"
          data-testid="wc-newchat-btn"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
          New
        </Button>
      </header>
      <div className="px-6 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="wc-input h-10 pl-10 rounded-xl wc-font text-[14px]"
            data-testid="wc-search"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
        {chats.length === 0 ? (
          <div className="px-6 py-14 text-center text-white/40 text-sm">
            No chats yet. Tap{" "}
            <span className="text-white">New</span> to start one.
          </div>
        ) : (
          chats.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-5 py-3.5 flex items-center gap-3 transition-colors ${
                activeId === c.id
                  ? "bg-white/[0.05]"
                  : "hover:bg-white/[0.025]"
              }`}
              data-testid={`wc-chat-${c.id}`}
            >
              <Avatar name={c.name} url={c.avatar_url} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-white truncate font-medium text-[15px] flex-1">
                    {c.name}
                  </div>
                  {c.pinned && <Pin className="h-3 w-3 text-white/45" />}
                  {c.muted && <BellOff className="h-3 w-3 text-white/35" />}
                  {c.disappearing_seconds > 0 && (
                    <Clock className="h-3 w-3 text-emerald-300/70" />
                  )}
                  <div className="text-[10.5px] wc-mono text-white/35 shrink-0">
                    {fmtTime(c.last_message_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-[13px] text-white/50 truncate flex-1">
                    {c.last_message_text || (
                      <span className="italic text-white/25">
                        No messages yet
                      </span>
                    )}
                  </div>
                  {c.unread > 0 && (
                    <span
                      className="bg-white text-black text-[10.5px] wc-mono font-medium rounded-full h-5 min-w-[20px] px-1.5 grid place-items-center"
                      data-testid={`wc-unread-${c.id}`}
                    >
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.tags?.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {c.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[9.5px] wc-mono bg-white/[0.04] text-white/55 px-2 py-0.5 rounded-full border border-white/[0.06]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chat pane (right column)
// ---------------------------------------------------------------------------
const ChatPane = ({ chat, user, onBack, onChatChanged }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    if (!chat) return;
    try {
      const { data } = await wcClient.get(`/chats/${chat.id}/messages`);
      setMessages(data);
    } catch {
      /* swallow */
    }
  }, [chat]);

  useEffect(() => {
    if (!chat) return;
    load();
    const t = setInterval(load, 3500);
    return () => clearInterval(t);
  }, [chat, load]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  if (!chat) {
    return (
      <section className="hidden md:flex flex-1 items-center justify-center text-white/45">
        <div className="text-center max-w-sm px-8">
          <Shield className="h-7 w-7 text-white/30 mx-auto mb-3" />
          <div className="text-sm">
            Select a conversation or start a new one. Privacy-focused messaging
            tools by Jwood Technologies.
          </div>
        </div>
      </section>
    );
  }

  const send = async (e) => {
    e?.preventDefault?.();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await wcClient.post(`/chats/${chat.id}/messages`, { text: t });
      setText("");
      load();
      onChatChanged?.();
    } catch (err) {
      toast.error(errMsg(err, "Could not send message."));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id) => {
    try {
      await wcClient.delete(`/messages/${id}`);
      load();
    } catch (err) {
      toast.error(errMsg(err, "Delete failed."));
    }
  };

  return (
    <section className="flex-1 flex flex-col min-w-0 wc-pane">
      <header className="border-b border-white/[0.05] px-4 md:px-6 py-3 flex items-center gap-3 wc-glass">
        <button
          onClick={onBack}
          className="md:hidden h-9 w-9 rounded-full grid place-items-center hover:bg-white/5"
          data-testid="wc-back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Avatar name={chat.name} url={chat.avatar_url} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate text-[15.5px]">{chat.name}</div>
          <div className="text-[10.5px] wc-mono uppercase tracking-[0.2em] text-white/40 mt-0.5">
            {chat.type === "direct"
              ? "Direct"
              : chat.type === "group"
              ? `${chat.members?.length || 0} members`
              : "Room"}
            {chat.disappearing_seconds > 0 && (
              <span className="ml-2 text-emerald-300/80">
                · self-destruct {chat.disappearing_seconds}s
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => toast.info("Calling coming soon.")}
          className="h-9 w-9 rounded-full grid place-items-center hover:bg-white/5 text-white/65"
          title="Voice call"
          data-testid="wc-voice-call"
        >
          <Phone className="h-[17px] w-[17px]" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => toast.info("Calling coming soon.")}
          className="h-9 w-9 rounded-full grid place-items-center hover:bg-white/5 text-white/65"
          title="Video call"
          data-testid="wc-video-call"
        >
          <Video className="h-[17px] w-[17px]" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setDetailsOpen(true)}
          className="h-9 w-9 rounded-full grid place-items-center hover:bg-white/5 text-white/65"
          title="Chat info"
          data-testid="wc-chat-info"
        >
          <Info className="h-[17px] w-[17px]" strokeWidth={1.75} />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-1.5"
        data-testid="wc-messages"
      >
        {messages.length === 0 && (
          <div className="text-center text-white/35 text-sm mt-14 wc-font">
            No messages yet. Say hi.
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === user.id;
          const prev = messages[i - 1];
          const showSender =
            !mine &&
            chat.type !== "direct" &&
            (!prev || prev.sender_id !== m.sender_id);
          return (
            <div
              key={m.id}
              className={`group flex ${
                mine ? "justify-end" : "justify-start"
              } gap-2`}
              data-testid={`wc-msg-${m.id}`}
            >
              {!mine && chat.type !== "direct" && (
                <div className="w-8 shrink-0">
                  {showSender && (
                    <Avatar
                      name={m.sender_name}
                      url={m.sender_avatar}
                      size={30}
                    />
                  )}
                </div>
              )}
              <div className="max-w-[82%] md:max-w-[62%]">
                {showSender && (
                  <div className="text-[11px] wc-mono text-white/45 mb-1 ml-1">
                    {m.sender_name}
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed wc-font ${
                    mine
                      ? "wc-bubble-me rounded-br-md"
                      : "wc-bubble-them rounded-bl-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {m.text}
                  </div>
                  <div
                    className={`mt-1 text-[10px] wc-mono ${
                      mine ? "text-black/45" : "text-white/35"
                    } text-right`}
                  >
                    {fmtTime(m.created_at)}
                  </div>
                </div>
                {mine && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] wc-mono uppercase tracking-wide text-white/35 hover:text-red-400 mt-1 block ml-auto transition-opacity"
                    data-testid={`wc-delete-msg-${m.id}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={send}
        className="border-t border-white/[0.05] px-4 md:px-6 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] flex items-end gap-2.5 wc-glass"
        data-testid="wc-compose"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
          className="wc-input min-h-[44px] max-h-40 resize-none py-3 rounded-2xl wc-font text-[14.5px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          data-testid="wc-compose-input"
        />
        <Button
          type="submit"
          disabled={!text.trim() || sending}
          className="bg-white text-black hover:bg-white/90 h-11 w-11 p-0 rounded-full shrink-0 shadow-[0_10px_30px_-14px_rgba(255,255,255,0.35)]"
          data-testid="wc-send"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2} />
          )}
        </Button>
      </form>

      <ChatDetailsDialog
        open={detailsOpen}
        chat={chat}
        onClose={() => setDetailsOpen(false)}
        onChanged={() => {
          onChatChanged?.();
        }}
        onDeleted={() => {
          onBack?.();
          onChatChanged?.();
        }}
      />
    </section>
  );
};

// ---------------------------------------------------------------------------
// Chat details / settings dialog
// ---------------------------------------------------------------------------
const ChatDetailsDialog = ({ open, chat, onClose, onChanged, onDeleted }) => {
  const [name, setName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [disappear, setDisappear] = useState(0);
  const [addEmail, setAddEmail] = useState("");

  useEffect(() => {
    if (chat) {
      setName(chat.name || "");
      setTagsInput((chat.tags || []).join(", "));
      setDisappear(chat.disappearing_seconds || 0);
    }
  }, [chat]);

  if (!chat) return null;

  const save = async () => {
    try {
      await wcClient.patch(`/chats/${chat.id}`, {
        name: chat.type === "direct" ? undefined : name,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        disappearing_seconds: Number(disappear) || 0,
      });
      toast.success("Saved.");
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(errMsg(err, "Save failed."));
    }
  };

  const toggle = async (field, value) => {
    try {
      await wcClient.patch(`/chats/${chat.id}`, { [field]: value });
      onChanged?.();
    } catch (err) {
      toast.error(errMsg(err, "Update failed."));
    }
  };

  const addMember = async () => {
    if (!addEmail.trim()) return;
    try {
      await wcClient.post(`/chats/${chat.id}/members`, {
        email: addEmail.trim(),
      });
      toast.success("Member added.");
      setAddEmail("");
      onChanged?.();
    } catch (err) {
      toast.error(errMsg(err, "Could not add member."));
    }
  };

  const del = async () => {
    try {
      await wcClient.delete(`/chats/${chat.id}`);
      toast.success("Chat deleted.");
      onDeleted?.();
    } catch (err) {
      toast.error(errMsg(err, "Delete failed."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-[#0a0c14] border-white/10 text-white"
        data-testid="wc-chat-details"
      >
        <DialogHeader>
          <DialogTitle>Chat details</DialogTitle>
          <DialogDescription className="text-white/55 text-xs">
            Controls for this conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {chat.type !== "direct" && (
            <div>
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-premium mt-2 h-10"
                data-testid="wc-details-name"
              />
            </div>
          )}
          <div>
            <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
              <Tag className="h-3 w-3 inline mr-1.5" />
              Tags (comma-separated)
            </Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="input-premium mt-2 h-10"
              placeholder="family, work, urgent"
              data-testid="wc-details-tags"
            />
          </div>
          <div>
            <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
              <Clock className="h-3 w-3 inline mr-1.5" />
              Disappearing messages (seconds, 0 = off)
            </Label>
            <Input
              type="number"
              min="0"
              value={disappear}
              onChange={(e) => setDisappear(e.target.value)}
              className="input-premium mt-2 h-10"
              data-testid="wc-details-disappear"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-transparent text-white hover:bg-white/5"
              onClick={() => toggle("pinned", !chat.pinned)}
              data-testid="wc-details-pin"
            >
              <Pin className="h-3 w-3 mr-1.5" />
              {chat.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-transparent text-white hover:bg-white/5"
              onClick={() => toggle("muted", !chat.muted)}
              data-testid="wc-details-mute"
            >
              {chat.muted ? (
                <Bell className="h-3 w-3 mr-1.5" />
              ) : (
                <BellOff className="h-3 w-3 mr-1.5" />
              )}
              {chat.muted ? "Unmute" : "Mute"}
            </Button>
          </div>
          {chat.type !== "direct" && (
            <div>
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                <Mail className="h-3 w-3 inline mr-1.5" />
                Add member by email
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="person@example.com"
                  className="input-premium h-10 flex-1"
                  data-testid="wc-details-add-email"
                />
                <Button
                  onClick={addMember}
                  size="sm"
                  className="bg-white text-black hover:bg-white/90 h-10"
                  data-testid="wc-details-add-member"
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 pt-3">
          <Button
            variant="outline"
            onClick={del}
            className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10"
            data-testid="wc-details-delete-chat"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete chat
          </Button>
          <Button
            onClick={save}
            className="bg-white text-black hover:bg-white/90"
            data-testid="wc-details-save"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// New chat dialog
// ---------------------------------------------------------------------------
const NewChatDialog = ({ open, onClose, onCreated }) => {
  const [type, setType] = useState("direct");
  const [name, setName] = useState("");
  const [usernames, setUsernames] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setType("direct");
      setName("");
      setUsernames("");
    }
  }, [open]);

  const create = async () => {
    setLoading(true);
    try {
      const member_usernames = usernames
        .split(/[,\s]+/)
        .map((u) => u.trim().replace(/^@/, ""))
        .filter(Boolean);
      const { data } = await wcClient.post("/chats", {
        type,
        name: type === "direct" ? null : name,
        member_usernames,
      });
      onCreated(data);
    } catch (err) {
      toast.error(errMsg(err, "Could not create chat."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-[#0a0c14] border-white/10 text-white wc-font"
        data-testid="wc-newchat-dialog"
      >
        <DialogHeader>
          <DialogTitle className="wc-display text-[22px]">New conversation</DialogTitle>
          <DialogDescription className="text-white/55 text-xs">
            Send a direct message or start a group. Add people by @username.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "direct", label: "Direct" },
              { k: "group", label: "Group" },
              { k: "room", label: "Room" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setType(t.k)}
                className={`h-10 rounded-lg text-[13px] wc-mono uppercase tracking-wider transition-colors ${
                  type === t.k
                    ? "bg-white text-black"
                    : "bg-white/[0.04] text-white/65 border border-white/[0.08] hover:bg-white/[0.08]"
                }`}
                data-testid={`wc-newchat-type-${t.k}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {type !== "direct" && (
            <div>
              <Label className="wc-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
                {type === "group" ? "Group" : "Room"} name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="wc-input mt-2 h-10 rounded-lg"
                placeholder={type === "group" ? "Family" : "# general"}
                required
                data-testid="wc-newchat-name"
              />
            </div>
          )}
          <div>
            <Label className="wc-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              {type === "direct" ? "Recipient" : "Members"} · @username
            </Label>
            <Textarea
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              className="wc-input mt-2 min-h-[72px] rounded-lg"
              placeholder={type === "direct" ? "@alice" : "@alice, @bob"}
              data-testid="wc-newchat-usernames"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/15 bg-transparent text-white hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={
              loading ||
              !usernames.trim() ||
              (type !== "direct" && !name.trim())
            }
            className="bg-white text-black hover:bg-white/90 wc-shine"
            data-testid="wc-newchat-create"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Markets / Wallet / Profile stubs (Phase 2+)
// ---------------------------------------------------------------------------
const MobileMenuButton = ({ user, onClick }) => (
  <button
    onClick={onClick}
    className="md:hidden h-10 w-10 rounded-full overflow-hidden border border-white/10 grid place-items-center hover:border-white/25 shrink-0 mb-5"
    data-testid="wc-mobile-menu"
    aria-label="Menu"
  >
    <Avatar
      name={`${user?.first_name || ""} ${user?.last_name || ""}`}
      url={user?.avatar_url}
      size={40}
    />
  </button>
);

const Sparkline = ({ data, up }) => {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = up ? "rgb(110, 231, 183)" : "rgb(252, 165, 165)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-9 mt-3"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const MarketsView = ({ user, onOpenDrawer }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await wcClient.get("/markets");
        if (!alive) return;
        setItems(data.items || []);
        setError(data.error || null);
      } catch {
        setError("Markets unavailable.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const fmtPrice = (p) => {
    if (p == null) return "—";
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    return `$${p.toExponential(2)}`;
  };

  return (
    <section
      className="flex-1 overflow-y-auto px-6 md:px-10 py-8 pb-28 md:pb-10 max-w-5xl mx-auto w-full"
      data-testid="wc-markets"
    >
      <MobileMenuButton user={user} onClick={onOpenDrawer} />
      <h1 className="wc-display text-[40px] md:text-[52px] text-white leading-none">
        Markets
      </h1>
      <p className="text-white/50 text-[14.5px] mt-4 mb-8 max-w-xl">
        Live crypto prices · 24h change · 7d trend
      </p>
      {loading && items.length === 0 ? (
        <div className="text-white/40 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-white/55 text-sm">{error || "No data."}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => {
            const up = (t.change_24h_pct || 0) >= 0;
            return (
              <div
                key={t.id}
                className="wc-glass rounded-2xl p-5 hover:bg-white/[0.04] transition-colors"
                data-testid={`wc-market-${t.symbol}`}
              >
                <div className="flex items-center gap-3">
                  {t.image && (
                    <img
                      src={t.image}
                      alt={t.name}
                      className="h-9 w-9 rounded-full"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="wc-display text-[20px] text-white leading-none">
                      {t.symbol}
                    </div>
                    <div className="text-[12px] text-white/45 truncate">
                      {t.name}
                    </div>
                  </div>
                  <div
                    className={`text-[12.5px] wc-mono ${
                      up ? "text-emerald-300" : "text-red-300"
                    } flex items-center gap-1`}
                  >
                    {up ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {(t.change_24h_pct ?? 0).toFixed(2)}%
                  </div>
                </div>
                <div className="flex items-baseline justify-between mt-3">
                  <div className="wc-display text-white text-[22px] tabular-nums">
                    {fmtPrice(t.price)}
                  </div>
                </div>
                <Sparkline data={t.sparkline} up={up} />
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-6 text-center text-[10.5px] wc-mono uppercase tracking-[0.28em] text-white/35">
        Data · CoinGecko · refreshes every 60s
      </div>
    </section>
  );
};

const WalletView = ({ user, onOpenDrawer }) => (
  <section
    className="flex-1 overflow-y-auto px-6 md:px-10 py-8 pb-28 md:pb-10 max-w-3xl mx-auto w-full"
    data-testid="wc-wallet"
  >
    <MobileMenuButton user={user} onClick={onOpenDrawer} />
    <h1 className="wc-display text-[40px] md:text-[52px] text-white leading-none">
      Wallet
    </h1>
    <p className="text-white/50 text-[14.5px] mt-4 mb-8 max-w-xl">
      Send money instantly, inside any chat.
    </p>
    <div className="wc-glass rounded-3xl p-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: "radial-gradient(ellipse at top right, rgba(125,169,255,0.25), transparent 60%)" }} />
      <div className="relative">
        <div className="wc-mono text-[10.5px] uppercase tracking-[0.28em] text-white/50">
          Current balance
        </div>
        <div className="wc-display text-[56px] md:text-[72px] text-white leading-none mt-3">
          $0.00
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => toast.info("Payments launch in Phase 2 — Stripe integration coming soon.")}
            className="bg-white text-black hover:bg-white/90 h-11 rounded-full px-5 wc-shine"
            data-testid="wc-wallet-add"
          >
            <ArrowDown className="h-4 w-4 mr-1.5" /> Add money
          </Button>
          <Button
            onClick={() => toast.info("Withdrawals launch in Phase 2.")}
            variant="outline"
            className="border-white/15 bg-transparent text-white hover:bg-white/5 h-11 rounded-full px-5"
            data-testid="wc-wallet-withdraw"
          >
            <ArrowUp className="h-4 w-4 mr-1.5" /> Withdraw
          </Button>
        </div>
      </div>
    </div>
    <div className="mt-8">
      <h2 className="wc-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
        Activity
      </h2>
      <div className="wc-glass rounded-2xl p-10 text-center">
        <CreditCard className="h-6 w-6 text-white/35 mx-auto" />
        <div className="text-white/60 mt-3 text-sm">No transactions yet.</div>
        <div className="text-white/35 text-[12px] mt-1">
          History will appear here once payments are live.
        </div>
      </div>
    </div>
  </section>
);

const ProfileView = ({ user, setUser, onSignOut, onOpenDrawer }) => {
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [avatar, setAvatar] = useState(user.avatar_url || "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await wcClient.patch("/me", {
        first_name: first,
        last_name: last,
        avatar_url: avatar || null,
      });
      setUser(data);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(errMsg(err, "Could not update profile."));
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    if (!cur || !next) return;
    try {
      await wcClient.post("/me/password", {
        current_password: cur,
        new_password: next,
      });
      setCur("");
      setNext("");
      toast.success("Password changed.");
    } catch (err) {
      toast.error(errMsg(err, "Could not change password."));
    }
  };

  return (
    <section
      className="flex-1 overflow-y-auto px-6 md:px-10 py-8 pb-28 md:pb-10 max-w-2xl mx-auto w-full"
      data-testid="wc-profile"
    >
      <MobileMenuButton user={user} onClick={onOpenDrawer} />
      <h1 className="wc-display text-[40px] md:text-[52px] text-white leading-none">
        Profile
      </h1>
      <p className="text-white/50 text-[14.5px] mt-4 mb-8">
        Your public identity on WoodX.
      </p>
      <div className="wc-glass rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={`${first} ${last}`} url={avatar} size={68} />
          <div>
            <div className="text-white text-lg">
              {first} {last}
            </div>
            <div className="text-[rgb(var(--wc-accent))] text-[13px] wc-mono">
              @{user.username}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="wc-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              First name
            </Label>
            <Input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="wc-input mt-2 h-11"
              data-testid="wc-profile-first"
            />
          </div>
          <div>
            <Label className="wc-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              Last name
            </Label>
            <Input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="wc-input mt-2 h-11"
              data-testid="wc-profile-last"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="wc-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              Profile photo URL
            </Label>
            <Input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="wc-input mt-2 h-11"
              placeholder="https://…"
              data-testid="wc-profile-avatar"
            />
          </div>
        </div>
        <Button
          onClick={saveProfile}
          disabled={saving}
          className="bg-white text-black hover:bg-white/90 mt-5 wc-shine"
          data-testid="wc-profile-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>

      <div className="wc-glass rounded-2xl p-5 md:p-6 mt-5">
        <h2 className="text-white text-base mb-4 wc-font">Change password</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Input
            type="password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            placeholder="Current"
            className="wc-input h-11"
            data-testid="wc-profile-cur-pw"
          />
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="New"
            className="wc-input h-11"
            data-testid="wc-profile-new-pw"
          />
        </div>
        <Button
          onClick={changePw}
          disabled={!cur || !next}
          variant="outline"
          className="border-white/15 bg-transparent text-white hover:bg-white/5 mt-4"
          data-testid="wc-profile-change-pw"
        >
          Update password
        </Button>
      </div>

      <div className="text-center pt-8">
        <button
          onClick={onSignOut}
          className="text-white/55 hover:text-white text-sm wc-mono uppercase tracking-[0.25em]"
          data-testid="wc-profile-signout"
        >
          <LogOut className="h-3.5 w-3.5 inline mr-1.5" />
          Sign out
        </button>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// EON dialog — full-bleed Grok-style chat overlay (NOT a small popup card)
// ---------------------------------------------------------------------------
const EonDialog = ({ open, user, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, busy]);

  if (!open) return null;

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setMessages((m) => [...m, { role: "me", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await wcClient.post("/ai/chat", { message: t });
      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: errMsg(err, "EON is unavailable right now.") },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col wc-font"
      data-testid="wc-eon-dialog"
    >
      {/* Pure black + starfield — no radial gradient, no glow */}
      <div className="absolute inset-0 bg-black" />
      <div className="wc-starfield">
        <div className="wc-stars-mid" />
      </div>

      {/* Header — slim */}
      <header className="relative z-10 flex items-center justify-between px-5 md:px-8 pt-5 pb-3">
        <div className="wc-mono text-[10.5px] uppercase tracking-[0.32em] text-[rgb(var(--wc-accent))]">
          EON · BETA
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full grid place-items-center text-white/65 hover:text-white hover:bg-white/5 border border-white/10"
          data-testid="wc-eon-close"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Messages or hero */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 md:px-8 pb-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center min-h-[60vh] gap-5 px-2">
            <EonOrb size={120} />
            <h1 className="wc-display text-white text-[40px] md:text-[60px] leading-[1.05]">
              This is EON.
            </h1>
            <p className="text-white/55 text-[14.5px] max-w-md leading-relaxed">
              Ask anything. Get a sharp answer.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-1 max-w-xl">
              {[
                "Tell me something interesting.",
                "Summarize my day.",
                "Write a sharp two-line bio.",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-[12.5px] text-white/75 bg-white/[0.04] border border-white/[0.08] rounded-full px-3.5 py-1.5 hover:bg-white/[0.08] hover:border-white/20 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2.5 pt-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "me" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[88%] md:max-w-[72%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${
                    m.role === "me"
                      ? "wc-bubble-me"
                      : "bg-white/[0.04] text-white border border-white/[0.07]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-2.5 text-white/65 text-sm flex items-center gap-2.5">
                  <span className="inline-flex gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--wc-accent))]"
                      style={{ animation: "wc-bounce 1.2s ease-in-out infinite" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--wc-accent))]"
                      style={{
                        animation: "wc-bounce 1.2s ease-in-out 0.15s infinite",
                      }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--wc-accent))]"
                      style={{
                        animation: "wc-bounce 1.2s ease-in-out 0.3s infinite",
                      }}
                    />
                  </span>
                  thinking
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer — sits above safe-area, never covered */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="relative z-10 px-4 md:px-8 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2"
      >
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask EON…"
            className="wc-input min-h-[48px] max-h-40 resize-none py-3.5 px-5 rounded-3xl text-[14.5px]"
            data-testid="wc-eon-input"
          />
          <Button
            type="submit"
            disabled={!input.trim() || busy}
            className="bg-white text-black hover:bg-white/90 h-12 w-12 p-0 rounded-full shrink-0 wc-shine"
            data-testid="wc-eon-send"
            aria-label="Send"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// News view
// ---------------------------------------------------------------------------
const NEWS_TABS = [
  { key: "general", label: "General" },
  { key: "fox", label: "Fox News" },
  { key: "msnbc", label: "MSNBC" },
  { key: "nyt", label: "New York Times" },
];

const NewsView = () => {
  const [cat, setCat] = useState("general");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await wcClient.get(`/news?category=${cat}`);
        setItems(data.items);
      } catch {
        /* swallow */
      } finally {
        setLoading(false);
      }
    })();
  }, [cat]);

  return (
    <section
      className="flex-1 overflow-y-auto px-6 md:px-10 py-8 pb-28 md:pb-10 max-w-5xl mx-auto w-full"
      data-testid="wc-news"
    >
      <h1 className="wc-display text-[40px] md:text-[52px] text-white leading-none">
        News
      </h1>
      <p className="text-white/50 text-[14.5px] mt-4 mb-7 max-w-xl">
        A curated daily feed. Real news API integration coming soon.
      </p>
      <div className="flex flex-wrap gap-2 mb-7">
        {NEWS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setCat(t.key)}
            className={`text-[12px] px-4 py-1.5 rounded-full wc-mono tracking-wide transition-all ${
              cat === t.key
                ? "bg-white text-black"
                : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] border border-white/[0.06]"
            }`}
            data-testid={`wc-news-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-white/40 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((i) => (
            <button
              key={i.id}
              onClick={() => {
                if (i.url && i.url !== "#") {
                  window.open(i.url, "_blank", "noopener,noreferrer");
                } else {
                  toast.info(
                    "News API integration coming soon. Article links will open in a new tab."
                  );
                }
              }}
              className="wc-glass rounded-2xl p-6 hover:bg-white/[0.05] transition-colors text-left w-full"
              data-testid={`wc-news-${i.id}`}
            >
              <div className="wc-mono text-[10px] tracking-[0.28em] uppercase text-white/40 mb-3">
                {i.source} · {fmtTime(i.published_at)}
              </div>
              <h3 className="wc-display text-[20px] text-white leading-snug">
                {i.title}
              </h3>
              <p className="text-[13.5px] text-white/55 mt-3 leading-relaxed">
                {i.excerpt}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Wood AI view
// ---------------------------------------------------------------------------
const AiOrb = () => (
  <div className="wc-orb-wrap" aria-hidden="true">
    <div className="wc-orb wc-orb-a" />
    <div className="wc-orb wc-orb-b" />
    <div className="wc-orb wc-orb-c" />
    <div className="wc-orb-core" />
  </div>
);

const AiView = ({ user, embedded = false }) => {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: `Hi ${user.first_name}, I'm EON — powered by Wood AI. Ask me anything and I'll keep it short.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async (e) => {
    e?.preventDefault?.();
    const t = input.trim();
    if (!t || busy) return;
    setMessages((m) => [...m, { role: "me", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await wcClient.post("/ai/chat", { message: t });
      setMessages((m) => [...m, { role: "ai", text: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: errMsg(err, "Wood AI is unavailable right now.") },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const showHero = messages.length <= 1;

  return (
    <section
      className={`flex-1 flex flex-col min-w-0 w-full ${
        embedded ? "" : "pb-[72px] md:pb-0"
      }`}
      data-testid="wc-ai"
    >
      <header className="px-6 md:px-10 pt-6 pb-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <EonOrb size={44} />
          <div>
            <h1 className="wc-display text-[28px] md:text-[32px] leading-none text-white">
              EON
            </h1>
            <div className="text-[10.5px] wc-mono tracking-[0.3em] uppercase text-[rgb(var(--wc-accent))] mt-1">
              Powered by Wood AI · BETA
            </div>
          </div>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 md:px-10 pb-4 max-w-3xl mx-auto w-full"
      >
        {showHero && (
          <div className="flex flex-col items-center text-center py-8 md:py-12">
            <AiOrb />
            <p className="wc-font text-white/55 text-[14.5px] mt-8 max-w-md">
              {messages[0].text}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {[
                "Summarize today in one line.",
                "Draft a polite follow-up email.",
                "Explain encryption to a 10-year-old.",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-[12.5px] wc-font text-white/70 bg-white/[0.04] border border-white/[0.08] rounded-full px-3.5 py-1.5 hover:bg-white/[0.07] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {!showHero && (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed wc-font ${
                    m.role === "me" ? "wc-bubble-me" : "wc-bubble-them"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="wc-bubble-them rounded-2xl px-4 py-3 text-white/60 text-sm flex items-center gap-2 wc-font">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <form
        onSubmit={send}
        className="px-6 md:px-10 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/[0.05] flex gap-2.5 items-end max-w-3xl mx-auto w-full wc-glass"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask EON…"
          className="wc-input min-h-[44px] max-h-40 resize-none py-3 rounded-2xl wc-font text-[14.5px]"
          data-testid="wc-ai-input"
        />
        <Button
          type="submit"
          disabled={!input.trim() || busy}
          className="bg-white text-black hover:bg-white/90 h-11 w-11 p-0 rounded-full shrink-0 shadow-[0_10px_30px_-14px_rgba(255,255,255,0.35)]"
          data-testid="wc-ai-send"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2} />
          )}
        </Button>
      </form>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Settings view
// ---------------------------------------------------------------------------
const SettingsView = ({ user, setUser, onSignOut }) => {
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [avatar, setAvatar] = useState(user.avatar_url || "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await wcClient.patch("/me", {
        first_name: first,
        last_name: last,
        avatar_url: avatar || null,
      });
      setUser(data);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(errMsg(err, "Could not update profile."));
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    if (!cur || !next) return;
    try {
      await wcClient.post("/me/password", {
        current_password: cur,
        new_password: next,
      });
      setCur("");
      setNext("");
      toast.success("Password changed.");
    } catch (err) {
      toast.error(errMsg(err, "Could not change password."));
    }
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your WoodX account? This removes your profile and your direct chats."
      )
    )
      return;
    try {
      await wcClient.delete("/me");
      onSignOut();
    } catch (err) {
      toast.error(errMsg(err, "Delete failed."));
    }
  };

  return (
    <section
      className="flex-1 overflow-y-auto px-6 md:px-10 py-8 pb-28 md:pb-10 max-w-2xl mx-auto w-full"
      data-testid="wc-settings"
    >
      <h1 className="wc-display text-[40px] md:text-[52px] text-white leading-none">
        Settings
      </h1>
      <p className="text-white/50 text-[14.5px] mt-4 mb-8">
        Your profile, security and privacy.
      </p>

      <div className="space-y-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={`${first} ${last}`} url={avatar} size={64} />
            <div>
              <div className="text-white text-lg">
                {first} {last}
              </div>
              <div className="text-white/50 text-sm">{user.email}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                First name
              </Label>
              <Input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className="input-premium mt-2 h-11"
                data-testid="wc-settings-first"
              />
            </div>
            <div>
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                Last name
              </Label>
              <Input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                className="input-premium mt-2 h-11"
                data-testid="wc-settings-last"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                Profile photo URL (optional)
              </Label>
              <Input
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="input-premium mt-2 h-11"
                placeholder="https://…"
                data-testid="wc-settings-avatar"
              />
            </div>
          </div>
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="bg-white text-black hover:bg-white/90 mt-5"
            data-testid="wc-settings-save"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-white text-lg mb-4">Change password</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                Current
              </Label>
              <Input
                type="password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                className="input-premium mt-2 h-11"
                data-testid="wc-settings-cur-pw"
              />
            </div>
            <div>
              <Label className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
                New
              </Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="input-premium mt-2 h-11"
                data-testid="wc-settings-new-pw"
              />
            </div>
          </div>
          <Button
            onClick={changePw}
            disabled={!cur || !next}
            className="bg-white/10 border border-white/15 text-white hover:bg-white/20 mt-5"
            data-testid="wc-settings-change-pw"
          >
            Change password
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-white text-lg mb-2">Privacy</h2>
          <p className="text-white/55 text-sm mb-4">
            WoodChat provides privacy-focused messaging tools: you control
            deletion, disappearing messages, and who can reach you.
            Full end-to-end encryption is not enabled in this beta.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-[0.18em]">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
              Private
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/70">
              Disappearing messages
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/70">
              User-controlled deletion
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5">
          <h2 className="text-red-200 text-lg mb-2">Danger zone</h2>
          <p className="text-white/55 text-sm mb-4">
            Delete your account and your personal data.
          </p>
          <Button
            onClick={deleteAccount}
            variant="outline"
            className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10"
            data-testid="wc-settings-delete"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete account
          </Button>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={onSignOut}
            className="text-white/55 hover:text-white text-sm font-mono uppercase tracking-[0.25em]"
            data-testid="wc-settings-signout"
          >
            <LogOut className="h-3.5 w-3.5 inline mr-1.5" />
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------
const WoodChat = () => {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    document.title = "WoodX";
    return () => {
      document.title = "Jwood Technologies";
    };
  }, []);

  useEffect(() => {
    const token = getWcToken();
    if (!token) {
      setBooting(false);
      return;
    }
    (async () => {
      try {
        const { data } = await wcClient.get("/me");
        setUser(data);
      } catch {
        setWcToken(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-[#06070d] grid place-items-center text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <AuthScreen onAuthed={setUser} />;
  return <Shell user={user} setUser={setUser} />;
};

export default WoodChat;

// Indicate Hash import is used (silence unused-warning if tree-shaken)
void Hash;
