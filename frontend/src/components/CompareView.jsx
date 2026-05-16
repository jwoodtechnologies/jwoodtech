import { useEffect, useMemo, useState } from "react";
import { Loader2, X, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

// Side-by-side diff for two documents. Highlights:
//  - Common phrases (≥3 word ngrams) shown in amber on both panes
//  - Citation/source link header
//  - "Send to Claude / ChatGPT" copy buttons
//  - Optional AI summary of differences (calls /research/compare)

const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9\-']+/g;

// Compute shared 3-word phrases between two strings — used for visual
// overlap highlighting. Returns a Set of phrases lowercased.
const sharedNgrams = (a, b, n = 3) => {
  const grams = (s) => {
    const tokens = (s || "").match(TOKEN_RE) || [];
    const out = new Set();
    for (let i = 0; i + n <= tokens.length; i++) {
      out.add(tokens.slice(i, i + n).join(" ").toLowerCase());
    }
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  const shared = new Set();
  A.forEach((g) => {
    if (B.has(g)) shared.add(g);
  });
  return shared;
};

const renderHighlighted = (text, shared) => {
  if (!text) return null;
  if (!shared || shared.size === 0) return text;
  // Greedy phrase replacement: for each shared 3-gram, wrap it in mark.
  let out = text;
  // Sort by length desc so longer phrases win.
  const phrases = [...shared].sort((a, b) => b.length - a.length);
  // Use case-insensitive global replace, escape regex specials.
  phrases.forEach((p) => {
    const re = new RegExp(
      `(${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    out = out.replace(re, "\u0001$1\u0002");
  });
  // Convert tokens to JSX with mark tags.
  const parts = [];
  let buf = "";
  let inMark = false;
  for (const ch of out) {
    if (ch === "\u0001") {
      if (buf) parts.push(buf);
      buf = "";
      inMark = true;
    } else if (ch === "\u0002") {
      if (buf) parts.push(<mark key={parts.length}>{buf}</mark>);
      buf = "";
      inMark = false;
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(inMark ? <mark key={parts.length}>{buf}</mark> : buf);
  return parts;
};

const DocColumn = ({ doc, shared, onCopy }) => {
  if (!doc) return null;
  return (
    <div
      className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.02] flex flex-col"
      data-testid={`compare-col-${doc.id}`}
    >
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/75">
            {doc.entity}
          </span>
          <span className="text-white/20">·</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
            {doc.source}
          </span>
        </div>
        <h3 className="text-white text-[14px] leading-snug font-medium">
          {doc.title}
        </h3>
        <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-white/40">
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              <ExternalLink className="h-3 w-3" /> open source
            </a>
          )}
          <button
            type="button"
            onClick={() => onCopy(doc)}
            className="inline-flex items-center gap-1 hover:text-white"
          >
            <Copy className="h-3 w-3" /> copy excerpt
          </button>
        </div>
      </div>
      <div className="overflow-y-auto p-4 max-h-[420px]">
        <div className="text-[12.5px] text-white/80 leading-relaxed whitespace-pre-wrap font-mono compare-content">
          {renderHighlighted((doc.content || "").slice(0, 12000), shared)}
        </div>
      </div>
    </div>
  );
};

const CompareView = ({ docIds, onClose }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!docIds || docIds.length < 2) return;
    setLoading(true);
    Promise.all(
      docIds
        .slice(0, 2)
        .map((id) => apiClient.get(`/research/document/${id}`).then((r) => r.data))
    )
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [docIds]);

  const shared = useMemo(() => {
    if (docs.length < 2) return new Set();
    // Try 3-grams first; fall back to 2-grams when one of the docs
    // is short (< 60 tokens) so overlap highlighting still works on
    // structured one-line spreadsheet rows.
    const tokA = (docs[0]?.content || "").match(TOKEN_RE) || [];
    const tokB = (docs[1]?.content || "").match(TOKEN_RE) || [];
    const minTok = Math.min(tokA.length, tokB.length);
    const n = minTok < 60 ? 2 : 3;
    return sharedNgrams(docs[0]?.content, docs[1]?.content, n);
  }, [docs]);

  const runAI = async () => {
    setAiLoading(true);
    try {
      const r = await apiClient.post("/research/compare", {
        doc_ids: docIds.slice(0, 2),
        question:
          "Compare these two documents side-by-side. Surface key differences, overlapping references, parties, dates, and dollar amounts.",
      });
      setAiAnswer(r.data.answer || "");
    } catch (e) {
      toast.error("AI compare failed");
    } finally {
      setAiLoading(false);
    }
  };

  const copyExcerpt = async (doc) => {
    const text = `${doc.title}\n${doc.url || ""}\n\n${(doc.content || "").slice(0, 1500)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Excerpt copied");
    } catch (e) {
      toast.error("Clipboard blocked");
    }
  };

  const exportPrompt = async (target) => {
    try {
      const r = await apiClient.post("/research/export", {
        doc_ids: docIds.slice(0, 2),
        target,
        question: "Compare these two documents and surface key differences, overlapping references, parties, dates, and dollar amounts.",
      });
      await navigator.clipboard.writeText(r.data.prompt || "");
      setCopied(true);
      toast.success(`Copied ${target} prompt`);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      toast.error("Export failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
      data-testid="research-compare-view"
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] rounded-xl border border-white/15 bg-[#06050a] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300/75">
              Side-by-side compare
            </div>
            <div className="text-white text-lg font-medium mt-0.5">
              {docs.length === 2
                ? `${shared.size} overlapping phrase${shared.size === 1 ? "" : "s"}`
                : "Loading…"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            data-testid="research-compare-close"
            className="text-white/50 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-5">
            <div className="flex flex-col md:flex-row gap-4">
              <DocColumn doc={docs[0]} shared={shared} onCopy={copyExcerpt} />
              <DocColumn doc={docs[1]} shared={shared} onCopy={copyExcerpt} />
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              <Button
                onClick={runAI}
                disabled={aiLoading || docs.length < 2}
                data-testid="research-compare-ai"
                className="bg-amber-300 hover:bg-amber-200 text-black"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "AI compare"}
              </Button>
              <Button
                onClick={() => exportPrompt("claude")}
                variant="outline"
                data-testid="research-compare-export-claude"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                Send to Claude
              </Button>
              <Button
                onClick={() => exportPrompt("chatgpt")}
                variant="outline"
                data-testid="research-compare-export-chatgpt"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Copy className="h-4 w-4 mr-1.5" /> Send to ChatGPT
              </Button>
            </div>

            {aiAnswer && (
              <div
                className="rounded-lg border border-amber-300/25 bg-amber-300/[0.04] p-4 text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap"
                data-testid="research-compare-answer"
              >
                {aiAnswer}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        .compare-content mark {
          background: rgba(252, 211, 77, 0.18);
          color: #ffd699;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default CompareView;
