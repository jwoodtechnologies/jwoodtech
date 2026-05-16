import { useEffect, useState } from "react";
import {
  X,
  Trash2,
  Star,
  StarOff,
  ExternalLink,
  FileText,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listSaved,
  removeSaved,
  updateSaved,
  clearAll,
} from "@/lib/savedStore";
import ShareMenu from "@/components/ShareMenu";

export const SavedPanel = ({ open, onClose }) => {
  const [items, setItems] = useState([]);

  const refresh = () => setItems(listSaved());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleDelete = (id) => {
    setItems(removeSaved(id));
    toast.success("Removed.");
  };

  const handleClear = () => {
    if (!window.confirm("Clear all saved items?")) return;
    clearAll();
    setItems([]);
    toast.success("Cleared.");
  };

  return (
    <>
      {/* overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-[#06070d] border-l border-white/10 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        data-testid="saved-panel"
        aria-hidden={!open}
      >
        <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/45">
              Saved · local to this device
            </div>
            <div className="text-white text-xl font-medium mt-1">
              {items.length} item{items.length === 1 ? "" : "s"}
            </div>
          </div>
          <button
            className="text-white/60 hover:text-white"
            onClick={onClose}
            aria-label="Close saved panel"
            data-testid="saved-close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {items.length === 0 && (
            <div
              className="h-full min-h-[240px] grid place-items-center text-center"
              data-testid="saved-empty"
            >
              <div>
                <Bookmark className="h-8 w-8 mx-auto text-white/25" />
                <p className="mt-3 text-sm text-white/55">
                  Save a search result to see it here. Everything lives on this device.
                </p>
              </div>
            </div>
          )}
          {items.map((it) => (
            <SavedCard
              key={it.id}
              item={it}
              onChange={(patch) => {
                setItems(updateSaved(it.id, patch));
              }}
              onDelete={() => handleDelete(it.id)}
            />
          ))}
        </div>

        {items.length > 0 && (
          <footer className="px-6 py-4 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-transparent text-white/80 hover:bg-white/5"
              onClick={handleClear}
              data-testid="saved-clear-all"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear all
            </Button>
          </footer>
        )}
      </aside>
    </>
  );
};

const SavedCard = ({ item, onChange, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note || "");
  const [label, setLabel] = useState(item.label || "");

  const save = () => {
    onChange({ note, label });
    setEditing(false);
  };

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
      data-testid={`saved-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-white font-medium truncate">{item.title}</div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/80">
              {item.source_label || "Source"}
            </span>
            {label && (
              <span className="rounded bg-indigo-400/15 text-indigo-200 px-2 py-0.5 text-[10px] font-mono">
                {label}
              </span>
            )}
            {item.important && (
              <span className="rounded bg-amber-400/15 text-amber-200 px-2 py-0.5 text-[10px] font-mono">
                ★ Important
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onChange({ important: !item.important })}
            className="p-1.5 rounded-md text-white/55 hover:text-amber-300 hover:bg-white/5"
            aria-label={item.important ? "Unmark important" : "Mark important"}
            title={item.important ? "Unmark important" : "Mark important"}
            data-testid={`saved-star-${item.id}`}
          >
            {item.important ? (
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-white/55 hover:text-red-300 hover:bg-white/5"
            aria-label="Delete"
            data-testid={`saved-del-${item.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {item.excerpt && (
        <p className="mt-2 text-[12.5px] text-white/60 leading-relaxed line-clamp-2">
          "{item.excerpt}"
        </p>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label / tag (e.g. parking)"
            className="input-premium h-9 rounded-md text-xs"
            data-testid={`saved-label-input-${item.id}`}
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            className="input-premium min-h-[70px] rounded-md text-xs"
            data-testid={`saved-note-input-${item.id}`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={save}
              className="h-8 bg-white text-black hover:bg-white/90"
              data-testid={`saved-save-${item.id}`}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setNote(item.note || "");
                setLabel(item.label || "");
              }}
              className="h-8 border-white/15 bg-transparent text-white/80 hover:bg-white/5"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {item.note && (
            <p className="mt-3 text-[12px] text-white/80 whitespace-pre-wrap border-l-2 border-white/15 pl-3">
              {item.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/5"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
            {item.pdf_url && (
              <a
                href={item.pdf_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/5"
              >
                <FileText className="h-3 w-3" />
                PDF
              </a>
            )}
            <button
              onClick={() => setEditing(true)}
              className="ml-auto text-[11px] text-white/55 hover:text-white underline-offset-4 hover:underline"
              data-testid={`saved-edit-${item.id}`}
            >
              {item.note || item.label ? "Edit" : "Add note / label"}
            </button>
            <ShareMenu
              title={item.title}
              url={item.url}
              excerpt={item.excerpt}
              sectionRef={item.section_ref}
              testid={`saved-share-${item.id}`}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default SavedPanel;
