import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";

// Paste a URL, it gets crawled and indexed into research_documents.
// Shows a live list with status: indexing · archived · failed.

const StatusBadge = ({ status }) => {
  const map = {
    indexing: { icon: Clock, text: "Indexing", cls: "text-amber-200 border-amber-300/40 bg-amber-300/[0.05]" },
    archived: { icon: CheckCircle2, text: "Archived", cls: "text-emerald-300 border-emerald-300/30 bg-emerald-400/[0.05]" },
    failed: { icon: XCircle, text: "Failed", cls: "text-red-300 border-red-400/30 bg-red-400/[0.04]" },
  };
  const m = map[status] || map.indexing;
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 rounded border ${m.cls}`}
      data-testid={`add-source-status-${status}`}
    >
      <Icon className="h-3 w-3" />
      {m.text}
    </span>
  );
};

const AddSource = ({ onAfterAction }) => {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await apiClient.get("/research/sources");
      setSources(r.data?.sources || []);
    } catch (_) {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Poll while any row is still "indexing"
  useEffect(() => {
    const indexing = sources.some((s) => s.status === "indexing");
    if (!indexing) return;
    const t = setInterval(fetchSources, 2500);
    return () => clearInterval(t);
  }, [sources, fetchSources]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("Enter a valid http(s) URL");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/research/sources", {
        url: trimmed,
        label: label.trim(),
      });
      toast.success("Indexing — this usually takes a few seconds");
      setUrl("");
      setLabel("");
      fetchSources();
      onAfterAction?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add source");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this source and all its indexed content?")) return;
    try {
      await apiClient.delete(`/research/sources/${id}`);
      toast.success("Removed");
      fetchSources();
      onAfterAction?.();
    } catch (e) {
      toast.error("Remove failed");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-4" data-testid="research-add-source">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-white/45">
        <Plus className="h-3.5 w-3.5" /> Add source (link or URL)
      </div>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.gov/records/filing.pdf"
          data-testid="research-add-source-url"
          className="flex-1 h-10 bg-black/40 border-white/15 text-white text-sm"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          data-testid="research-add-source-label"
          className="sm:w-56 h-10 bg-black/40 border-white/15 text-white text-sm"
        />
        <Button
          type="submit"
          disabled={busy || !url.trim()}
          data-testid="research-add-source-submit"
          className="h-10 bg-amber-300 text-black hover:bg-amber-200 px-4"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <><Plus className="h-4 w-4 mr-1" /> Add</>
          )}
        </Button>
      </form>

      {(loadingList || sources.length > 0) && (
        <div className="space-y-2" data-testid="research-source-list">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
            {sources.length} archived source{sources.length === 1 ? "" : "s"}
          </div>
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2"
              data-testid={`research-source-row-${s.id}`}
            >
              <StatusBadge status={s.status} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white/85 truncate">{s.label || s.url}</div>
                <div className="text-[11px] font-mono text-white/35 truncate flex items-center gap-2">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> {s.url}
                  </a>
                  {s.indexed_count > 0 && (
                    <span>· {s.indexed_count} chunks</span>
                  )}
                </div>
                {s.status === "failed" && s.last_error && (
                  <div className="text-[10px] text-red-300/80 font-mono mt-0.5 line-clamp-1">
                    {s.last_error}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                data-testid={`research-source-remove-${s.id}`}
                className="text-white/40 hover:text-red-300"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddSource;
