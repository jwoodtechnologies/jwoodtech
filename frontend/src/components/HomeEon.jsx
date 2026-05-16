import { useState } from "react";
import { Loader2, X, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

// Glowing moving orb (used both as the floating launcher and the modal hero)
const Orb = ({ size = 120 }) => (
  <div
    className="relative shrink-0 home-orb"
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <div className="wc-orb wc-orb-a absolute inset-0 rounded-full" />
    <div className="wc-orb wc-orb-b absolute inset-0 rounded-full" />
    <div className="wc-orb wc-orb-c absolute inset-0 rounded-full" />
    <div className="wc-orb-core absolute inset-[22%] rounded-full" />
    <div className="wc-orb-ring absolute inset-[8%] rounded-full" />
  </div>
);

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  message: "",
};

/**
 * HomeEon
 * -------
 * Floating orb (bottom-right) on the homepage. Click it → premium modal
 * with a short customer-contact form. EON greets the visitor, captures
 * first name / last name / email / what they need, and promises a reply
 * in 24–48 hours. This is NOT a chat — it's a lead-capture surface.
 */
const HomeEon = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const close = () => {
    setOpen(false);
    // Reset success state once the closing animation has passed.
    setTimeout(() => {
      setDone(false);
      setForm(initialForm);
    }, 220);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/eon-app/contact-lead", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      });
      setDone(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Couldn't send right now. Try again in a moment.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating launcher — pure glowing orb, no label */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 home-orb-btn group"
        data-testid="home-eon-launcher"
        aria-label="Open EON contact"
      >
        <span className="home-orb-pulse" aria-hidden="true" />
        <span className="home-orb-pulse home-orb-pulse-2" aria-hidden="true" />
        <span className="home-orb-wrap">
          <Orb size={56} />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center px-3 md:px-6 pb-3 md:pb-0" data-testid="home-eon-dialog">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/72 backdrop-blur-md"
            onClick={close}
            aria-label="Close"
          />

          {/* Modal */}
          <div
            className="relative z-10 w-full max-w-[460px] rounded-3xl border border-white/10 bg-[rgba(10,12,22,0.88)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] overflow-hidden"
            data-testid="home-eon-modal"
          >
            <button
              type="button"
              className="absolute top-3 right-3 h-9 w-9 rounded-full grid place-items-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors z-20"
              onClick={close}
              data-testid="home-eon-close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hero strip with orb */}
            <div className="relative px-7 pt-7 pb-5 text-center border-b border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent">
              <div className="flex justify-center mb-4">
                <Orb size={72} />
              </div>
              <div className="font-mono text-[10.5px] tracking-[0.32em] uppercase text-[rgb(var(--wc-accent))]">
                Hi, I'm EON
              </div>
              <h2 className="mt-2 text-white text-[22px] font-light tracking-tight">
                {done ? "Got it — we'll be in touch." : "Tell us what you're building."}
              </h2>
              <p className="mt-2 text-white/55 text-[13px] leading-relaxed max-w-[340px] mx-auto">
                {done
                  ? "Thanks for reaching out. Jwood Technologies will get back to you within 24–48 hours."
                  : "Drop your name + a quick note. We'll reach back out within 24–48 hours."}
              </p>
            </div>

            {/* Body */}
            <div className="px-7 py-6">
              {done ? (
                <div className="flex flex-col items-center gap-4 py-4" data-testid="home-eon-success">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                  <Button
                    onClick={close}
                    className="rounded-full bg-white text-black hover:bg-white/90 px-6 h-10"
                    data-testid="home-eon-done-close"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4" data-testid="home-eon-form" noValidate>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="First name" htmlFor="he-first" required>
                      <Input
                        id="he-first"
                        data-testid="home-eon-first"
                        className="input-premium h-10 rounded-lg"
                        value={form.first_name}
                        onChange={set("first_name")}
                        placeholder="Jane"
                        required
                      />
                    </FormField>
                    <FormField label="Last name" htmlFor="he-last" required>
                      <Input
                        id="he-last"
                        data-testid="home-eon-last"
                        className="input-premium h-10 rounded-lg"
                        value={form.last_name}
                        onChange={set("last_name")}
                        placeholder="Doe"
                        required
                      />
                    </FormField>
                  </div>
                  <FormField label="Email" htmlFor="he-email" required>
                    <Input
                      id="he-email"
                      type="email"
                      data-testid="home-eon-email"
                      className="input-premium h-10 rounded-lg"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@company.com"
                      required
                    />
                  </FormField>
                  <FormField label="Phone" htmlFor="he-phone">
                    <Input
                      id="he-phone"
                      data-testid="home-eon-phone"
                      className="input-premium h-10 rounded-lg"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="Optional"
                    />
                  </FormField>
                  <FormField label="What can we help with?" htmlFor="he-msg" required>
                    <Textarea
                      id="he-msg"
                      data-testid="home-eon-message"
                      className="input-premium min-h-[88px] rounded-lg"
                      value={form.message}
                      onChange={set("message")}
                      placeholder="A line or two about your project."
                      required
                    />
                  </FormField>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-white text-black hover:bg-white/90 h-11 mt-2"
                    data-testid="home-eon-submit"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send to EON
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                  <p className="text-center text-[11px] text-white/40 mt-1">
                    Replies in 24–48 hours. No spam.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const FormField = ({ label, htmlFor, required, children }) => (
  <div className="space-y-1.5">
    <Label
      htmlFor={htmlFor}
      className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-white/60"
    >
      {label}
      {required && <span className="ml-1 text-white/35">*</span>}
    </Label>
    {children}
  </div>
);

export default HomeEon;
