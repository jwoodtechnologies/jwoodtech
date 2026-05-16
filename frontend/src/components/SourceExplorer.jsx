import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ChevronLeft,
  Search,
  Filter,
  ExternalLink,
  X,
  Database,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import ResearchActions from "@/components/ResearchActions";

// Visual label maps — matches the chips used in the main Research page.
const SOURCE_LABELS = {
  rda_xlsx: "RDA Past Meetings",
  pacificorp_csv: "PacifiCorp Appeals",
  proservices_xlsx: "ProServices Master",
  sec_edgar: "SEC EDGAR",
  courtlistener: "Court Records",
  user_link: "Added links",
  manual: "Manual",
};

const sourceColor = (s) =>
  ({
    sec_edgar: "#f87171",
    courtlistener: "#60a5fa",
    rda_xlsx: "#a78bfa",
    pacificorp_csv: "#34d399",
    proservices_xlsx: "#fbbf24",
    user_link: "#22d3ee",
    manual: "#94a3b8",
  }[s] || "#94a3b8");

// ---------------------------------------------------------------------------
// Source card (landing grid)
// ---------------------------------------------------------------------------
const SourceCard = ({ source, onClick }) => {
  const color = sourceColor(source.source);
  const entities = Object.entries(source.entities || {}).slice(0, 4);
  const docTypes = Object.keys(source.doc_types || {}).slice(0, 3);
  return (
    <button
      type="button"
      onClick={() => onClick(source.source)}
      data-testid={`source-card-${source.source}`}
      className="group text-left rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 hover:border-white/30 transition-all hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/55">
              {source.source}
            </span>
          </div>
          <h3 className="text-white text-[16px] font-medium leading-snug">
            {SOURCE_LABELS[source.source] || source.source}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-light text-amber-200">
            {source.count.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
            docs
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entities.map(([e, n]) => (
          <span
            key={e}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-300/20 text-amber-200/85 bg-amber-300/[0.04]"
          >
            {e} · {n}
          </span>
        ))}
      </div>
      {docTypes.length > 0 && (
        <div className="mt-2 text-[10px] font-mono text-white/35 uppercase tracking-[0.15em]">
          {docTypes.join(" · ")}
        </div>
      )}
      {source.latest && (
        <div className="mt-2 text-[10px] font-mono text-white/35 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          latest {new Date(source.latest).toLocaleDateString()}
        </div>
      )}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Filter sidebar — used when drilled in
// ---------------------------------------------------------------------------
const FilterGroup = ({ title, options, value, onChange, testid }) => {
  if (!options || Object.keys(options).length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
        {title}
      </div>
      <div className="space-y-0.5" data-testid={testid}>
        <button
          type="button"
          onClick={() => onChange("")}
          className={`w-full text-left px-2 py-1.5 rounded text-[12px] font-mono flex items-center justify-between transition ${
            !value
              ? "bg-amber-300/[0.12] text-amber-200"
              : "text-white/55 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <span>all</span>
          <span className="text-white/30">
            {Object.values(options).reduce((a, b) => a + b, 0)}
          </span>
        </button>
        {Object.entries(options).map(([k, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`w-full text-left px-2 py-1.5 rounded text-[12px] font-mono flex items-center justify-between transition ${
              value === k
                ? "bg-amber-300/[0.12] text-amber-200"
                : "text-white/55 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <span className="truncate">{k}</span>
            <span className="text-white/30 ml-2">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Document row (drill-in list)
// ---------------------------------------------------------------------------
const DocRow = ({ row, onOpen }) => {
  return (
    <div
      className="group rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:border-white/25 transition cursor-pointer"
      onClick={() => onOpen(row)}
      data-testid={`browse-row-${row.id}`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/70">
          {row.entity}
        </span>
        <span className="text-white/20">·</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
          {row.doc_type}
        </span>
        {row.meta?.date && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-[10px] font-mono text-white/45">
              {row.meta.date}
            </span>
          </>
        )}
      </div>
      <div className="text-white text-[14px] leading-snug font-medium line-clamp-2">
        {row.title}
      </div>
      {row.snippet && (
        <div
          className="mt-1.5 text-white/55 text-[12.5px] leading-relaxed line-clamp-2 research-snippet"
          dangerouslySetInnerHTML={{ __html: row.snippet }}
        />
      )}
      <div
        className="mt-2 flex items-center gap-3 text-[11px] font-mono text-white/40"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="ml-auto">
          <ResearchActions row={row} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Source Explorer
// ---------------------------------------------------------------------------
const SourceExplorer = ({ onOpenDoc }) => {
  const [loading, setLoading] = useState(true);
  const [sourcesSummary, setSourcesSummary] = useState([]);
  const [activeSource, setActiveSource] = useState(null);

  // Drill-in state
  const [browseLoading, setBrowseLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState({ source: {}, entity: {}, doc_type: {} });
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [docType, setDocType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [skip, setSkip] = useState(0);
  const PAGE = 30;
  const [mobileFilters, setMobileFilters] = useState(false);

  // Load landing grid
  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/research/sources-index")
      .then((r) => setSourcesSummary(r.data.sources || []))
      .catch(() => setSourcesSummary([]))
      .finally(() => setLoading(false));
  }, []);

  // Fetch browse results when drilled in or filters change
  const fetchBrowse = useCallback(async () => {
    if (!activeSource) return;
    setBrowseLoading(true);
    try {
      const params = new URLSearchParams({
        source: activeSource,
        limit: String(PAGE),
        skip: String(skip),
      });
      if (q.trim()) params.set("q", q.trim());
      if (entity) params.set("entity", entity);
      if (docType) params.set("doc_type", docType);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const r = await apiClient.get(`/research/browse?${params.toString()}`);
      setResults(r.data.results || []);
      setTotal(r.data.total || 0);
      setFacets(r.data.facets || { source: {}, entity: {}, doc_type: {} });
    } catch (e) {
      setResults([]);
      setTotal(0);
    } finally {
      setBrowseLoading(false);
    }
  }, [activeSource, skip, q, entity, docType, dateFrom, dateTo]);

  useEffect(() => {
    fetchBrowse();
  }, [fetchBrowse]);

  // Reset pagination on filter change
  useEffect(() => {
    setSkip(0);
  }, [q, entity, docType, dateFrom, dateTo, activeSource]);

  const enter = (src) => {
    setActiveSource(src);
    setQ("");
    setEntity("");
    setDocType("");
    setDateFrom("");
    setDateTo("");
    setSkip(0);
    setMobileFilters(false);
  };

  const activeSourceMeta = useMemo(
    () => sourcesSummary.find((s) => s.source === activeSource),
    [sourcesSummary, activeSource]
  );

  const filtersApplied =
    !!q.trim() || !!entity || !!docType || !!dateFrom || !!dateTo;

  // ---------------- Landing grid ----------------
  if (!activeSource) {
    return (
      <div className="mt-6 space-y-5" data-testid="research-browse-landing">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300/75">
              Browse
            </div>
            <h2 className="text-white text-xl font-medium mt-0.5">
              Click any source to browse its documents
            </h2>
          </div>
          <div className="text-[11px] font-mono text-white/40">
            {sourcesSummary.length} sources ·{" "}
            {sourcesSummary
              .reduce((a, s) => a + s.count, 0)
              .toLocaleString()}{" "}
            docs
          </div>
        </div>
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sourcesSummary.map((s) => (
              <SourceCard key={s.source} source={s} onClick={enter} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------------- Drill-in view ----------------
  return (
    <div className="mt-6" data-testid="research-browse-drilled">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSource(null)}
          data-testid="browse-back"
          className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.2em] text-white/55 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          all sources
        </button>
        <span className="text-white/20">/</span>
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-200">
          {SOURCE_LABELS[activeSource] || activeSource}
        </span>
        <span className="text-[11px] font-mono text-white/35 ml-auto">
          {total.toLocaleString()}{" "}
          {filtersApplied ? "matching" : "total"} doc{total === 1 ? "" : "s"}
          {activeSourceMeta && !filtersApplied && activeSourceMeta.count !== total && (
            <span> (of {activeSourceMeta.count.toLocaleString()})</span>
          )}
        </span>
      </div>

      {/* Search-within bar */}
      <div className="rounded-lg border border-white/15 bg-black/40 p-2 flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-white/40 ml-1" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search within this source…"
          data-testid="browse-search-input"
          className="flex-1 border-0 bg-transparent text-white placeholder:text-white/30 h-9 focus-visible:ring-0"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-white/40 hover:text-white"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMobileFilters((v) => !v)}
          data-testid="browse-mobile-filters-toggle"
          className="lg:hidden text-[10px] font-mono uppercase tracking-[0.18em] px-2.5 py-1.5 rounded border border-white/15 text-white/70 hover:text-white hover:border-white/30 flex items-center gap-1"
        >
          <Filter className="h-3 w-3" />
          filters
        </button>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Filters sidebar */}
        <aside
          className={`lg:w-60 shrink-0 space-y-4 ${
            mobileFilters ? "block" : "hidden lg:block"
          }`}
          data-testid="browse-filters"
        >
          <FilterGroup
            title="Entity / Project"
            options={facets.entity}
            value={entity}
            onChange={setEntity}
            testid="browse-filter-entity"
          />
          <FilterGroup
            title="Document type"
            options={facets.doc_type}
            value={docType}
            onChange={setDocType}
            testid="browse-filter-doctype"
          />
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
              Date range
            </div>
            <div className="space-y-1.5">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="browse-date-from"
                className="h-8 bg-black/40 border-white/15 text-white text-[12px] font-mono"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="browse-date-to"
                className="h-8 bg-black/40 border-white/15 text-white text-[12px] font-mono"
              />
            </div>
          </div>
          {filtersApplied && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQ("");
                setEntity("");
                setDocType("");
                setDateFrom("");
                setDateTo("");
              }}
              data-testid="browse-clear-filters"
              className="w-full border-white/15 text-white/70 hover:bg-white/10"
            >
              <X className="h-3 w-3 mr-1" /> clear filters
            </Button>
          )}
        </aside>

        {/* Results */}
        <main className="flex-1 min-w-0 space-y-2">
          {browseLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/45">
              <Database className="h-7 w-7 mx-auto text-white/30 mb-3" />
              <div className="text-sm">No documents match these filters.</div>
            </div>
          ) : (
            <>
              {results.map((r) => (
                <DocRow key={r.id} row={r} onOpen={onOpenDoc} />
              ))}
              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[11px] font-mono text-white/40">
                  {skip + 1}–{Math.min(skip + results.length, total)} of{" "}
                  {total.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={skip === 0 || browseLoading}
                    onClick={() => setSkip(Math.max(0, skip - PAGE))}
                    data-testid="browse-prev"
                    className="border-white/15 text-white/80 hover:bg-white/10"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={skip + results.length >= total || browseLoading}
                    onClick={() => setSkip(skip + PAGE)}
                    data-testid="browse-next"
                    className="border-white/15 text-white/80 hover:bg-white/10"
                  >
                    next →
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SourceExplorer;
