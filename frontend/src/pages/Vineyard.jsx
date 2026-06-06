import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Lock,
  Loader2,
  ExternalLink,
  FileText,
  RotateCw,
  ShieldAlert,
  Database,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  BookmarkCheck,
  Layers,
  History,
  Trash2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import {
  saveCitation,
  removeByUrl,
  isSaved,
  listSaved,
} from "@/lib/savedStore";
import {
  listRecent,
  pushRecent,
  clearRecent,
} from "@/lib/recentSearches";
import SavedPanel from "@/components/SavedPanel";
import SourcesPanel from "@/components/SourcesPanel";
import ShareMenu from "@/components/ShareMenu";

// ---------------------------------------------------------------------------
// Vineyard unlock state lives in sessionStorage:
//   - Survives page refresh + same-tab navigation.
//   - Cleared when the browser/tab is fully closed.
const UNLOCK_KEY = "vineyard_unlocked";

const TITLE = "Vineyard Scraper";
const useTypingTitle = () => {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(TITLE.slice(0, i));
      if (i >= TITLE.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 75);
    return () => clearInterval(id);
  }, []);
  return { typed, done };
};

// ---------------------------------------------------------------------------
const PasswordGate = ({ onUnlock }) => {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { typed, done: typingDone } = useTypingTitle();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      await apiClient.post("/vineyard/auth", { password: pw });
      try {
        sessionStorage.setItem(UNLOCK_KEY, "1");
      } catch {
        /* ignore quota */
      }
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
      data-testid="vineyard-gate"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] uppercase text-white/45">
          <Lock className="h-3.5 w-3.5" />
          Research Tool
        </div>
        <h1
          className="text-4xl md:text-5xl font-light tracking-tight text-white"
          data-testid="vineyard-gate-title"
        >
          {typed || "\u00A0"}
          {!typingDone && <span className="typing-caret" />}
        </h1>
        <p className="mt-3 text-white/55 text-sm leading-relaxed">
          Enter your access password to continue.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <Label
            htmlFor="vy-pw"
            className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/55"
          >
            Access password
          </Label>
          <Input
            id="vy-pw"
            type="password"
            autoFocus
            data-testid="vineyard-password-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="input-premium h-12 rounded-lg font-mono"
            placeholder="••••"
          />
          {err && (
            <p
              className="text-sm text-red-400 font-mono"
              data-testid="vineyard-password-error"
            >
              {err}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading || !pw}
            className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-lg"
            data-testid="vineyard-password-submit"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Enter Vineyard Scraper"
            )}
          </Button>
        </form>

        <p className="mt-10 text-[11px] text-white/30 leading-relaxed font-mono">
          This is a privately developed research tool using publicly available
          municipal documents. It is not an official City of Vineyard website
          and does not provide legal advice.
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const Vineyard = () => {
  const { typed, done: typingDone } = useTypingTitle();

  // Search state — single-flow: AI Answer + Citations + Paginated all-pages.
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  // Paginated "all pages where this term appears" — fetched in parallel.
  const [allPages, setAllPages] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");
  const PAGE_SIZE = 20;

  // Filters — applied on next search (and the next page-fetch).
  // sourceFilter uses the source_id (or "all"); the chip row populates
  // dynamically from /sources/status so new sources auto-appear.
  const [sourceFilter, setSourceFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all"); // all|resolution|ordinance|minutes|agenda|attachment|transparency
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filterPayload = useCallback(
    (extras = {}) => {
      const p = { ...extras };
      if (sourceFilter !== "all") p.source_id = sourceFilter;
      if (docTypeFilter !== "all") p.doc_type = docTypeFilter;
      if (dateFrom) p.date_from = dateFrom;
      if (dateTo) p.date_to = dateTo;
      return p;
    },
    [sourceFilter, docTypeFilter, dateFrom, dateTo]
  );


  // Permanent stored index status — single read of the prebuilt index.
  // No polling, no crawl checks, no bootstrap. Cached in sessionStorage so
  // the badge never flickers to 0 between tab refreshes.
  const [status, setStatus] = useState(() => {
    try {
      const raw = sessionStorage.getItem("vineyard_status");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { total_docs: 0, ready: false };
  });

  // Saved
  const [savedCount, setSavedCount] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [recent, setRecent] = useState(() => listRecent());
  const [recentOpen, setRecentOpen] = useState(false);
  // Dynamic source chips — populated from /vineyard/sources/status so any
  // newly added/indexed source automatically appears in the filter row.
  const [archiveSources, setArchiveSources] = useState([]);
  const refreshSavedCount = useCallback(() => {
    setSavedCount(listSaved().length);
  }, []);

  const loadArchiveSources = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/vineyard/sources/status");
      setArchiveSources(data.sources || []);
    } catch {
      /* swallow — leave previous list in place */
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    loadArchiveSources();
  }, [unlocked, loadArchiveSources]);

  useEffect(() => {
    refreshSavedCount();
  }, [refreshSavedCount]);

  // noindex meta + title
  useEffect(() => {
    document.title = "Vineyard Scraper";
    let m = document.querySelector('meta[name="robots"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "robots");
      document.head.appendChild(m);
    }
    m.setAttribute("content", "noindex,nofollow,noarchive,nosnippet");
    return () => {
      if (m) m.setAttribute("content", "index,follow");
      document.title = "Jwood Technologies";
    };
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/vineyard/search-ready");
      setStatus(data);
      try {
        sessionStorage.setItem("vineyard_status", JSON.stringify(data));
      } catch {
        /* ignore quota */
      }
    } catch {
      /* swallow — keep last known cached status */
    }
  }, []);

  // Single read on unlock. The permanent stored index never reloads,
  // never rebuilds, never animates a count.
  useEffect(() => {
    if (!unlocked) return;
    loadStatus();
  }, [unlocked, loadStatus]);

  const fetchAllPages = useCallback(
    async (query, page) => {
      setLoadingPage(true);
      try {
        const { data } = await apiClient.post(
          `/vineyard/search-all?page=${page}&limit=${PAGE_SIZE}`,
          filterPayload({ query })
        );
        setAllPages(data);
        setPageNum(page);
      } catch {
        setAllPages({ total: 0, page, limit: PAGE_SIZE, results: [] });
      } finally {
        setLoadingPage(false);
      }
    },
    [filterPayload]
  );

  const run = async (override) => {
    const query = (override ?? q).trim();
    if (!query) return;
    setSearching(true);
    setResult(null);
    setAllPages(null);
    setPageNum(1);
    setActiveQuery(query);
    setRecentOpen(false);
    setRecent(pushRecent(query));
    try {
      const [searchRes] = await Promise.all([
        apiClient.post("/vineyard/search", filterPayload({ query })),
        fetchAllPages(query, 1),
      ]);
      setResult(searchRes.data);
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  // When filters change AFTER a search is active, re-run automatically so
  // the user sees an instant slice of the archive.
  useEffect(() => {
    if (!activeQuery) return;
    const handle = setTimeout(() => {
      run(activeQuery);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, docTypeFilter, dateFrom, dateTo]);

  const reset = () => {
    setQ("");
    setResult(null);
    setAllPages(null);
    setPageNum(1);
    setActiveQuery("");
    setSourceFilter("all");
    setDocTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const goToPage = (n) => {
    if (!activeQuery) return;
    fetchAllPages(activeQuery, n);
    // Smooth-scroll to the all-pages section
    setTimeout(() => {
      document
        .getElementById("vineyard-all-pages")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };


  return (
    <div
      className="min-h-screen bg-[#06070d] text-white flex flex-col"
      data-testid="vineyard-page"
    >
      <SavedPanel
        open={savedOpen}
        onClose={() => {
          setSavedOpen(false);
          refreshSavedCount();
        }}
      />
      <SourcesPanel
        open={sourcesOpen}
        onClose={() => {
          setSourcesOpen(false);
          loadStatus();
        }}
        onSourceIndexed={(data) => setArchiveSources(data?.sources || [])}
      />

      <header className="border-b border-white/5 bg-[#04050a] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-white/5 border border-white/10 grid place-items-center shrink-0">
              <Database className="h-4 w-4 text-white/80" />
            </div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/45 truncate">
              Research Tool
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSourcesOpen(true)}
              className="border-white/15 bg-transparent text-white hover:bg-white/5 h-9"
              data-testid="open-sources"
            >
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Sources
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSavedOpen(true)}
              className="border-white/15 bg-transparent text-white hover:bg-white/5 h-9"
              data-testid="open-saved"
            >
              <Bookmark className="h-3.5 w-3.5 mr-1.5" />
              Saved
              {savedCount > 0 && (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-[10px] font-mono">
                  {savedCount}
                </span>
              )}
            </Button>
            <Link
              to="/research"
              data-testid="vineyard-open-research"
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-300/40 bg-amber-300/[0.06] text-amber-200 hover:bg-amber-300/15 px-3 text-[12px] font-medium transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Research Mode
            </Link>
            <Link
              to="/research"
              data-testid="vineyard-open-research-mobile"
              aria-label="Research Mode"
              className="sm:hidden h-9 w-9 inline-flex items-center justify-center rounded-md border border-amber-300/40 bg-amber-300/[0.06] text-amber-200 hover:bg-amber-300/15"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 w-full">
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3 sm:p-4 text-amber-100/85"
          data-testid="vineyard-disclaimer"
        >
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-[12px] sm:text-[12.5px] leading-relaxed">
            This is a privately developed research tool using publicly available
            municipal documents. It is not an official City of Vineyard website
            and does not provide legal advice.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-8 w-full flex-1">
        {!result && (
          <div className="space-y-3 mb-6">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter text-white"
              data-testid="vineyard-title"
            >
              {typed || "\u00A0"}
              {!typingDone && <span className="typing-caret" />}
            </h1>
            <p className="text-white/55 text-sm pt-1">
              Powered by Wood AI · Citations only · Refuses to answer when no
              source is found.
            </p>
            {status.ready && status.total_docs > 0 && (
              <div
                className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.18em] uppercase text-emerald-300/75"
                data-testid="index-ready-indicator"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                Index ready · {status.total_docs.toLocaleString()} documents loaded
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end mb-3 gap-2">
          {recent.length > 0 && (
            <button
              type="button"
              onClick={() => setRecentOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/75"
              data-testid="recent-toggle"
            >
              <History className="h-3 w-3" />
              Recent
            </button>
          )}
        </div>

        {recentOpen && recent.length > 0 && (
          <div
            className="mb-3 rounded-xl border border-white/10 bg-[#0a0c14] p-3"
            data-testid="recent-panel"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-white/45">
                Recent searches
              </span>
              <button
                type="button"
                onClick={() => {
                  clearRecent();
                  setRecent([]);
                  setRecentOpen(false);
                }}
                className="text-[11px] text-white/45 hover:text-white inline-flex items-center gap-1"
                data-testid="recent-clear"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r.q}
                  type="button"
                  onClick={() => {
                    setQ(r.q);
                    run(r.q);
                  }}
                  className="rounded-full bg-white/[0.04] hover:bg-white/[0.10] border border-white/10 text-white/85 text-[12px] px-3 py-1 transition-colors"
                  data-testid={`recent-${r.q.slice(0, 16)}`}
                >
                  {r.q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="relative"
          data-testid="vineyard-search-form"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/45" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Where is the 75% parking permit requirement?"
            className="input-premium h-14 pl-12 pr-28 sm:pr-32 rounded-xl text-base"
            data-testid="vineyard-search-input"
          />
          <Button
            type="submit"
            disabled={searching || !q.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-4 sm:px-5 bg-white text-black hover:bg-white/90 rounded-lg"
            data-testid="vineyard-search-submit"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        {/* Filter chips — only visible after a search has run. They re-run
            the query automatically when changed so the user sees results
            update in place without retyping. */}
        {(result || searching) && (
          <FiltersBar
            sources={archiveSources}
            sourceId={sourceFilter}
            onSource={setSourceFilter}
            docType={docTypeFilter}
            onDocType={setDocTypeFilter}
            dateFrom={dateFrom}
            onDateFrom={setDateFrom}
            dateTo={dateTo}
            onDateTo={setDateTo}
            onClear={() => {
              setSourceFilter("all");
              setDocTypeFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          />
        )}

        {!result && !searching && status.ready && (
          <div
            className="grid sm:grid-cols-2 gap-3 pt-5"
            data-testid="suggested-queries"
          >
            {[
              "What does the code say about towing?",
              "Find the parking permit policy from 2021.",
              "What resolution created the residential parking permit program?",
              "Where is the 75% parking permit requirement?",
            ].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQ(s);
                  run(s);
                }}
                className="group flex items-center justify-between gap-3 text-left rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                data-testid={`suggested-${s.slice(0, 12)}`}
              >
                <span className="text-sm text-white/75">{s}</span>
                <ChevronRight className="h-4 w-4 text-white/35 group-hover:text-white/70 transition-colors" />
              </button>
            ))}
          </div>
        )}

        {searching && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-white/60 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching the index…
          </div>
        )}

        {result && (
          <div className="space-y-5 mt-6" data-testid="vineyard-results">
            <div className="rounded-2xl border border-white/10 bg-[#0a0c14] p-6">
              <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/45 mb-3">
                Wood AI Answer
              </div>
              <p className="text-white/90 whitespace-pre-wrap leading-relaxed">
                {result.answer}
              </p>
            </div>

            {result.citations?.length > 0 && (
              <div className="space-y-3" data-testid="citations-list">
                <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/45">
                  Sources
                </div>
                {result.citations.map((c, i) => (
                  <CitationCard
                    key={c.url + i}
                    citation={c}
                    index={i}
                    onSavedChange={refreshSavedCount}
                  />
                ))}
              </div>
            )}

            <AllPagesSection
              data={allPages}
              page={pageNum}
              loading={loadingPage}
              onPage={goToPage}
              query={activeQuery}
            />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={() => run()}
                variant="outline"
                className="border-white/15 bg-transparent text-white hover:bg-white/5"
                data-testid="vineyard-retry"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Retry search
              </Button>
              <Button
                onClick={reset}
                className="bg-white text-black hover:bg-white/90"
                data-testid="vineyard-new-search"
              >
                <Search className="h-4 w-4 mr-2" />
                New search
              </Button>
            </div>
          </div>
        )}

        <div
          className="mt-12 flex items-center justify-between text-[11px] font-mono tracking-[0.2em] uppercase text-white/35 flex-wrap gap-2"
          data-testid="index-meta"
        >
          <span>
            {status.total_docs.toLocaleString()} chunk
            {status.total_docs === 1 ? "" : "s"} indexed
          </span>
          <span>Permanent stored index</span>
        </div>
      </main>

      <footer
        className="mt-auto border-t border-white/5 py-5 sm:py-6"
        data-testid="vineyard-footer"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 flex items-center justify-center">
          <Link
            to="/"
            className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/30 hover:text-white/70 transition-colors"
            data-testid="powered-by-jwood"
          >
            Powered by Jwood Technologies
          </Link>
        </div>
      </footer>
    </div>
  );
};

// ---------------------------------------------------------------------------
const CitationCard = ({ citation: c, index: i, onSavedChange }) => {
  const [saved, setSaved] = useState(() => isSaved(c.url));

  // Auto-detect PDF: backend may surface `pdf_url`, but many municipal
  // sources serve direct .pdf links via the regular `url` field. Treat
  // both as PDFs so the user always gets a one-click download button.
  const looksLikePdf = (u = "") => /\.pdf(\?|$)/i.test(u);
  const pdfHref = c.pdf_url || (looksLikePdf(c.url) ? c.url : null);

  const toggleSave = () => {
    if (saved) {
      removeByUrl(c.url);
      setSaved(false);
      toast.success("Removed from saved.");
    } else {
      saveCitation(c);
      setSaved(true);
      toast.success("Saved to this device.");
    }
    onSavedChange?.();
  };

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.035] transition-colors"
      data-testid={`citation-${i}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Title is the primary call-to-action — one click opens source */}
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-white font-medium break-words hover:underline decoration-white/30 underline-offset-4 inline-flex items-start gap-1.5 group"
            data-testid={`citation-title-${i}`}
          >
            {c.title}
            <ExternalLink className="h-3.5 w-3.5 mt-1 shrink-0 text-white/35 group-hover:text-white/85 transition-colors" />
          </a>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-mono text-white/80">
              {c.source_label || "Source"}
            </span>
            {c.section_ref && (
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-mono text-white/80">
                {c.section_ref}
              </span>
            )}
            {pdfHref && (
              <span className="rounded bg-rose-500/15 text-rose-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                PDF
              </span>
            )}
          </div>
        </div>
        <button
          onClick={toggleSave}
          className={`shrink-0 p-2 rounded-md border transition-colors ${
            saved
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-white/10 text-white/60 hover:text-white hover:bg-white/5"
          }`}
          aria-label={saved ? "Unsave" : "Save"}
          title={saved ? "Saved" : "Save"}
          data-testid={`citation-save-${i}`}
        >
          {saved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="mt-3 text-sm text-white/70 leading-relaxed line-clamp-3">
        “{c.excerpt}”
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-white/90 transition-colors"
          data-testid={`citation-source-${i}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open link
        </a>
        {pdfHref && (
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer noopener"
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/25 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 transition-colors"
            data-testid={`citation-pdf-${i}`}
          >
            <FileText className="h-3.5 w-3.5" />
            Open PDF
          </a>
        )}
        <div className="ml-auto">
          <ShareMenu
            title={c.title}
            url={c.url}
            excerpt={c.excerpt}
            sectionRef={c.section_ref}
            testid={`citation-share-${i}`}
          />
        </div>
      </div>
    </div>
  );
};

export default Vineyard;

// ---------------------------------------------------------------------------
// FiltersBar — appears above the AI summary after a search has been run.
// Source chips are populated dynamically from the archive — adding a new
// source via the Sources panel automatically yields a new chip.
const DOCTYPE_CHIPS = [
  { id: "all", label: "Any type" },
  { id: "resolution", label: "Resolutions" },
  { id: "ordinance", label: "Ordinances" },
  { id: "minutes", label: "Minutes" },
  { id: "agenda", label: "Agendas" },
  { id: "attachment", label: "Attachments" },
  { id: "transparency", label: "Transparency" },
];

const Chip = ({ active, onClick, children, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`px-3 py-1 rounded-full text-[12px] font-mono tracking-wide whitespace-nowrap transition-colors border ${
      active
        ? "bg-white text-black border-white"
        : "bg-white/[0.02] text-white/70 border-white/10 hover:bg-white/[0.06] hover:text-white"
    }`}
  >
    {children}
  </button>
);

const FiltersBar = ({
  sources,
  sourceId,
  onSource,
  docType,
  onDocType,
  dateFrom,
  onDateFrom,
  dateTo,
  onDateTo,
  onClear,
}) => {
  const hasActive =
    sourceId !== "all" || docType !== "all" || dateFrom || dateTo;
  return (
    <div
      className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3"
      data-testid="filters-bar"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-white/40 mr-1">
          Source
        </span>
        <Chip
          active={sourceId === "all"}
          onClick={() => onSource("all")}
          testid="source-chip-all"
        >
          All sources
        </Chip>
        {(sources || []).map((s) => (
          <Chip
            key={s.id}
            active={sourceId === s.id}
            onClick={() => onSource(s.id)}
            testid={`source-chip-${s.id}`}
          >
            {s.display_name}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-white/40 mr-1">
          Type
        </span>
        {DOCTYPE_CHIPS.map((c) => (
          <Chip
            key={c.id}
            active={docType === c.id}
            onClick={() => onDocType(c.id)}
            testid={`doctype-chip-${c.id}`}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-white/40 mr-1">
          Date
        </span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFrom(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[12px] text-white/85 font-mono focus:outline-none focus:ring-1 focus:ring-white/30"
          placeholder="From"
          data-testid="filter-date-from"
        />
        <span className="text-white/40 text-xs">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateTo(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[12px] text-white/85 font-mono focus:outline-none focus:ring-1 focus:ring-white/30"
          placeholder="To"
          data-testid="filter-date-to"
        />
        {hasActive && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-[11px] font-mono text-white/55 hover:text-white underline-offset-4 hover:underline"
            data-testid="filters-clear"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AllPagesSection — paginated list of every page where the search term
// appears. Sits below the AI Answer + top citations, gives the user the
// full discovery experience without leaving the page.
const SITE_BADGE_CLS = {
  civicclerk: "bg-blue-500/15 text-blue-200",
  municode: "bg-emerald-500/15 text-emerald-200",
  vineyardutah: "bg-orange-500/15 text-orange-200",
  rda: "bg-purple-500/15 text-purple-200",
  other: "bg-white/10 text-white/70",
};

const AllPagesSection = ({ data, page, loading, onPage, query }) => {
  if (!data && !loading) return null;

  const total = data?.total || 0;
  const limit = data?.limit || 20;
  const results = data?.results || [];
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  return (
    <div
      id="vineyard-all-pages"
      className="space-y-3 pt-4 border-t border-white/5"
      data-testid="all-pages-section"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/45">
          All Pages with “{query}”
        </div>
        {total > 0 && (
          <div className="text-[11px] font-mono text-white/35">
            {start.toLocaleString()}–{end.toLocaleString()} of{" "}
            {total.toLocaleString()}
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-white/55 flex items-center gap-2 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading page {page}…
        </div>
      )}

      {!loading && results.length === 0 && total === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-white/45 text-sm">
          No additional pages matched.
        </div>
      )}

      {!loading &&
        results.map((r) => <RawResultRow key={r.id} row={r} />)}

      {total > limit && (
        <div
          className="flex items-center justify-between pt-2"
          data-testid="all-pages-pagination"
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/0 px-3 py-1.5 text-xs text-white/85 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="all-pages-prev"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <div className="text-[11px] font-mono text-white/45">
            Page {page} / {totalPages}
          </div>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPage(page + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/0 px-3 py-1.5 text-xs text-white/85 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="all-pages-next"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

const SiteBadge = ({ site }) => {
  const cls = SITE_BADGE_CLS[site] || SITE_BADGE_CLS.other;
  const label =
    {
      civicclerk: "CivicClerk",
      municode: "Municode",
      vineyardutah: "Vineyard Utah",
      rda: "RDA",
    }[site] || "Source";
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
};

const RawResultRow = ({ row }) => {
  const looksLikePdf = (u = "") => /\.pdf(\?|$)/i.test(u);
  const pdfHref = row.pdf_url || (looksLikePdf(row.url) ? row.url : null);
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
      data-testid={`raw-result-${row.id}`}
    >
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-white text-[14px] font-medium break-words hover:underline decoration-white/30 underline-offset-4 inline-flex items-start gap-1.5 group"
      >
        {row.title}
        <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-white/35 group-hover:text-white/85 transition-colors" />
      </a>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <SiteBadge site={row.source_site} />
        {row.section_ref && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10.5px] font-mono text-white/75">
            {row.section_ref}
          </span>
        )}
        {row.meeting_date && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10.5px] font-mono text-white/75">
            {row.meeting_date}
          </span>
        )}
        {pdfHref && (
          <span className="rounded bg-rose-500/15 text-rose-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
            PDF
          </span>
        )}
      </div>
      <p
        className="mt-2 text-sm text-white/65 leading-relaxed line-clamp-3 vineyard-snippet"
        dangerouslySetInnerHTML={{ __html: row.snippet || "" }}
      />
      <div className="mt-2 flex justify-end">
        <ShareMenu
          title={row.title}
          url={row.url}
          excerpt={(row.snippet || "").replace(/<[^>]+>/g, "").slice(0, 280)}
          sectionRef={row.section_ref}
          testid={`raw-share-${row.id}`}
        />
      </div>
    </div>
  );
};

