import { useEffect, useState } from "react";
import {
  Lock,
  Loader2,
  Users,
  MessageSquare,
  Activity,
  CheckCircle2,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wcClient } from "@/lib/wcClient";

const STORAGE_KEY = "wcadmin_unlocked";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const Card = ({ label, value, sub, tone = "neutral" }) => {
  const t =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
      ? "text-amber-300"
      : tone === "err"
      ? "text-red-300"
      : "text-white";
  return (
    <div className="wc-glass rounded-2xl p-5">
      <div className="wc-mono text-[10px] tracking-[0.28em] uppercase text-white/45">
        {label}
      </div>
      <div className={`wc-display text-[36px] mt-2 leading-none ${t}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[12px] text-white/50 mt-2 wc-font">{sub}</div>
      )}
    </div>
  );
};

const Gate = ({ onUnlock }) => {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setLoading(true);
    try {
      const { data } = await wcClient.get(`/admin/stats?password=${encodeURIComponent(pw)}`);
      sessionStorage.setItem(STORAGE_KEY, pw);
      onUnlock(pw, data);
    } catch {
      toast.error("Invalid password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white flex items-center justify-center px-6 wc-auth-bg wc-font"
      data-testid="wcadmin-gate"
    >
      <form onSubmit={submit} className="w-full max-w-md">
        <div className="inline-flex items-center gap-2 wc-mono text-[10.5px] uppercase tracking-[0.3em] text-white/50 mb-5">
          <Lock className="h-3.5 w-3.5" />
          WoodX Admin
        </div>
        <h1 className="wc-display text-[44px] md:text-[52px] leading-[1.05]">
          Restricted access
        </h1>
        <p className="text-white/55 text-[14.5px] mt-4 max-w-sm">
          Enter the admin password to view WoodX operations metrics.
        </p>
        <div className="mt-8">
          <Label className="wc-mono text-[10px] uppercase tracking-[0.26em] text-white/45">
            Password
          </Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="wc-input mt-2 h-12 rounded-lg wc-font"
            autoFocus
            data-testid="wcadmin-password"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !pw}
          className="w-full h-12 bg-white text-black hover:bg-white/90 mt-5 wc-font"
          data-testid="wcadmin-submit"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
        </Button>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 mt-7 text-[12px] wc-mono uppercase tracking-[0.22em] text-white/55 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </a>
      </form>
    </div>
  );
};

const Dashboard = ({ initial, password, onLogout }) => {
  const [stats, setStats] = useState(initial);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await wcClient.get(
        `/admin/stats?password=${encodeURIComponent(password)}`
      );
      setStats(data);
    } catch {
      toast.error("Failed to load stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = stats;

  return (
    <div
      className="min-h-screen text-white wc-bg wc-font"
      data-testid="wcadmin-dashboard"
    >
      <header className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-6 flex items-center justify-between gap-4">
        <div>
          <div className="wc-mono text-[10.5px] tracking-[0.3em] uppercase text-white/50">
            WoodX · Admin
          </div>
          <h1 className="wc-display text-[44px] md:text-[52px] leading-none mt-2">
            Operations
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={load}
            variant="outline"
            className="border-white/15 bg-transparent text-white hover:bg-white/5"
            disabled={loading}
            data-testid="wcadmin-refresh"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
            className="border-white/15 bg-transparent text-white/70 hover:bg-white/5"
            data-testid="wcadmin-logout"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 pb-16 space-y-10">
        {/* System */}
        <section>
          <h2 className="wc-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
            System
          </h2>
          <div className="wc-glass rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <div className="flex-1">
              <div className="text-white">Service operational</div>
              <div className="text-[12px] wc-mono text-white/45">
                Checked {fmtDate(s.system.checked_at)}
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section>
          <h2 className="wc-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
            At a glance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
              label="Total users"
              value={s.users.total}
              sub={`+${s.users.new_7d} in last 7 days`}
            />
            <Card
              label="Active 7d"
              value={s.users.active_7d}
              sub="Users who sent a message"
              tone="ok"
            />
            <Card
              label="Chats"
              value={s.chats.total}
              sub={`${s.chats.direct} direct · ${s.chats.groups} groups · ${s.chats.rooms} rooms`}
            />
            <Card
              label="Messages 24h"
              value={s.messages.last_24h}
              sub={`${s.messages.last_7d.toLocaleString()} in 7d · ${s.messages.total.toLocaleString()} total`}
            />
          </div>
        </section>

        {/* Users */}
        <section>
          <h2 className="wc-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
            Users
          </h2>
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.4fr_1.6fr_160px] gap-4 px-5 py-3 bg-white/[0.02] wc-mono text-[10px] tracking-[0.22em] uppercase text-white/45">
              <div>Name</div>
              <div>Email</div>
              <div>Created</div>
            </div>
            {s.users.list.map((u, i) => (
              <div
                key={u.id}
                className="grid grid-cols-1 md:grid-cols-[1.4fr_1.6fr_160px] gap-2 md:gap-4 px-5 py-3.5 border-t border-white/[0.04]"
                data-testid={`wcadmin-user-${i}`}
              >
                <div className="text-white">
                  {u.first_name} {u.last_name}
                </div>
                <div className="text-white/65 text-[13.5px] break-all">
                  {u.email}
                </div>
                <div className="text-white/55 text-[12.5px] wc-mono">
                  {fmtDate(u.created_at)}
                </div>
              </div>
            ))}
            {s.users.list.length === 0 && (
              <div className="px-5 py-10 text-center text-white/45 text-sm">
                No users yet.
              </div>
            )}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="wc-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
            Recent activity
          </h2>
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
            {s.recent_activity.map((m, i) => (
              <div
                key={m.id}
                className="px-5 py-3.5 border-t border-white/[0.04] first:border-t-0 flex items-start gap-3"
                data-testid={`wcadmin-activity-${i}`}
              >
                <Activity className="h-3.5 w-3.5 text-white/35 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[13.5px]">
                    <span className="font-medium">{m.sender_name}</span>
                    <span className="text-white/40"> · {m.text_preview}</span>
                  </div>
                  <div className="text-[11px] wc-mono text-white/40 mt-0.5">
                    {fmtDate(m.created_at)}
                  </div>
                </div>
              </div>
            ))}
            {s.recent_activity.length === 0 && (
              <div className="px-5 py-10 text-center text-white/45 text-sm">
                No activity yet.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const WoodXAdmin = () => {
  const [password, setPassword] = useState(null);
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    document.title = "WoodX · Admin";
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    (async () => {
      try {
        const { data } = await wcClient.get(
          `/admin/stats?password=${encodeURIComponent(saved)}`
        );
        setPassword(saved);
        setInitial(data);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    })();
    return () => {
      document.title = "Jwood Technologies";
    };
  }, []);

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword(null);
    setInitial(null);
  };

  if (!password || !initial)
    return (
      <Gate
        onUnlock={(pw, data) => {
          setPassword(pw);
          setInitial(data);
        }}
      />
    );

  return (
    <Dashboard initial={initial} password={password} onLogout={logout} />
  );
};

export default WoodXAdmin;
