import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";

export const AddSourceDialog = ({ onAdded }) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setUrl("");
    setLabel("");
    setBusy(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\/.+/i.test(u)) {
      toast.error("Please enter a valid URL.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/vineyard/sources", { url: u, label: label.trim() });
      toast.success("Source added. Crawling now — it will appear in searches shortly.");
      setOpen(false);
      reset();
      onAdded?.();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        toast.error("That source is already indexed.");
      } else if (status === 400) {
        toast.error(err.response.data?.detail || "Invalid URL.");
      } else {
        toast.error("Source could not be indexed.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-white/15 bg-transparent text-white hover:bg-white/5 h-9"
          data-testid="add-source-trigger"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Source
        </Button>
      </DialogTrigger>
      <DialogContent
        className="bg-[#0a0c14] border-white/10 text-white max-w-md"
        data-testid="add-source-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-white">Add a public source</DialogTitle>
          <DialogDescription className="text-white/60">
            Paste a public URL. It will be crawled, indexed, and shared with everyone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/55">
              URL
            </Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.gov/records"
              className="input-premium h-11 rounded-lg"
              data-testid="add-source-url"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/55">
              Label (optional)
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Short name, e.g. City Archives"
              className="input-premium h-11 rounded-lg"
              data-testid="add-source-label"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/15 bg-transparent text-white hover:bg-white/5"
              data-testid="add-source-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !url.trim()}
              className="bg-white text-black hover:bg-white/90"
              data-testid="add-source-submit"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add & Index"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSourceDialog;
