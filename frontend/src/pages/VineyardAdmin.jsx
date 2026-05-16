import { useEffect, useState, useCallback } from "react";
import {
  Lock,
  Loader2,
  Activity,
  Database,
  FileText,
  Globe,
  MessageCircle,
  Mail,
  Server,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Hammer,
  ShieldCheck,
  Undo2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";

// ---------------------------------------------------------------------------
const AdminGate = ({ onUnlock }) => {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await apiClient.post("/admin/auth", { password: pw });
      sessionStorage.setItem("vineyard_admin_unlocked", "1");
      // Stash for admin-only endpoints that take ?password=
      sessionStorage.setItem("vineyard_admin_pw", pw);
      onUnlock();
    } catch {
      setErr("Incorrect password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#06070d] px-6"
      data-testid="admin-gate"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] uppercase text-white/45">
          <Lock className="h-3.5 w-3.5" />
          Admin · System Health
        </div>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white">
          Vineyard Admin
        </h1>
        <p className="mt-3 text-white/55 text-sm">
          Enter admin password to view health metrics.
        </p>
        <form onSubmit={submit} className="mt-10 space-y-4">
          <Label
            htmlFor="adm-pw"
            className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/55"
          >
            Admin password
          </Label>
          <Input
            id="adm-pw"
            type="password"
            autoFocus
            data-testid="admin-password-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="input-premium h-12 rounded-lg font-mono"
            placeholder="••••"
          />
          {err && (
            <p
              className="text-sm text-red-400 font-mono"
              data-testid="admin-password-error"
            >
              {err}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading || !pw}
            className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-lg"
            data-testid="admin-password-submit"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const fmtNum = (n) => (n ?? 0).toLocaleString();
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const Pill = ({ tone = "neutral", children }) => {
  const tones = {
    neutral: "bg-white/10 text-white/80",
    ok: "bg-emerald-400/15 text-emerald-300",
    warn: "bg-amber-400/15 text-amber-300",
    err: "bg-red-400/15 text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono tracking-[0.15em] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

// Friendly status mapping shown to admin.
const STATUS_DISPLAY = {
  done: { label: "Ready", tone: "ok" },
  crawling: { label: "Crawling", tone: "warn" },
  error: { label: "Failed", tone: "err" },
  timeout: { label: "Timed out", tone: "err" },
  idle: { label: "Idle", tone: "neutral" },
};

const reasonFromError = (err) => {
  if (!err) return "";
  const e = err.toLowerCase();
  if (e.includes("timeout")) return "timeout";
  if (e.includes("blocked") || e.includes("403") || e.includes("captcha"))
    return "blocked site";
  if (e.includes("no documents") || e.includes("empty"))
    return "no documents found";
  if (e.includes("manual reset")) return "manually reset";
  return "crawler error";
};

const Card = ({ icon: Icon, label, value, sub, tone = "neutral", testId }) => (
  <div
    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/45">
        {label}
      </div>
      <div className="h-7 w-7 rounded-md bg-white/5 border border-white/10 grid place-items-center">
        <Icon className="h-3.5 w-3.5 text-white/70" />
      </div>
    </div>
    <div className="text-3xl md:text-4xl font-light tracking-tight text-white tabular-nums">
      {value}
    </div>
    {sub ? (
      <div className="text-[11px] text-white/50 font-mono tracking-wide">
        {typeof sub === "string" ? <Pill tone={tone}>{sub}</Pill> : sub}
      </div>
    ) : null}
  </div>
);

// ---------------------------------------------------------------------------
// Index Rebuild + Lock Wizard — single-button workflow that crawls into a
// build version, waits for every source to finish, then atomically locks.
// ---------------------------------------------------------------------------
const RebuildWizard = ({ health, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState(null);
  const sources = health?.sources_detail || [];
  const crawling = sources.filter((s) => s.status === "crawling");
  const isBuilding = crawling.length > 0;

  const loadVersions = useCallback(async () => {
    const pw = sessionStorage.getItem("vineyard_admin_pw");
    if (!pw) return;
    try {
      const { data } = await apiClient.get(
        "/vineyard/admin/index-versions",
        { params: { password: pw } }
      );
      setVersions(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions, health?.indexed_documents]);

  const buildPending = (versions?.versions || []).find(
    (v) => v.kind === "build"
  );
  const previousVersion = (versions?.versions || []).find(
    (v) => v.kind === "previous"
  );
  const canLock = !!buildPending && !isBuilding;

  const startRebuild = async () => {
    if (!sources.length) {
      toast.error("No sources configured.");
      return;
    }
    if (
      !window.confirm(
        "Start a fresh deep crawl of all configured sources? Users " +
          "keep seeing the current locked archive until you press Lock."
      )
    )
      return;
    setBusy(true);
    try {
      const pw = sessionStorage.getItem("vineyard_admin_pw");
      await apiClient.post(
        "/vineyard/admin/rebuild-index",
        null,
        { params: { password: pw } }
      );
      toast.success("Crawl started. This runs in the background.");
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't start rebuild.");
    } finally {
      setBusy(false);
    }
  };

  const lockNow = async () => {
    if (!canLock) return;
    if (
      !window.confirm(
        "Promote the new build to be the active archive? Users will " +
          "see the new dataset on their next refresh."
      )
    )
      return;
    setBusy(true);
    try {
      const pw = sessionStorage.getItem("vineyard_admin_pw");
      const { data } = await apiClient.post(
        "/vineyard/admin/lock-index",
        null,
        { params: { password: pw } }
      );
      toast.success(`Locked · ${data.doc_count.toLocaleString()} docs active.`);
      await loadVersions();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lock failed.");
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!previousVersion) return;
    if (
      !window.confirm(
        "Roll back to the previous archive version? The current active " +
          "version will be discarded."
      )
    )
      return;
    setBusy(true);
    try {
      const pw = sessionStorage.getItem("vineyard_admin_pw");
      const { data } = await apiClient.post(
        "/vineyard/admin/rollback-index",
        null,
        { params: { password: pw } }
      );
      toast.success(
        `Rolled back · ${data.doc_count.toLocaleString()} docs active.`
      );
      await loadVersions();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Rollback failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
      data-testid="admin-rebuild-wizard"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-1">
            Index · Rebuild + Lock
          </h2>
          <p className="text-white/85 text-base">
            {isBuilding ? (
              <>
                Crawling {crawling.length} source
                {crawling.length === 1 ? "" : "s"}…
              </>
            ) : canLock ? (
              <>
                New build ready ·{" "}
                <span className="text-emerald-300">
                  {buildPending.doc_count.toLocaleString()} docs staged
                </span>
              </>
            ) : (
              <>Active archive locked. Run a rebuild to refresh the data.</>
            )}
          </p>
          <p className="text-white/45 text-xs mt-1.5">
            Active version:{" "}
            <span className="text-white/65 font-mono">
              {versions?.active_version || "—"}
            </span>{" "}
            · {versions?.active_doc_count?.toLocaleString() || 0} docs
            {previousVersion ? (
              <>
                {" "}
                · prev kept ({previousVersion.doc_count.toLocaleString()})
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={startRebuild}
            disabled={busy || isBuilding}
            className="bg-white text-black hover:bg-white/90 h-10"
            data-testid="admin-rebuild-start"
          >
            {isBuilding ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Hammer className="h-4 w-4 mr-1.5" />
            )}
            {isBuilding ? "Building…" : "Rebuild Index"}
          </Button>
          <Button
            onClick={lockNow}
            disabled={busy || !canLock}
            className="bg-emerald-500/90 text-emerald-50 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-white/30 h-10"
            data-testid="admin-rebuild-lock"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            Lock Index
          </Button>
          <Button
            onClick={rollback}
            disabled={busy || !previousVersion || isBuilding}
            variant="ghost"
            className="border border-white/10 text-white/70 hover:bg-white/5 hover:text-white h-10"
            data-testid="admin-rebuild-rollback"
          >
            <Undo2 className="h-4 w-4 mr-1.5" />
            Rollback
          </Button>
        </div>
      </div>

      {/* Source progress */}
      {sources.length > 0 && (
        <div className="mt-5 space-y-2" data-testid="admin-rebuild-progress">
          {sources.map((s) => {
            const tone =
              s.status === "done"
                ? "text-emerald-300"
                : s.status === "crawling"
                ? "text-amber-200"
                : s.status === "error" || s.status === "timeout"
                ? "text-rose-300"
                : "text-white/45";
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    s.status === "done"
                      ? "bg-emerald-400"
                      : s.status === "crawling"
                      ? "bg-amber-400 animate-pulse"
                      : s.status === "error" || s.status === "timeout"
                      ? "bg-rose-400"
                      : "bg-white/20"
                  }`}
                />
                <span className="text-white/85 flex-1 truncate">
                  {s.label || s.url}
                </span>
                <span className={`font-mono text-[11px] uppercase ${tone}`}>
                  {s.status}
                </span>
                <span className="font-mono text-[11px] text-white/40 w-20 text-right">
                  {(s.pages_indexed || 0).toLocaleString()} docs
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Versions inventory */}
      {versions?.versions?.length > 0 && (
        <div
          className="mt-5 rounded-lg border border-white/5 bg-black/30 p-3"
          data-testid="admin-rebuild-versions"
        >
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2 flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            Versions in DB
          </div>
          <div className="space-y-1">
            {versions.versions.map((v) => (
              <div
                key={v.version}
                className="flex items-center gap-3 text-[12px]"
              >
                <span
                  className={`font-mono px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    v.kind === "active"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : v.kind === "build"
                      ? "bg-amber-500/20 text-amber-200"
                      : v.kind === "previous"
                      ? "bg-white/10 text-white/60"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {v.kind}
                </span>
                <span className="font-mono text-white/55 flex-1 truncate">
                  {v.version}
                </span>
                <span className="font-mono text-white/45">
                  {v.doc_count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
const AdminDashboard = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await apiClient.get("/admin/health");
      setHealth(data);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#06070d] grid place-items-center text-white/60"
        data-testid="admin-loading"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const m = health?.metrics || {};
  const crawlTone =
    health?.crawl_status === "ok"
      ? "ok"
      : health?.crawl_status === "in_progress"
      ? "warn"
      : "err";
  const crawlText =
    health?.crawl_status === "ok"
      ? "All Sources OK"
      : health?.crawl_status === "in_progress"
      ? "Crawl in Progress"
      : "Issues Detected";

  return (
    <div
      className="min-h-screen bg-[#06070d] text-white"
      data-testid="admin-dashboard"
    >
      <header className="border-b border-white/5 bg-[#04050a] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-white/5 border border-white/10 grid place-items-center shrink-0">
              <Activity className="h-4 w-4 text-white/80" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/45">
                Admin · System Health
              </div>
              <div className="text-white text-[15px] font-medium truncate">
                Vineyard Admin
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={load}
              disabled={refreshing}
              className="bg-white/10 border border-white/15 text-white hover:bg-white/20 h-9"
              data-testid="admin-refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  refreshing ? "animate-spin" : ""
                } sm:mr-1.5`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <button
              onClick={() => {
                sessionStorage.removeItem("vineyard_admin_unlocked");
                window.location.reload();
              }}
              className="text-xs font-mono tracking-[0.2em] uppercase text-white/45 hover:text-white/80 px-1"
              aria-label="Sign out"
              data-testid="admin-lock"
              title="Sign out"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 space-y-8">
        {/* Top status row */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              icon={Server}
              label="System"
              value="Online"
              sub="Healthy"
              tone="ok"
              testId="admin-card-system"
            />
            <Card
              icon={crawlTone === "ok" ? CheckCircle2 : AlertTriangle}
              label="Crawl"
              value={
                health?.crawl_status === "in_progress"
                  ? "Running"
                  : health?.crawl_status === "ok"
                  ? "OK"
                  : "Issues"
              }
              sub={crawlText}
              tone={crawlTone}
              testId="admin-card-crawl"
            />
            <Card
              icon={FileText}
              label="Indexed docs"
              value={fmtNum(health?.indexed_documents)}
              sub="Across all sources"
              testId="admin-card-docs"
            />
            <Card
              icon={Database}
              label="Sources"
              value={fmtNum(health?.sources_count)}
              sub="Default + user added"
              testId="admin-card-sources"
            />
          </div>
        </section>

        <RebuildWizard health={health} onChanged={load} />

        {/* API / Activity */}
        <section>
          <h2 className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
            API Usage · Wood AI
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Card
              icon={Globe}
              label="Embedding calls"
              value={fmtNum(m.openai_embed_calls)}
              sub={`${fmtNum(m.openai_embed_tokens)} tokens`}
              testId="admin-card-embed"
            />
            <Card
              icon={Globe}
              label="Chat calls"
              value={fmtNum(m.openai_chat_calls)}
              sub={`${fmtNum(m.openai_chat_tokens)} tokens`}
              testId="admin-card-chat"
            />
            <Card
              icon={Activity}
              label="Vineyard searches"
              value={fmtNum(m.vineyard_search_count)}
              testId="admin-card-vineyard-search"
            />
            <Card
              icon={Activity}
              label="Web searches"
              value={fmtNum(m.web_search_count)}
              testId="admin-card-web-search"
            />
            <Card
              icon={MessageCircle}
              label="Chatbot leads"
              value={fmtNum(m.chatbot_submissions)}
              testId="admin-card-chatbot"
            />
            <Card
              icon={Mail}
              label="Inquiries"
              value={fmtNum(m.contact_submissions)}
              testId="admin-card-contact"
            />
            <Card
              icon={Clock}
              label="Last crawl"
              value={fmtDate(health?.last_crawl_at)}
              testId="admin-card-last-crawl"
            />
            <Card
              icon={Clock}
              label="Next scheduled"
              value={
                health?.next_scheduled_crawl
                  ? fmtDate(health.next_scheduled_crawl)
                  : "—"
              }
              sub={
                health?.next_scheduled_crawl
                  ? `Every ${health?.crawl_interval_days ?? 7} day${
                      (health?.crawl_interval_days ?? 7) === 1 ? "" : "s"
                    }`
                  : "Manual refresh only"
              }
              testId="admin-card-next-crawl"
            />
          </div>
        </section>

        {/* Sources detail */}
        <section data-testid="admin-sources-section">
          <h2 className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3">
            Sources detail
          </h2>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_120px_110px_160px_110px] gap-4 px-5 py-3 bg-white/[0.03] font-mono text-[10px] tracking-[0.2em] uppercase text-white/45">
              <div>Source</div>
              <div>Status</div>
              <div>Indexed</div>
              <div>Last Crawled</div>
              <div>Action</div>
            </div>
            {(health?.sources_detail || []).map((s, i) => {
              const disp =
                STATUS_DISPLAY[s.status] || STATUS_DISPLAY.idle;
              const reason = reasonFromError(s.last_error);
              const onReset = async () => {
                if (!s.id) return;
                try {
                  await apiClient.post(
                    `/admin/sources/${s.id}/reset`
                  );
                  toast.success("Source reset.");
                  load();
                } catch {
                  toast.error("Reset failed.");
                }
              };
              return (
                <div
                  key={s.url + i}
                  className="grid grid-cols-1 md:grid-cols-[1fr_120px_110px_160px_110px] gap-3 md:gap-4 px-5 py-4 border-t border-white/5"
                  data-testid={`admin-source-row-${i}`}
                >
                  <div className="min-w-0">
                    <div className="text-white truncate">
                      {s.label || s.url}
                    </div>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs text-white/45 hover:text-white/70 break-all"
                    >
                      {s.url}
                    </a>
                    {s.last_error ? (
                      <div className="text-[11px] text-red-300/80 mt-1">
                        <span className="font-mono uppercase tracking-[0.15em] mr-2">
                          {reason}
                        </span>
                        <span className="text-red-300/60">
                          {s.last_error}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <Pill tone={disp.tone}>{disp.label}</Pill>
                  </div>
                  <div className="font-mono text-white/80 tabular-nums">
                    {fmtNum(s.indexed ?? s.pages_indexed)}
                  </div>
                  <div className="text-white/60 text-[12.5px]">
                    {fmtDate(s.last_crawled_at)}
                  </div>
                  <div>
                    {(s.status === "crawling" ||
                      s.status === "error" ||
                      s.status === "timeout") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onReset}
                        className="h-8 border-white/15 bg-transparent text-white/85 hover:bg-white/10 px-2.5"
                        data-testid={`admin-source-reset-${i}`}
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!(health?.sources_detail || []).length && (
              <div className="p-8 text-center text-white/45 text-sm">
                No sources configured.
              </div>
            )}
          </div>
        </section>

        <div className="text-center text-[11px] font-mono tracking-[0.2em] uppercase text-white/25 pb-6">
          Uptime since {fmtDate(health?.uptime_started_at)}
        </div>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
const VineyardAdmin = () => {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("vineyard_admin_unlocked") === "1"
  );

  // noindex + title
  useEffect(() => {
    document.title = "Vineyard Admin";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex,nofollow,noarchive,nosnippet");
    return () => {
      if (meta) meta.setAttribute("content", "index,follow");
      document.title = "Jwood Technologies";
    };
  }, []);

  if (!unlocked) return <AdminGate onUnlock={() => setUnlocked(true)} />;
  return <AdminDashboard />;
};

export default VineyardAdmin;
