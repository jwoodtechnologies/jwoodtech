import { useEffect, useRef, useState } from "react";
import { Send, Loader2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";

const Orb = ({ size = 120 }) => (
  <div
    className="relative shrink-0"
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

const HomeEon = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, busy]);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    const nextHistory = [...messages, { role: "me", text: t }];
    setMessages(nextHistory);
    setInput("");
    setBusy(true);
    try {
      const history = nextHistory.map((m) => ({
        role: m.role === "me" ? "user" : "assistant",
        text: m.text,
      }));
      // last entry is the user's current message — the backend takes it as
      // `message`, so we trim it off the history we forward.
      const trimmed = history.slice(0, -1);
      let reply = null;
      try {
        const { data } = await apiClient.post("/eon/chat", {
          message: t,
          history: trimmed,
        });
        reply = data?.reply || null;
      } catch {
        reply = null;
      }
      if (!reply) {
        reply =
          "EON is unavailable right now. Please try again in a moment.";
      }
      setMessages((m) => [...m, { role: "ai", text: reply }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating launcher (bottom-right, above chatbot) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 group"
        data-testid="home-eon-launcher"
        aria-label="Talk to EON"
      >
        <div className="absolute inset-0 rounded-full bg-[rgb(var(--wc-accent))]/30 blur-xl opacity-60 group-hover:opacity-90 transition-opacity" />
        <div className="relative h-14 w-14 rounded-full bg-black/70 border border-white/12 backdrop-blur grid place-items-center hover:scale-105 transition-transform">
          <Orb size={36} />
        </div>
        <span className="absolute -top-2 -right-2 text-[8.5px] wc-mono font-medium bg-[rgb(var(--wc-accent))] text-black px-1.5 py-0.5 rounded">
          BETA
        </span>
      </button>

      {/* Full-bleed dialog — keeps the homepage video in the background but
          dims it heavily and overlays a deep-space gradient + orb. */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex flex-col wc-font"
          data-testid="home-eon-dialog"
        >
          {/* Backdrop: deepens the existing video into a "different world" */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 35%, rgba(125,169,255,0.18) 0%, rgba(0,0,0,0.92) 60%, #000 100%)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          />
          <div className="wc-starfield">
            <div className="wc-stars-mid" />
          </div>

          {/* Header */}
          <header className="relative flex items-center justify-between px-5 md:px-8 pt-5 md:pt-7 pb-3 z-10">
            <div className="flex items-center gap-2.5">
              <div className="wc-mono text-[10.5px] uppercase tracking-[0.32em] text-[rgb(var(--wc-accent))]">
                EON · BETA
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-9 w-9 rounded-full grid place-items-center text-white/65 hover:text-white hover:bg-white/5 border border-white/10"
              data-testid="home-eon-close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Conversation area */}
          <div
            ref={scrollRef}
            className="relative flex-1 overflow-y-auto px-5 md:px-8 pb-4 z-10"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center min-h-[60vh] gap-6">
                <Orb size={140} />
                <h1 className="wc-display text-white text-[44px] md:text-[64px] leading-[1.05]">
                  This is EON.
                </h1>
                <p className="text-white/55 text-[15px] max-w-md leading-relaxed">
                  Ask anything. Get a sharp answer.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-xl">
                  {[
                    "Tell me something interesting.",
                    "Summarize my day.",
                    "Write a sharp two-line bio.",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-[13px] wc-font text-white/75 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 hover:bg-white/[0.08] hover:border-white/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-3 pt-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      m.role === "me" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] md:max-w-[72%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                        m.role === "me"
                          ? "wc-bubble-me"
                          : "bg-white/[0.04] text-white border border-white/[0.07]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 text-white/65 text-sm flex items-center gap-2.5">
                      <span className="inline-flex gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--wc-accent))]"
                          style={{ animation: "wc-bounce 1.2s ease-in-out infinite" }}
                        />
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--wc-accent))]"
                          style={{ animation: "wc-bounce 1.2s ease-in-out 0.15s infinite" }}
                        />
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--wc-accent))]"
                          style={{ animation: "wc-bounce 1.2s ease-in-out 0.3s infinite" }}
                        />
                      </span>
                      thinking
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="relative z-10 px-4 md:px-8 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
            data-testid="home-eon-compose"
          >
            <div className="max-w-2xl mx-auto flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask EON…"
                  className="wc-input min-h-[52px] max-h-40 resize-none py-4 px-5 rounded-3xl text-[15px]"
                  data-testid="home-eon-input"
                />
              </div>
              <Button
                type="submit"
                disabled={!input.trim() || busy}
                className="bg-white text-black hover:bg-white/90 h-12 w-12 p-0 rounded-full shrink-0 wc-shine"
                data-testid="home-eon-send"
                aria-label="Send"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default HomeEon;
// keep Sparkles import for future use
void Sparkles;
