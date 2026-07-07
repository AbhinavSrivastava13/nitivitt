import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { FlaskConical, Send, Sparkles, TrendingUp, TrendingDown, Minus, RotateCcw, MessageCircleQuestion } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { planSimulation, runSimulation } from "@/lib/niti-sim.functions";
import { formatINR } from "@/lib/finance/core";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "NitiSim™ — Simulate any financial decision — NitiVitt" },
      { name: "description", content: "Ask any 'what if' about your money. NitiSim thinks through the scenario, runs NitiCore™, and explains the impact like a financial mentor." },
    ],
  }),
  component: Simulator,
});

const EXAMPLES = [
  "What if I increase my SIP by ₹5,000/month?",
  "Can I buy a ₹20 lakh car next year?",
  "Can I afford a ₹1 crore house?",
  "Can I retire by 50?",
  "Should I close my personal loan early?",
  "What salary should I target before buying a home?",
];

type SimResult = Awaited<ReturnType<typeof runSimulation>>;
type PlanResult = Awaited<ReturnType<typeof planSimulation>>;

type ChatTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant-ask"; questions: string[] }
  | { id: string; role: "assistant-general"; text: string }
  | { id: string; role: "assistant-sim"; result: SimResult }
  | { id: string; role: "assistant-error"; text: string };

const STORAGE_KEY = "nitisim.history.v2";
const SLOTS_KEY = "nitisim.slots.v2";

function loadHistory(): ChatTurn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatTurn[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(turns: ChatTurn[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-40)));
  } catch {
    /* quota — ignore */
  }
}

function loadSlots(): Record<string, string | number | boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SLOTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

function saveSlots(s: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SLOTS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function Simulator() {
  const plan = useServerFn(planSimulation);
  const run = useServerFn(runSimulation);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("Thinking through the scenario…");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [slots, setSlots] = useState<Record<string, string | number | boolean>>({});
  const [rootQuestion, setRootQuestion] = useState<string>("");
  // Fresh-by-default: every new session starts empty. Prior conversation is
  // available via "Continue previous" only if the user explicitly opts in.
  const [previousExists, setPreviousExists] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Detect (but do NOT auto-load) a previous conversation.
    const prior = loadHistory();
    setPreviousExists(prior.length > 0);
  }, []);
  useEffect(() => { saveHistory(turns); }, [turns]);
  useEffect(() => { saveSlots(slots); }, [slots]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, loading]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  function continuePrevious() {
    setTurns(loadHistory());
    setSlots(loadSlots());
    setPreviousExists(false);
  }

  function priorTurnsForServer(current: ChatTurn[]) {
    return current
      .slice(-10)
      .map((t) => {
        if (t.role === "user") return { role: "user" as const, content: t.text };
        if (t.role === "assistant-ask") return { role: "assistant" as const, content: t.questions.join(" ") };
        if (t.role === "assistant-general") return { role: "assistant" as const, content: t.text };
        if (t.role === "assistant-sim") return { role: "assistant" as const, content: `Simulated: ${t.result.scenarioTitle}` };
        return null;
      })
      .filter((x): x is { role: "user" | "assistant"; content: string } => x !== null);
  }

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    const uid = crypto.randomUUID();
    const nextTurns: ChatTurn[] = [...turns, { id: uid, role: "user", text: trimmed }];
    setTurns(nextTurns);
    setQuestion("");
    setLoading(true);
    setThinkingLabel("Thinking through the scenario…");
    // Anchor the root scenario question for planner continuity.
    const anchorQuestion = rootQuestion || trimmed;
    if (!rootQuestion) setRootQuestion(trimmed);

    try {
      const planned: PlanResult = await plan({
        data: {
          question: anchorQuestion,
          slots,
          priorTurns: priorTurnsForServer(nextTurns),
        },
      });

      if (planned.slots) setSlots(planned.slots as Record<string, string | number | boolean>);

      if (planned.kind === "ask") {
        setTurns((t) => [...t, {
          id: crypto.randomUUID(),
          role: "assistant-ask",
          questions: planned.followupQuestions ?? ["Could you share a bit more detail?"],
        }]);
        return;
      }

      if (planned.kind === "general") {
        setTurns((t) => [...t, {
          id: crypto.randomUUID(),
          role: "assistant-general",
          text: planned.reply ?? "I don't have enough to simulate that yet.",
        }]);
        return;
      }

      // kind === "simulate"
      setThinkingLabel("Running the scenario through NitiCore™…");
      const result = await run({
        data: {
          question: anchorQuestion,
          scenarioTitle: planned.scenarioTitle ?? "Your scenario",
          overrides: planned.overrides ?? {},
        },
      });
      setTurns((t) => [...t, { id: crypto.randomUUID(), role: "assistant-sim", result }]);
      // Simulation completed — reset scenario anchor + slots for next question.
      setRootQuestion("");
      setSlots({});
    } catch (err) {
      setTurns((t) => [
        ...t,
        { id: crypto.randomUUID(), role: "assistant-error", text: err instanceof Error ? err.message : "Simulation failed." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setTurns([]);
    setSlots({});
    setRootQuestion("");
    saveHistory([]);
    saveSlots({});
    setPreviousExists(false);
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FlaskConical className="h-5 w-5" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">NitiSim™</p>
            </div>
            <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">Explore any financial decision.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Ask any "what if" in plain language. NitiSim thinks through your scenario like a financial advisor — asking follow-ups where needed — then runs NitiCore™ and explains the impact.
            </p>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" /> New conversation
            </button>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          <div className="max-h-[640px] min-h-[420px] space-y-5 overflow-y-auto p-5 md:p-6">
            {turns.length === 0 && !loading && (
              <div className="space-y-4">
                {previousExists && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-primary-soft/40 px-4 py-3">
                    <p className="text-xs text-foreground">
                      You have a previous conversation saved in this browser. Every new question starts fresh unless you continue it.
                    </p>
                    <button
                      type="button"
                      onClick={continuePrevious}
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:border-primary/40"
                    >
                      Continue previous
                    </button>
                  </div>
                )}
                <div className="rounded-xl border border-dashed border-border bg-surface p-6">
                  <p className="text-sm font-semibold text-foreground">Start with a question, or try one of these:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EXAMPLES.map((e) => (
                      <button
                        key={e}
                        onClick={() => void submit(e)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/50"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    NitiSim will ask follow-ups if your question is missing key details (timing, financing, down payment). Every simulation is deterministic — NitiCore™ does the math; the AI only explains what it means.
                  </p>
                </div>
              </div>
            )}

            {turns.map((t) => {
              if (t.role === "user") {
                return (
                  <div key={t.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft">
                      {t.text}
                    </div>
                  </div>
                );
              }
              if (t.role === "assistant-error") {
                return (
                  <div key={t.id} className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                    {t.text}
                  </div>
                );
              }
              if (t.role === "assistant-ask") {
                return (
                  <div key={t.id} className="rounded-2xl border border-border bg-surface p-4 md:p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-soft text-secondary">
                        <MessageCircleQuestion className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Before I simulate</p>
                        <p className="mt-1 text-sm text-foreground">Answer any of these so I can plan this properly:</p>
                        <ul className="mt-3 space-y-2">
                          {t.questions.map((q, i) => (
                            <li key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">{q}</li>
                          ))}
                        </ul>
                        <p className="mt-3 text-[11px] text-muted-foreground">Type your answers in one message below — you can combine them.</p>
                      </div>
                    </div>
                  </div>
                );
              }
              if (t.role === "assistant-general") {
                return (
                  <div key={t.id} className="rounded-2xl border border-border bg-surface p-4 md:p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="prose prose-sm min-w-0 max-w-none text-foreground">
                        <ReactMarkdown>{t.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              }
              return <AssistantTurn key={t.id} result={t.result} />;
            })}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: "240ms" }} />
                {thinkingLabel}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void submit(question); }}
            className="border-t border-border p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(question);
                  }
                }}
                placeholder={rootQuestion ? "Reply to the follow-up above…" : "Ask a what-if question. Enter to send, Shift+Enter for a new line."}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
                aria-label="Ask NitiSim"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-[11px] italic text-muted-foreground">
          NitiSim explains updated NitiCore™ metrics — it never invents them. All history is stored locally in your browser.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

function AssistantTurn({ result }: { result: SimResult }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scenario</p>
          <span className="rounded-full bg-secondary-soft px-2.5 py-0.5 text-[10px] font-semibold text-secondary">Deterministic · NitiCore™</span>
        </div>
        <h3 className="mt-1 font-display text-lg text-foreground">{result.scenarioTitle}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SnapshotCard title="Current situation" snap={result.baseline} tone="muted" />
          <SnapshotCard title="Updated metrics" snap={result.simulated} tone="primary" compare={result.baseline} />
        </div>
        {result.propagation && result.propagation.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-card p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">How this change propagates</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {result.propagation.map((p, i) => (<li key={i}>{p}</li>))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft/40 to-card p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">NitiGuide™ explains</p>
            <div className="prose prose-sm mt-2 max-w-none text-foreground prose-p:my-2 prose-p:text-foreground/90 prose-strong:text-foreground">
              <ReactMarkdown>{result.explanation}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Snap = SimResult["baseline"];

function SnapshotCard({ title, snap, tone, compare }: { title: string; snap: Snap; tone: "muted" | "primary"; compare?: Snap }) {
  const ageLabel = snap.nitiAgeDirection === "ahead"
    ? `${snap.nitiAge} yrs · ahead by ${snap.nitiAgeDeltaYears}`
    : snap.nitiAgeDirection === "behind"
      ? `${snap.nitiAge} yrs · behind by ${snap.nitiAgeDeltaYears}`
      : `${snap.nitiAge} yrs · on par`;
  const rows: { label: string; value: string; base?: number; sim?: number; higherIsBetter: boolean }[] = [
    { label: "NitiScore™", value: `${snap.nitiScore}/1000 · ${snap.grade}`, base: compare?.nitiScore, sim: snap.nitiScore, higherIsBetter: true },
    { label: "NitiAge™", value: ageLabel, base: compare?.nitiAge, sim: snap.nitiAge, higherIsBetter: false },
    { label: "Net Worth", value: formatINR(snap.netWorth), base: compare?.netWorth, sim: snap.netWorth, higherIsBetter: true },
    { label: "Savings rate", value: `${snap.savingsRatePct.toFixed(1)}%`, base: compare?.savingsRatePct, sim: snap.savingsRatePct, higherIsBetter: true },
    { label: "Emergency fund", value: `${snap.emergencyMonths.toFixed(1)} mo`, base: compare?.emergencyMonths, sim: snap.emergencyMonths, higherIsBetter: true },
    { label: "Debt ratio", value: `${snap.debtRatioPct.toFixed(1)}%`, base: compare?.debtRatioPct, sim: snap.debtRatioPct, higherIsBetter: false },
    { label: "Insurance cover", value: `${snap.insuranceAdequacyPct.toFixed(0)}%`, base: compare?.insuranceAdequacyPct, sim: snap.insuranceAdequacyPct, higherIsBetter: true },
    { label: "Retirement", value: snap.retirementStatus.replace("_", " "), higherIsBetter: true },
  ];
  return (
    <div className={`rounded-xl border p-4 ${tone === "primary" ? "border-primary/40 bg-primary-soft/30" : "border-border bg-card"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              {r.value}
              {compare && r.base !== undefined && r.sim !== undefined && r.base !== r.sim && (
                <DeltaIcon delta={r.sim - r.base} higherIsBetter={r.higherIsBetter} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeltaIcon({ delta, higherIsBetter }: { delta: number; higherIsBetter: boolean }) {
  if (delta === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const good = higherIsBetter ? delta > 0 : delta < 0;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  return <Icon className={`h-3.5 w-3.5 ${good ? "text-secondary" : "text-warning"}`} />;
}
