import { useState, useRef, useEffect } from "react";
import {
  Share2,
  Link as LinkIcon,
  Quote,
  Mail,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "sonner";

/* Lightweight share popover for a single result.
   Items: Copy link · Copy excerpt · Email · Open exact section. */
export const ShareMenu = ({ title, url, excerpt, sectionRef, testid }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOut = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClickOut);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClickOut);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const flash = (k) => {
    setCopied(k);
    setTimeout(() => setCopied(""), 1400);
  };

  const copy = async (text, k, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(k);
      toast.success(msg);
    } catch {
      toast.error("Copy failed.");
    }
    setOpen(false);
  };

  const copyLink = () => copy(url, "link", "Link copied.");
  const copyExcerpt = () =>
    copy(
      `"${excerpt || title}"\n\nSource: ${title}\n${url}`,
      "excerpt",
      "Excerpt copied."
    );
  const emailIt = () => {
    const subject = `Vineyard archive: ${title}`;
    const body = `${excerpt ? `"${excerpt}"\n\n` : ""}Source: ${title}\n${url}${
      sectionRef ? `\nSection: ${sectionRef}` : ""
    }\n\nFrom Jwood Vineyard Scraper.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    setOpen(false);
  };
  const openSection = () => {
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/5 transition-colors"
        data-testid={testid || "share-trigger"}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 className="h-3 w-3" />
        Share
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-56 z-30 rounded-lg border border-white/10 bg-[#0a0c14] shadow-2xl py-1.5 text-sm"
          data-testid="share-menu"
        >
          <MenuItem
            icon={copied === "link" ? Check : LinkIcon}
            label={copied === "link" ? "Copied!" : "Copy link"}
            onClick={copyLink}
            testid="share-copy-link"
          />
          <MenuItem
            icon={copied === "excerpt" ? Check : Quote}
            label={copied === "excerpt" ? "Copied!" : "Copy excerpt"}
            onClick={copyExcerpt}
            testid="share-copy-excerpt"
          />
          <MenuItem
            icon={Mail}
            label="Email finding"
            onClick={emailIt}
            testid="share-email"
          />
          <div className="my-1 h-px bg-white/[0.06]" />
          <MenuItem
            icon={ExternalLink}
            label="Open exact section"
            onClick={openSection}
            testid="share-open"
          />
        </div>
      )}
    </div>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    role="menuitem"
    data-testid={testid}
    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-white/85 hover:bg-white/[0.06] transition-colors"
  >
    <Icon className="h-3.5 w-3.5 shrink-0 text-white/55" />
    <span className="text-[12.5px]">{label}</span>
  </button>
);

export default ShareMenu;
