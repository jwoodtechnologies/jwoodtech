import { useEffect, useRef, useState } from "react";
import {
  Share2,
  Link as LinkIcon,
  Copy,
  Mail,
  ExternalLink,
  Check,
  Bookmark,
  BookmarkCheck,
  FileDown,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { isSaved, saveDoc, removeSaved } from "@/lib/researchSaved";

// Compact action menu for a single Research result row.
// - Save / unsave to localStorage
// - Copy link
// - Copy excerpt
// - Email finding (mailto:)
// - Open original source
// - Download PDF (when url ends in .pdf)
// - Send to Claude / ChatGPT (calls /research/export, copies prompt)

const Item = ({ icon: Icon, label, onClick, testid, accent }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-white/[0.06] transition rounded ${
      accent ? "text-amber-200" : "text-white/80"
    }`}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

const ResearchActions = ({ row, onSavedChange }) => {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(() => isSaved(row.id));
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const flash = (text) => {
    setCopied(true);
    toast.success(text);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleSave = () => {
    if (saved) {
      removeSaved(row.id);
      setSaved(false);
      toast.success("Removed from Saved");
    } else {
      saveDoc(row);
      setSaved(true);
      toast.success("Saved to device");
    }
    onSavedChange?.();
  };

  const copyLink = async () => {
    const link = row.url || `${window.location.origin}/research?doc=${row.id}`;
    await navigator.clipboard.writeText(link);
    flash("Link copied");
    setOpen(false);
  };

  const copyExcerpt = async () => {
    const txt = `${row.title}\n${row.url || ""}\n\n${(row.snippet || "").replace(/<[^>]+>/g, "")}`;
    await navigator.clipboard.writeText(txt);
    flash("Excerpt copied");
    setOpen(false);
  };

  const emailFinding = () => {
    const subject = encodeURIComponent(`Research finding: ${row.title}`);
    const body = encodeURIComponent(
      `${row.title}\n\nSource: ${row.url || row.source}\n\n${(row.snippet || "").replace(/<[^>]+>/g, "")}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  const openSource = () => {
    if (row.url) window.open(row.url, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const downloadPdf = () => {
    const u = row.url || "";
    if (!/\.pdf(\?|$)/i.test(u)) {
      toast.error("This document is not a PDF");
      return;
    }
    const a = document.createElement("a");
    a.href = u;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setOpen(false);
  };

  const exportTo = async (target) => {
    try {
      const r = await apiClient.post("/research/export", {
        doc_ids: [row.id],
        target,
      });
      await navigator.clipboard.writeText(r.data.prompt || "");
      flash(`${target === "claude" ? "Claude" : "ChatGPT"} prompt copied`);
    } catch (e) {
      toast.error("Export failed");
    }
    setOpen(false);
  };

  const isPdf = /\.pdf(\?|$)/i.test(row.url || "");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        data-testid={`research-actions-toggle-${row.id}`}
        className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-1 rounded border border-white/15 text-white/55 hover:text-white hover:border-white/30"
      >
        {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
        actions
      </button>
      {open && (
        <div
          className="absolute z-30 right-0 mt-1 w-56 p-1 rounded-lg border border-white/15 bg-[#0a0810] shadow-xl"
          onClick={(e) => e.stopPropagation()}
          data-testid={`research-actions-menu-${row.id}`}
        >
          <Item
            icon={saved ? BookmarkCheck : Bookmark}
            label={saved ? "Saved · remove" : "Save to device"}
            onClick={toggleSave}
            testid={`research-actions-save-${row.id}`}
            accent={saved}
          />
          <Item icon={LinkIcon} label="Copy link" onClick={copyLink} testid={`research-actions-link-${row.id}`} />
          <Item icon={Copy} label="Copy excerpt" onClick={copyExcerpt} testid={`research-actions-excerpt-${row.id}`} />
          <Item icon={Mail} label="Email finding" onClick={emailFinding} testid={`research-actions-email-${row.id}`} />
          {row.url && (
            <Item icon={ExternalLink} label="Open original source" onClick={openSource} testid={`research-actions-open-${row.id}`} />
          )}
          {isPdf && (
            <Item icon={FileDown} label="Download PDF" onClick={downloadPdf} testid={`research-actions-pdf-${row.id}`} />
          )}
          <div className="my-1 border-t border-white/10" />
          <Item
            icon={Sparkles}
            label="Copy prompt for Claude"
            onClick={() => exportTo("claude")}
            testid={`research-actions-claude-${row.id}`}
            accent
          />
          <Item
            icon={Sparkles}
            label="Copy prompt for ChatGPT"
            onClick={() => exportTo("chatgpt")}
            testid={`research-actions-chatgpt-${row.id}`}
            accent
          />
        </div>
      )}
    </div>
  );
};

export default ResearchActions;
