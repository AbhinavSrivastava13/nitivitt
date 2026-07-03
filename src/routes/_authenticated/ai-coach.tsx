import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getNitiGuideExplanation } from "@/lib/niti-guide.functions";

export const Route = createFileRoute("/_authenticated/ai-coach")({
  head: () => ({
    meta: [
      { title: "NitiGuide™ — AI Financial Coach — NitiVitt" },
      { name: "description", content: "Ask NitiGuide anything about your plan. It explains — never calculates. Every answer is grounded in NitiCore™." },
    ],
  }),
  component: AICoach,
});

type Focus = "overview" | "score" | "age" | "path" | "retirement" | "insurance" | "emergency" | "goals" | "custom";

const STARTERS: { label: string; focus: Focus }[] = [
  { label: "Explain my NitiScore", focus: "score" },
  { label: "Why is my emergency fund weak?", focus: "emergency" },
  { label: "Am I on track for retirement?", focus: "retirement" },
  { label: "Is my insurance adequate?", focus: "insurance" },
  { label: "How do I achieve my goals?", focus: "goals" },
  { label: "Explain my recommendations", focus: "path" },
];

type Msg = { role: "user" | "assistant"; text: string; source?: string };

function AICoach() {
  const fn = useServerFn(getNitiGuideExplanation);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function ask(payload: { question?: string; focus?: Focus; display: string }) {
    if (loading) return;
    setMessages((m) => [...m, { role: "user", text: payload.display }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fn({
        data: {
          focus: payload.focus ?? (payload.question ? "custom" : "overview"),
          question: payload.question,
        },
      });
      setMessages((m) => [...m, { role: "assistant", text: res.explanation, source: res.source }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: err instanceof Error ? err.message : "Something went wrong reaching NitiGuide." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="h-4.5 w-4.5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">NitiGuide™</p>
        </div>
        <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">Help me understand.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          AI assists. Mathematics decides. Ask anything about your plan — NitiGuide explains your NitiCore™ numbers in plain English.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <div className="max-h-[520px] min-h-[360px] space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Pick a starter — or ask your own question.</p>
                <p className="mt-1">NitiGuide reads your live NitiCore metrics and answers with your real numbers.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-gradient-to-br from-primary-soft/40 to-card text-foreground"
                }`}>
                  {m.role === "assistant" && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Sparkles className="h-3 w-3" /> NitiGuide
                    </div>
                  )}
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: "120ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: "240ms" }} />
                    NitiGuide is reading your numbers…
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); if (input.trim()) void ask({ question: input.trim(), display: input.trim() }); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your NitiScore, retirement, goals…"
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> Ask
              </button>
            </form>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Try one of these</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => void ask({ focus: s.focus, display: s.label })}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:bg-primary-soft/40"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-[11px] italic text-muted-foreground">
          NitiGuide never calculates. Every number it quotes comes from NitiCore™, the deterministic engine.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
