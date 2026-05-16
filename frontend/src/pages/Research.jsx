import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Lock,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  X,
  Database,
  Cpu,
  Layers,
  ShieldAlert,
  Workflow,
  ChevronRight,
  Sparkles,
  FileSearch,
  Download,
  Plus,
  RefreshCw,
  Bookmark,
  GitCompareArrows,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import CompareView from "@/components/CompareView";
import ResearchActions from "@/components/ResearchActions";
import AddSource from "@/components/AddSource";
import SourceExplorer from "@/components/SourceExplorer";
import {
  listSaved as listSavedDocs,
  removeSaved as removeSavedDoc,
  clearAll as clearAllSaved,
} from "@/lib/researchSaved";

const UNLOCK_KEY = "research_unlocked";
const ADMIN_KEY = "research_admin_password";

// ---------------------------------------------------------------------------
// Password gate (555)
// ---------------------------------------------------------------------------
const Gate = ({ onUnlock }) => {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      await apiClient.post("/research/auth", { password: pw });
      try {
        sessionStorage.setItem(UNLOCK_KEY, "1");
      } catch (_) {
        /* ignore quota */
      }
      onUnlock();
    } catch (_) {
      setErr("Incorrect password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#08070a] px-6 relative overflow-hidden"
      data-testid="research-gate"
    >
      {/* amber bloom */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(255,176,82,0.55) 0%, rgba(255,90,40,0.0) 60%)",
          }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[520px] h-[520px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(255,90,40,0.55) 0%, rgba(0,0,0,0) 60%)",
          }}
        />
      </div>
      <div className="w-full max-w-md relative">
        <div className="mb-8 flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] uppercase text-amber-300/70">
          <Cpu className="h-3.5 w-3.5" />
          Restricted
        </div>
        <h1
          className="text-4xl md:text-5xl font-light tracking-tight text-white"
          data-testid="research-gate-title"
        >
          Research Mode
        </h1>
        <p className="mt-3 text-white/55 text-sm leading-relaxed">
          Enter your access password to continue.
        </p>
        <form onSubmit={submit} className="mt-10 space-y-4">
          <Label
            htmlFor="rs-pw"
            className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/55"
          >
            Access password
          </Label>
          <Input
            id="rs-pw"
            type="password"
            autoFocus
            data-testid="research-password-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="h-12 rounded-lg font-mono bg-black/40 border-white/15 text-white placeholder:text-white/25"
            placeholder="••••"
          />
          {err && (
            <p
              className="text-sm text-red-400 font-mono"
              data-testid="research-password-error"
            >
              {err}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading || !pw}
            data-testid="research-password-submit"
            className="w-full h-12 bg-amber-300 text-black hover:bg-amber-200 rounded-lg font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Enter Research Mode"
            )}
          </Button>
        </form>
        <p className="mt-10 text-[11px] text-white/30 leading-relaxed font-mono">
          This is an internal investigative tool. Documents indexed here are
          separate from the public /vineyard archive.
        </p>
        <p className="mt-4 text-[11px] text-white/30 font-mono">
          <Link to="/vineyard" className="hover:text-white/60">← back to Vineyard</Link>
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Entity / source chip rows
// ---------------------------------------------------------------------------
const ENTITY_OPTIONS = [
  { id: "all", label: "All entities" },
  { id: "vineyard", label: "Vineyard" },
  { id: "vineyard-rda", label: "Vineyard RDA" },
  { id: "geneva-steel", label: "Geneva Steel" },
  { id: "geneva-steel-holdings", label: "Geneva Steel Holdings" },
  { id: "pacificorp", label: "PacifiCorp" },
  { id: "us-steel", label: "US Steel" },
  { id: "anderson-geneva", label: "Anderson Geneva" },
  { id: "utah-city", label: "Utah City" },
];

const SOURCE_OPTIONS = [
  { id: "all", label: "All sources" },
  { id: "rda_xlsx", label: "RDA Past Meetings" },
  { id: "pacificorp_csv", label: "PacifiCorp Appeals" },
  { id: "proservices_xlsx", label: "ProServices Master" },
  { id: "sec_edgar", label: "SEC EDGAR" },
  { id: "courtlistener", label: "Court Records" },
  { id: "manual", label: "Manual" },
  { id: "user_link", label: "Added links" },
];

// ---------------------------------------------------------------------------
// Top metric strip
// ---------------------------------------------------------------------------
const MetricStrip = ({ stats, onRefresh, refreshing }) => {
  if (!stats) return null;
  const atlas = stats.atlas || {};
  const used = atlas.data_mb || 0;
  const limit = atlas.free_tier_limit_mb || 512;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const entities = Object.entries(stats.by_entity || {});
  const sources = Object.entries(stats.by_source || {});
  return (
    <div
      className="rounded-xl border border-amber-300/15 bg-gradient-to-br from-amber-500/[0.06] to-orange-700/[0.04] backdrop-blur p-5 md:p-6"
      data-testid="research-metric-strip"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-amber-300/70">
            Corpus
          </div>
          <div className="mt-2 text-3xl md:text-4xl font-light text-white tracking-tight">
            {stats.total_docs.toLocaleString()}{" "}
            <span className="text-white/40 text-base">documents</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-amber-300/70">
            Atlas
          </div>
          <div className="mt-2 text-sm text-white/75 font-mono">
            {used.toFixed(1)} MB / {limit} MB
          </div>
          <div className="mt-2 w-44 h-1.5 rounded-full bg-white/10 overflow-hidden ml-auto">
            <div
              className="h-full bg-amber-300/80 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            data-testid="research-stats-refresh"
            className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-white/50 hover:text-white"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            refresh
          </button>
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40">
            By entity
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entities.length === 0 && (
              <span className="text-white/30 text-xs">no docs yet</span>
            )}
            {entities.map(([k, n]) => (
              <span
                key={k}
                className="text-[11px] font-mono px-2 py-0.5 rounded border border-amber-300/20 text-amber-200/85 bg-amber-300/[0.04]"
              >
                {k} · {n}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40">
            By source
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sources.length === 0 && (
              <span className="text-white/30 text-xs">no docs yet</span>
            )}
            {sources.map(([k, n]) => (
              <span
                key={k}
                className="text-[11px] font-mono px-2 py-0.5 rounded border border-white/15 text-white/70 bg-white/[0.03]"
              >
                {k} · {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Document card (with checkbox for compare/export)
// ---------------------------------------------------------------------------
const ResultCard = ({ row, selected, onToggle, onOpen, onSavedChange }) => {
  return (
    <div
      className={`group rounded-lg border p-4 transition cursor-pointer ${
        selected
          ? "border-amber-300/50 bg-amber-300/[0.07]"
          : "border-white/10 bg-white/[0.02] hover:border-white/25"
      }`}
      data-testid={`research-result-${row.id}`}
      onClick={() => onOpen(row)}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(row.id);
          }}
          aria-label={selected ? "Deselect" : "Select"}
          data-testid={`research-select-${row.id}`}
          className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0 transition ${
            selected
              ? "bg-amber-300 border-amber-300 text-black"
              : "border-white/30 hover:border-white/60"
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/70">
              {row.entity}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
              {row.source}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
              {row.doc_type}
            </span>
          </div>
          <div className="text-white text-[15px] leading-snug font-medium line-clamp-2">
            {row.title}
          </div>
          <div
            className="mt-2 text-white/60 text-[13px] leading-relaxed line-clamp-3 research-snippet"
            dangerouslySetInnerHTML={{ __html: row.snippet }}
          />
          <div
            className="mt-2 flex items-center gap-3 text-[11px] font-mono text-white/40"
            onClick={(e) => e.stopPropagation()}
          >
            {typeof row.score === "number" && (
              <span>score {row.score.toFixed(2)}</span>
            )}
            {row.url && (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-white/50 hover:text-white"
              >
                <ExternalLink className="h-3 w-3" /> open source
              </a>
            )}
            <div className="ml-auto">
              <ResearchActions row={row} onSavedChange={onSavedChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Full document modal
// ---------------------------------------------------------------------------
const DocModal = ({ doc, onClose }) => {
  const [showMeta, setShowMeta] = useState(false);
  if (!doc) return null;
  const url = doc.url || "";
  const isPdf = /\.pdf(\?|#|$)/i.test(url);
  const content = doc.content || "";

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(`${doc.title}\n${url}\n\n${content}`);
      toast.success("Copied");
    } catch (_) {
      toast.error("Clipboard blocked");
    }
  };

  const downloadPdf = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      data-testid="research-doc-modal"
    >
      <div
        className="w-full max-w-5xl max-h-[94vh] rounded-xl border border-white/15 bg-[#0c0a10] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with primary actions */}
        <div className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/80">
                {doc.entity}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                {doc.source}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                {doc.doc_type}
              </span>
              {doc.meta?.date && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-[10px] font-mono text-white/45">
                    {doc.meta.date}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-white text-base sm:text-lg font-medium leading-snug">
              {doc.title}
            </h2>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-200/85 hover:text-amber-100 font-mono break-all"
                data-testid="doc-modal-url"
              >
                <ExternalLink className="h-3 w-3 shrink-0" /> {url}
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white shrink-0"
            aria-label="Close"
            data-testid="research-doc-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-b border-white/10 bg-white/[0.015]">
          {url && (
            <Button
              size="sm"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              data-testid="doc-modal-open"
              className="bg-amber-300 hover:bg-amber-200 text-black h-8"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open document
            </Button>
          )}
          {isPdf && (
            <Button
              size="sm"
              variant="outline"
              onClick={downloadPdf}
              data-testid="doc-modal-download"
              className="border-white/20 text-white hover:bg-white/10 h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={copyContent}
            data-testid="doc-modal-copy"
            className="border-white/20 text-white hover:bg-white/10 h-8"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy text
          </Button>
          <div className="ml-auto">
            <ResearchActions row={doc} />
          </div>
        </div>

        {/* Primary view: PDF preview OR readable content */}
        <div className="overflow-y-auto flex-1">
          {isPdf ? (
            <div className="h-[65vh] bg-black/40" data-testid="doc-modal-pdf-embed">
              <iframe
                src={url}
                title={doc.title}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div
              className="p-5 text-[13px] sm:text-[14px] text-white/85 leading-relaxed whitespace-pre-wrap font-mono"
              data-testid="doc-modal-content"
            >
              {content || (
                <span className="text-white/40">
                  No extracted text is stored for this record. Use “Open
                  document” above to view the original source.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Secondary: collapsible metadata */}
        {doc.meta && Object.keys(doc.meta).length > 0 && (
          <div className="border-t border-white/10 bg-black/30">
            <button
              type="button"
              onClick={() => setShowMeta((v) => !v)}
              data-testid="doc-modal-meta-toggle"
              className="w-full flex items-center justify-between px-5 py-2.5 text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-white"
            >
              <span>Metadata & citation</span>
              <span>{showMeta ? "hide" : "show"}</span>
            </button>
            {showMeta && (
              <pre
                data-testid="doc-modal-meta"
                className="px-5 pb-4 text-[11px] text-white/65 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto"
              >
                {JSON.stringify(doc.meta, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Selection drawer (Compare + Export)
// ---------------------------------------------------------------------------
const SelectionDrawer = ({ selected, allRows, onClose, onClearAll }) => {
  const [target, setTarget] = useState("claude");
  const [question, setQuestion] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareAnswer, setCompareAnswer] = useState("");
  const [exportPrompt, setExportPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const selectedRows = useMemo(
    () => allRows.filter((r) => selected.has(r.id)),
    [selected, allRows]
  );

  const compare = async () => {
    if (selected.size < 2) {
      toast.error("Select at least 2 documents");
      return;
    }
    setCompareLoading(true);
    setCompareAnswer("");
    try {
      const r = await apiClient.post("/research/compare", {
        doc_ids: [...selected],
        question: question || undefined,
      });
      setCompareAnswer(r.data.answer || "(no answer)");
    } catch (e) {
      toast.error("Compare failed");
    } finally {
      setCompareLoading(false);
    }
  };

  const buildExport = async () => {
    if (selected.size === 0) {
      toast.error("Select at least 1 document");
      return;
    }
    try {
      const r = await apiClient.post("/research/export", {
        doc_ids: [...selected],
        target,
        question: question || undefined,
      });
      setExportPrompt(r.data.prompt || "");
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const copyPrompt = async () => {
    if (!exportPrompt) {
      await buildExport();
    }
    try {
      await navigator.clipboard.writeText(exportPrompt);
      setCopied(true);
      toast.success("Copied — paste into Claude / ChatGPT");
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      toast.error("Clipboard blocked");
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      onClick={onClose}
      data-testid="research-selection-drawer"
    >
      <div
        className="w-full max-w-md h-full bg-[#0a0810] border-l border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300/70">
              Selected
            </div>
            <div className="text-white text-lg font-medium mt-0.5">
              {selected.size} document{selected.size === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/50 hover:text-white"
              data-testid="research-selection-clear"
            >
              clear
            </button>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Documents
            </div>
            {selectedRows.map((r) => (
              <div
                key={r.id}
                className="text-[12px] text-white/70 px-3 py-2 rounded border border-white/10 bg-white/[0.02]"
              >
                <div className="font-mono text-[10px] text-amber-300/70 uppercase">
                  {r.entity} · {r.source}
                </div>
                <div className="text-white/80 mt-0.5 line-clamp-2">
                  {r.title}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Optional question / task
            </Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              data-testid="research-selection-question"
              placeholder="e.g. Compare timelines + dollar amounts"
              className="h-10 rounded-md bg-black/40 border-white/15 text-white text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              AI Compare
            </div>
            <Button
              onClick={compare}
              disabled={compareLoading || selected.size < 2}
              data-testid="research-compare-btn"
              className="w-full h-10 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-md"
            >
              {compareLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Workflow className="h-4 w-4 mr-2" /> Compare with AI
                </>
              )}
            </Button>
            {compareAnswer && (
              <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.04] p-3 text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap">
                {compareAnswer}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Export prompt
            </div>
            <div className="flex gap-2">
              {["claude", "chatgpt", "plain"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTarget(t);
                    setExportPrompt("");
                  }}
                  data-testid={`research-export-target-${t}`}
                  className={`flex-1 h-9 text-[11px] font-mono uppercase tracking-[0.18em] rounded-md border transition ${
                    target === t
                      ? "bg-amber-300 text-black border-amber-300"
                      : "border-white/15 text-white/55 hover:text-white hover:border-white/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button
              onClick={copyPrompt}
              disabled={selected.size === 0}
              data-testid="research-export-copy"
              className="w-full h-10 bg-amber-300 hover:bg-amber-200 text-black rounded-md font-medium"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" /> Copy {target} prompt
                </>
              )}
            </Button>
            {exportPrompt && (
              <details className="rounded-md border border-white/10 bg-black/40">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-mono uppercase tracking-[0.18em] text-white/45">
                  Preview ({exportPrompt.length.toLocaleString()} chars)
                </summary>
                <pre className="p-3 text-[11px] text-white/65 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                  {exportPrompt}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Admin tools (gated by 7607)
// ---------------------------------------------------------------------------
const ResearchTools = ({ onAfterAction }) => {
  const [busy, setBusy] = useState(false);
  const [crawlMax, setCrawlMax] = useState(30);

  const ingestSeed = async () => {
    setBusy(true);
    try {
      const r = await apiClient.post(`/research/ingest/seed-uploads`);
      const totals = Object.entries(r.data || {})
        .map(([k, v]) => `${k}: ${v.docs ?? v.error ?? "?"}`)
        .join(" · ");
      toast.success(`Ingested — ${totals}`);
      onAfterAction?.();
    } catch (e) {
      toast.error("Ingest failed");
    } finally {
      setBusy(false);
    }
  };

  const crawlSec = async () => {
    setBusy(true);
    try {
      await apiClient.post(
        `/research/crawl/sec?max_per_entity=${crawlMax}`
      );
      toast.success(`SEC crawl started — ${crawlMax}/entity`);
      onAfterAction?.();
    } catch (e) {
      toast.error("Crawl failed");
    } finally {
      setBusy(false);
    }
  };

  const crawlCourts = async () => {
    setBusy(true);
    try {
      await apiClient.post(
        `/research/crawl/courts?max_per_query=${crawlMax}`
      );
      toast.success(`Court crawl started — ${crawlMax}/query`);
      onAfterAction?.();
    } catch (e) {
      toast.error("Crawl failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-white/45">
          <Sparkles className="h-3.5 w-3.5" /> Research tools
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45 shrink-0">
            crawl size
          </Label>
          <Input
            type="number"
            value={crawlMax}
            onChange={(e) => setCrawlMax(parseInt(e.target.value || "10", 10))}
            data-testid="research-crawl-max"
            className="h-8 bg-black/40 border-white/15 text-white text-[12px] font-mono w-20"
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={ingestSeed}
          disabled={busy}
          data-testid="research-ingest-uploaded"
          size="sm"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
            <><Plus className="h-3.5 w-3.5 mr-1.5" /> Re-ingest uploaded files</>
          )}
        </Button>
        <Button
          onClick={crawlSec}
          disabled={busy}
          data-testid="research-crawl-sec"
          size="sm"
          variant="outline"
          className="border-amber-300/40 text-amber-200 hover:bg-amber-300/10"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
            <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Crawl SEC EDGAR</>
          )}
        </Button>
        <Button
          onClick={crawlCourts}
          disabled={busy}
          data-testid="research-crawl-courts"
          size="sm"
          variant="outline"
          className="border-amber-300/40 text-amber-200 hover:bg-amber-300/10"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
            <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Crawl Courts + Bankruptcy</>
          )}
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const Research = () => {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === "1";
    } catch (_) {
      return false;
    }
  });
  const [stats, setStats] = useState(null);
  const [refreshingStats, setRefreshingStats] = useState(false);

  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const [source, setSource] = useState("all");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [answer, setAnswer] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const [selected, setSelected] = useState(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openDoc, setOpenDoc] = useState(null);

  // Tabs: search | graph | saved
  const [tab, setTab] = useState("search");
  const [savedDocs, setSavedDocs] = useState(() => listSavedDocs());
  const refreshSaved = () => setSavedDocs(listSavedDocs());

  // Compare view (2-doc side-by-side)
  const [compareIds, setCompareIds] = useState(null);
  const openCompare = () => {
    if (selected.size < 2) {
      toast.error("Select 2 documents to compare");
      return;
    }
    setCompareIds([...selected].slice(0, 2));
  };

  const fetchStats = useCallback(async () => {
    setRefreshingStats(true);
    try {
      const r = await apiClient.get("/research/stats");
      setStats(r.data);
    } catch (e) {
      /* ignore */
    } finally {
      setRefreshingStats(false);
    }
  }, []);

  // noindex
  useEffect(() => {
    let m = document.querySelector('meta[name="robots"]');
    if (!m) {
      m = document.createElement("meta");
      m.name = "robots";
      document.head.appendChild(m);
    }
    const prev = m.content;
    m.content = "noindex,nofollow";
    document.title = "Research Mode";
    return () => {
      m.content = prev;
    };
  }, []);

  useEffect(() => {
    if (unlocked) fetchStats();
  }, [unlocked, fetchStats]);

  const search = async (e) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setSearching(true);
    setActiveQuery(query);
    setResults(null);
    setAnswer("");
    try {
      const payload = { query, limit: 30 };
      if (entity !== "all") payload.entity = entity;
      if (source !== "all") payload.source = source;
      const r = await apiClient.post("/research/search", payload);
      setResults(r.data.results || []);
      setAnswer(r.data.answer || "");
    } catch (e) {
      toast.error("Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Gate active — password required.
  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />;

  return (
    <div
      className="min-h-screen bg-[#06050a] text-white relative"
      data-testid="research-page"
    >
      {/* ambient amber blooms */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-[-200px] right-[-180px] w-[640px] h-[640px] rounded-full opacity-[0.18]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,176,82,0.55) 0%, rgba(0,0,0,0) 60%)",
          }}
        />
        <div
          className="absolute bottom-[-300px] left-[-200px] w-[600px] h-[600px] rounded-full opacity-[0.12]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,90,40,0.45) 0%, rgba(0,0,0,0) 60%)",
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <Link
              to="/vineyard"
              data-testid="research-back-vineyard"
              className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 hover:text-white/70"
            >
              ← Vineyard Scraper
            </Link>
            <h1 className="mt-3 text-3xl md:text-5xl font-light tracking-tight">
              Research Mode
            </h1>
            <p className="mt-2 text-white/50 text-sm font-mono tracking-wider">
              <span className="text-amber-300/80">PRIVATE WORKSPACE</span>
              {" · "}
              isolated corpus
            </p>
          </div>
        </div>

        {/* metrics */}
        <MetricStrip stats={stats} onRefresh={fetchStats} refreshing={refreshingStats} />

        {/* Research tools — always visible, no password gate */}
        <div className="mt-4 space-y-4">
          <AddSource onAfterAction={fetchStats} />
          <ResearchTools onAfterAction={fetchStats} />
        </div>

        {/* tabs: Search · Saved */}
        <div
          className="mt-7 flex items-center gap-1 border-b border-white/10"
          data-testid="research-tabs"
        >
          {[
            { id: "search", label: "Search", icon: FileSearch },
            { id: "browse", label: "Browse sources", icon: FolderOpen },
            { id: "saved", label: `Saved · ${savedDocs.length}`, icon: Bookmark },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                data-testid={`research-tab-${t.id}`}
                className={`px-4 py-3 text-[12px] font-mono uppercase tracking-[0.18em] transition border-b-2 -mb-px ${
                  active
                    ? "text-amber-200 border-amber-300"
                    : "text-white/45 border-transparent hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5 inline mr-1.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "search" && (
          <>
        {/* search bar */}
        <form onSubmit={search} className="mt-7" data-testid="research-search-form">
          <div className="rounded-xl border border-white/15 bg-black/40 backdrop-blur p-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-white/40 ml-2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask the research corpus…"
              data-testid="research-search-input"
              className="flex-1 border-0 bg-transparent text-white placeholder:text-white/30 h-11 focus-visible:ring-0"
            />
            <Button
              type="submit"
              disabled={searching || !q.trim()}
              data-testid="research-search-submit"
              className="h-10 bg-amber-300 hover:bg-amber-200 text-black px-5"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileSearch className="h-4 w-4 mr-1.5" /> Search
                </>
              )}
            </Button>
          </div>

          {/* filter chips */}
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35 self-center">
              entity
            </span>
            {ENTITY_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setEntity(o.id)}
                data-testid={`research-entity-${o.id}`}
                className={`text-[11px] font-mono uppercase tracking-[0.18em] px-2.5 py-1 rounded border transition ${
                  entity === o.id
                    ? "bg-amber-300 text-black border-amber-300"
                    : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35 self-center">
              source
            </span>
            {SOURCE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSource(o.id)}
                data-testid={`research-source-${o.id}`}
                className={`text-[11px] font-mono uppercase tracking-[0.18em] px-2.5 py-1 rounded border transition ${
                  source === o.id
                    ? "bg-white/85 text-black border-white"
                    : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </form>

        {/* AI answer */}
        {answer && (
          <div
            className="mt-7 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-5"
            data-testid="research-answer"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300/85 mb-2">
              Wood AI · Research analyst
            </div>
            <p className="text-white/90 leading-relaxed">{answer}</p>
          </div>
        )}

        {/* results */}
        {results && (
          <div className="mt-6 space-y-3" data-testid="research-results">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/45">
                {results.length} result{results.length === 1 ? "" : "s"}
                {activeQuery && <span className="text-white/30"> · for “{activeQuery}”</span>}
              </div>
              {selected.size > 0 && (
                <div className="flex gap-2 flex-wrap justify-end">
                  {selected.size >= 2 && (
                    <button
                      type="button"
                      onClick={openCompare}
                      data-testid="research-compare-btn"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-amber-300/40 text-amber-200 text-[12px] font-medium hover:bg-amber-300/10"
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      Compare 2
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    data-testid="research-open-drawer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-300 text-black text-[12px] font-medium hover:bg-amber-200"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {selected.size} selected · review
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {results.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-white/40 text-sm">
                No matching documents in the research corpus.
              </div>
            )}
            {results.map((r) => (
              <ResultCard
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onToggle={toggleSelect}
                onSavedChange={refreshSaved}
                onOpen={async (row) => {
                  // fetch full doc
                  try {
                    const resp = await apiClient.get(`/research/document/${row.id}`);
                    setOpenDoc(resp.data);
                  } catch (_) {
                    setOpenDoc(row);
                  }
                }}
              />
            ))}
          </div>
        )}

        {!results && !searching && (
          <div className="mt-10 rounded-xl border border-dashed border-white/10 p-10 text-center text-white/45">
            <FileSearch className="h-8 w-8 mx-auto text-white/30 mb-3" />
            <div className="text-sm">
              Search the research corpus to begin.
            </div>
          </div>
        )}
          </>
        )}

        {tab === "browse" && (
          <SourceExplorer
            onOpenDoc={async (row) => {
              try {
                const resp = await apiClient.get(`/research/document/${row.id}`);
                setOpenDoc(resp.data);
              } catch (_) {
                setOpenDoc(row);
              }
            }}
          />
        )}

        {tab === "saved" && (
          <div className="mt-6 space-y-3" data-testid="research-saved-tab">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/45">
                {savedDocs.length} saved document{savedDocs.length === 1 ? "" : "s"}
              </div>
              {savedDocs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all saved documents?")) {
                      clearAllSaved();
                      refreshSaved();
                      toast.success("Cleared");
                    }
                  }}
                  data-testid="research-saved-clear"
                  className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/45 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" /> clear all
                </button>
              )}
            </div>
            {savedDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/45">
                <Bookmark className="h-8 w-8 mx-auto text-white/30 mb-3" />
                <div className="text-sm">
                  Save documents from search results — they'll appear here on this device.
                </div>
              </div>
            ) : (
              savedDocs.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
                  data-testid={`research-saved-${row.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/70">
                      {row.entity}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                      {row.source}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                      {row.doc_type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const resp = await apiClient.get(`/research/document/${row.id}`);
                        setOpenDoc(resp.data);
                      } catch (_) {
                        toast.error("Document not found in current corpus");
                      }
                    }}
                    className="text-left text-white text-[15px] leading-snug font-medium hover:text-amber-200"
                  >
                    {row.title}
                  </button>
                  {row.snippet && (
                    <div
                      className="mt-2 text-white/55 text-[12.5px] leading-relaxed line-clamp-2 research-snippet"
                      dangerouslySetInnerHTML={{ __html: row.snippet }}
                    />
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-white/40">
                    <span>saved {new Date(row.saved_at).toLocaleDateString()}</span>
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        <ExternalLink className="h-3 w-3" /> source
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        removeSavedDoc(row.id);
                        refreshSaved();
                        toast.success("Removed");
                      }}
                      data-testid={`research-saved-remove-${row.id}`}
                      className="ml-auto inline-flex items-center gap-1 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" /> remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-16 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.25em] text-white/30">
          <span>Powered by Jwood Technologies</span>
          <span>Database isolated · separate from /vineyard</span>
        </div>
      </div>

      {/* selection drawer */}
      {drawerOpen && (
        <SelectionDrawer
          selected={selected}
          allRows={results || []}
          onClose={() => setDrawerOpen(false)}
          onClearAll={() => {
            setSelected(new Set());
            setDrawerOpen(false);
          }}
        />
      )}

      {/* compare view */}
      {compareIds && (
        <CompareView
          docIds={compareIds}
          onClose={() => setCompareIds(null)}
        />
      )}

      {/* doc modal */}
      {openDoc && <DocModal doc={openDoc} onClose={() => setOpenDoc(null)} />}

      {/* highlight style */}
      <style>{`
        .research-snippet mark {
          background: rgba(255, 200, 90, 0.28);
          color: #ffd699;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default Research;
