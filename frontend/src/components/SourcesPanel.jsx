import { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  Plus,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Lock as LockIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";

/* SourcesPanel — read-only archive transparency.
   - Shows what is currently in the searchable archive.
   - Allows adding NEW sources (background crawl, becomes searchable
     when indexing finishes).
   - NO re-crawl / remove / last-crawled / admin controls — once a
     source is archived it is treated as permanent. */

export const SourcesPanel = ({ open, onClose, onSourceIndexed }) => {
  const [data, setData] = useState({
    sources: [],
    total_indexed: 0,
    active_version: "",
  });
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/vineyard/sources/status");
      setData(data);
      onSourceIndexed?.(data);
    } catch {
      /* swallow */
    }
  }, [onSourceIndexed]);

  // Initial load + ESC to close
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, refresh]);

  // Quiet poll every 5 s while ANY source is `crawling` so newly added
  // sources tick over to "Indexed" automatically.
  useEffect(() => {
    if (!open) return;
    const anyCrawling = data.sources.some((s) => s.status === "crawling");
    if (!anyCrawling) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (!pollRef.current) {
      pollRef.current = setInterval(refresh, 5000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, data.sources, refresh]);

  const submitAdd = async (e) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\/.+/i.test(u)) {
      toast.error("Please enter a valid URL.");
      return;
    }
    setAdding(true);
    try {
      await apiClient.post("/vineyard/sources", {
        url: u,
        label: label.trim(),
      });
      toast.success("Source added — indexing in background.");
      setUrl("");
      setLabel("");
      refresh();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) toast.error("That source is already in the archive.");
      else if (status === 400)
        toast.error(err.response.data?.detail || "Invalid URL.");
      else toast.error("Source could not be added.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-[#06070d] border-l border-white/10 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        data-testid="sources-panel"
        aria-hidden={!open}
      >
        <header className="px-6 py-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/45">
              Archive · permanent index
            </div>
            <div className="text-white text-xl font-medium mt-1">
              {data.total_indexed.toLocaleString()} documents
            </div>
            <div className="text-[12px] text-white/50 mt-0.5">
              across {data.sources.length} source
              {data.sources.length === 1 ? "" : "s"}
            </div>
          </div>
          <button
            className="text-white/60 hover:text-white"
            onClick={onClose}
            aria-label="Close sources panel"
            data-testid="sources-close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Source list — read-only (Add Source moved to Research Mode) */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-2">
          {loading && data.sources.length === 0 && (
            <div className="text-white/55 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading archive…
            </div>
          )}
          {data.sources.length === 0 && !loading && (
            <div className="text-white/45 text-sm text-center py-12">
              The Vineyard archive is locked. Use Research Mode to add new
              sources.
            </div>
          )}
          {data.sources.map((s) => (
            <SourceRow key={s.id} source={s} />
          ))}
        </div>
      </aside>
    </>
  );
};

const SourceRow = ({ source: s }) => {
  const indexing = s.status === "crawling";
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5"
      data-testid={`source-card-${s.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-white font-medium truncate text-[14.5px]">
            {s.display_name}
          </div>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] text-white/40 hover:text-white/75 break-all inline-flex items-start gap-1 mt-0.5"
          >
            {s.url}
            <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
          </a>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap shrink-0 ${
            indexing
              ? "bg-blue-500/15 text-blue-200 border-blue-400/20"
              : "bg-emerald-500/10 text-emerald-200 border-emerald-400/20"
          }`}
        >
          {indexing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          {indexing ? "Indexing" : "Archived"}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
        <span className="text-white/55">
          {s.indexed_count.toLocaleString()} document
          {s.indexed_count === 1 ? "" : "s"} indexed
        </span>
        <span className="inline-flex items-center gap-1 text-white/30">
          <LockIcon className="h-2.5 w-2.5" />
          permanent
        </span>
      </div>
    </div>
  );
};

export default SourcesPanel;
