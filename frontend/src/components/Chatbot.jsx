import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";

const STEPS = [
  {
    key: "first_name",
    prompt: "Hi, I'm Wood AI. What's your first name?",
    placeholder: "First name",
    required: true,
    validate: (v) => v.trim().length >= 1 || "Please enter your first name.",
  },
  {
    key: "last_name",
    prompt: "Nice to meet you{comma}{first}. What's your last name?",
    placeholder: "Last name",
    required: true,
    validate: (v) => v.trim().length >= 1 || "Please enter your last name.",
  },
  {
    key: "email",
    prompt: "Thanks{comma}{first}. What's your email?",
    placeholder: "you@company.com",
    type: "email",
    required: true,
    validate: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ||
      "Please enter a valid email.",
  },
  {
    key: "phone",
    prompt: "What's your phone number? (Optional — feel free to skip.)",
    placeholder: "Phone (or skip)",
    required: false,
    skippable: true,
  },
  {
    key: "question",
    prompt:
      "Last one — what can I help you with? Tell me about your project or question.",
    placeholder: "Your project or question…",
    required: true,
    multiline: true,
    validate: (v) =>
      v.trim().length >= 2 || "Please share a few words so I can help.",
  },
];

const FINAL_MESSAGE =
  "Thanks. I've got your information. You'll receive a response within 1–2 days.";

const greet = (tmpl, answers) =>
  tmpl
    .replaceAll("{first}", answers.first_name ? ` ${answers.first_name}` : "")
    .replaceAll("{comma}", answers.first_name ? "," : "");

export const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role: 'bot'|'user', text}
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [errorInline, setErrorInline] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const startedRef = useRef(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const pushBot = useCallback(async (text, { delay = 650 } = {}) => {
    setTyping(true);
    scrollToBottom();
    await new Promise((r) => setTimeout(r, delay));
    setTyping(false);
    setMessages((m) => [...m, { role: "bot", text }]);
    scrollToBottom();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const startConversation = useCallback(async () => {
    startedRef.current = true;
    setMessages([]);
    setAnswers({});
    setStepIndex(0);
    setDone(false);
    await pushBot(STEPS[0].prompt, { delay: 700 });
  }, [pushBot]);

  // Start on first open
  useEffect(() => {
    if (open && !startedRef.current && !done) {
      startConversation();
    }
  }, [open, done, startConversation]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const currentStep = STEPS[stepIndex];

  const submitStep = async (rawValue) => {
    if (!currentStep || sending || typing) return;
    let value = (rawValue ?? input).trim();
    const isSkip = currentStep.skippable && value === "";

    if (!isSkip && currentStep.validate) {
      const v = currentStep.validate(value);
      if (v !== true) {
        setErrorInline(typeof v === "string" ? v : "Invalid input.");
        return;
      }
    }
    setErrorInline("");

    // Show user bubble (or a gentle 'Skipped' if blank phone)
    const userText = isSkip ? "Skipped" : value;
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    scrollToBottom();

    const nextAnswers = { ...answers, [currentStep.key]: isSkip ? "" : value };
    setAnswers(nextAnswers);

    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) {
      setStepIndex(nextIdx);
      const nextPrompt = greet(STEPS[nextIdx].prompt, nextAnswers);
      await pushBot(nextPrompt);
      return;
    }

    // Completed — send to backend
    setSending(true);
    setTyping(true);
    scrollToBottom();
    try {
      await apiClient.post("/chatbot", {
        first_name: nextAnswers.first_name || "",
        last_name: nextAnswers.last_name || "",
        email: nextAnswers.email || "",
        phone: nextAnswers.phone || "",
        question: nextAnswers.question || "",
      });
    } catch {
      // fail silently per spec; we still end the conversation gracefully
    }
    await new Promise((r) => setTimeout(r, 600));
    setTyping(false);
    setMessages((m) => [...m, { role: "bot", text: FINAL_MESSAGE }]);
    setSending(false);
    setDone(true);
    scrollToBottom();
  };

  const onSubmitForm = (e) => {
    e.preventDefault();
    submitStep();
  };

  const onKeyDownInput = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitStep();
    }
  };

  const resetAndStartOver = () => {
    startedRef.current = false;
    setDone(false);
    setMessages([]);
    setAnswers({});
    setStepIndex(0);
    setInput("");
    setErrorInline("");
    // effect will restart
  };

  const canSkip = currentStep?.skippable && !done;

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed z-50 bottom-5 right-5 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-white text-black shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] grid place-items-center hover:scale-[1.03] active:scale-100 transition-transform"
        aria-label="Open Wood AI Chatbot"
        data-testid="chatbot-toggle"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed z-50 bottom-24 right-3 md:right-6 w-[calc(100vw-1.5rem)] max-w-[400px] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl border border-white/10 bg-[#0a0c14]/95 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col transition-all duration-300 origin-bottom-right ${
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        }`}
        data-testid="chatbot-panel"
        role="dialog"
        aria-hidden={!open}
      >
        <header className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-white text-[14px] font-medium flex items-center gap-1.5">
                Wood AI Chatbot
                <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/55 border border-white/15 rounded px-1.5 py-0.5">
                  BETA
                </span>
              </div>
              <div className="text-[11px] text-white/50">
                Leave a short intake — replies within 1–2 days.
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/60 hover:text-white shrink-0 ml-2"
            aria-label="Close chatbot"
            data-testid="chatbot-close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          data-testid="chatbot-messages"
        >
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} text={m.text} />
          ))}
          {typing && <TypingBubble />}
        </div>

        {/* Composer */}
        <footer className="border-t border-white/10 bg-[#0a0c14]">
          {done ? (
            <div className="p-4 flex items-center justify-between gap-3">
              <p className="text-[12px] text-white/60">
                Conversation complete.
              </p>
              <button
                type="button"
                onClick={resetAndStartOver}
                className="text-[12px] text-white/80 hover:text-white underline-offset-4 hover:underline"
                data-testid="chatbot-restart"
              >
                Start over
              </button>
            </div>
          ) : (
            <form
              onSubmit={onSubmitForm}
              className="p-3 flex items-end gap-2"
              data-testid="chatbot-form"
              noValidate
            >
              {currentStep?.multiline ? (
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (errorInline) setErrorInline("");
                  }}
                  onKeyDown={onKeyDownInput}
                  disabled={sending || typing}
                  placeholder={currentStep?.placeholder || "Type a message…"}
                  className="input-premium min-h-[44px] max-h-[120px] rounded-xl text-sm resize-none py-2.5"
                  data-testid="chatbot-input"
                />
              ) : (
                <Input
                  ref={inputRef}
                  type={currentStep?.type || "text"}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (errorInline) setErrorInline("");
                  }}
                  disabled={sending || typing}
                  placeholder={currentStep?.placeholder || "Type a message…"}
                  className="input-premium h-11 rounded-xl text-sm"
                  data-testid="chatbot-input"
                />
              )}
              <div className="flex flex-col gap-1">
                {canSkip && input.trim() === "" ? (
                  <button
                    type="button"
                    onClick={() => submitStep("")}
                    disabled={sending || typing}
                    className="h-11 px-3 rounded-xl text-[12px] font-medium text-white/70 border border-white/15 hover:bg-white/5 disabled:opacity-50"
                    data-testid="chatbot-skip"
                  >
                    Skip
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      sending || typing || (!canSkip && input.trim() === "")
                    }
                    className="h-11 w-11 rounded-xl bg-white text-black grid place-items-center disabled:opacity-50 hover:bg-white/90"
                    aria-label="Send"
                    data-testid="chatbot-send"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </form>
          )}
          {errorInline && (
            <p
              className="px-4 pb-3 text-[12px] text-red-300"
              data-testid="chatbot-inline-error"
            >
              {errorInline}
            </p>
          )}
        </footer>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
const ChatBubble = ({ role, text }) => {
  const isBot = role === "bot";
  return (
    <div
      className={`flex ${isBot ? "justify-start" : "justify-end"} chat-bubble-enter`}
      data-testid={`chat-bubble-${role}`}
    >
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
          isBot
            ? "bg-white/[0.06] text-white/90 border border-white/10 rounded-bl-sm"
            : "bg-white text-black rounded-br-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
};

const TypingBubble = () => (
  <div
    className="flex justify-start chat-bubble-enter"
    data-testid="chat-typing"
  >
    <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  </div>
);

export default Chatbot;
