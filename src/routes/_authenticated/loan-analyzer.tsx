import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Landmark, Loader2, Plus,
  RefreshCw, Sparkles, Trash2, AlertTriangle, ShieldCheck, TrendingDown,
  Target, Gauge, Hourglass, Info,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AnalysisSequence } from "@/components/analysis-sequence";
import { useConfirm } from "@/components/platform/confirm-dialog";
import { toast } from "sonner";
import {
  analyzeLoanServer, listLoanAnalyses, getLoanAnalysis, deleteLoanAnalysis,
  getLoanPortfolioSummary,
  type LoanListItem,
} from "@/lib/loan-analyzer/analyzer.functions";
import {
  LOAN_CATEGORY_LABEL,
  DEBT_QUALITY_BY_CATEGORY,
  emptyLoanInput,
  type LoanCategory,
  type LoanInput,
  type LoanReport,
} from "@/lib/loan-analyzer/types";
import { inr } from "@/lib/loan-analyzer/engine";

export const Route = createFileRoute("/_authenticated/loan-analyzer")({
  head: () => ({
    meta: [
      { title: "NitiLoan™ — Loan Analyzer — NitiVitt" },
      { name: "description", content: "Every loan analyzed the NitiCore™ way — Loan Health Score, Debt Freedom Age, prepayment intelligence and repayment strategies grounded in your whole financial life." },
    ],
  }),
  component: LoanAnalyzerPage,
});

type View =
  | { kind: "workspace" }
  | { kind: "form"; replaceId?: string; initial?: LoanInput }
  | { kind: "report"; report: LoanReport; loan: LoanInput }
  | { kind: "saved"; id: string };

const CATEGORIES: LoanCategory[] = [
  "home", "vehicle", "education", "personal", "credit_card",
  "business", "gold", "consumer_finance", "other",
];

function LoanAnalyzerPage() {
  const [view, setView] = useState<View>({ kind: "workspace" });
  return (
    <PageShell
      eyebrow="Service · NitiLoan™"
      title="Loan Analyzer"
      lede="Every loan you carry, scored the NitiCore™ way. Loan Health Score, Debt Freedom Age, prepayment intelligence and repayment strategies — grounded in your whole financial life."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {view.kind === "workspace" && (
          <Workspace
            onAddNew={() => setView({ kind: "form" })}
            onOpen={(id) => setView({ kind: "saved", id })}
            onReplace={(id, loan) => setView({ kind: "form", replaceId: id, initial: loan })}
          />
        )}
        {view.kind === "form" && (
          <LoanForm
            replaceId={view.replaceId}
            initial={view.initial}
            onCancel={() => setView({ kind: "workspace" })}
            onDone={(report, loan) => setView({ kind: "report", report, loan })}
          />
        )}
        {view.kind === "report" && (
          <ReportView report={view.report} loan={view.loan} onBack={() => setView({ kind: "workspace" })} />
        )}
        {view.kind === "saved" && (
          <SavedView id={view.id} onBack={() => setView({ kind: "workspace" })} />
        )}
      </div>
    </PageShell>
  );
}

// ─────────────────────────── WORKSPACE ──────────────────────────

function Workspace({
  onAddNew, onOpen, onReplace,
}: {
  onAddNew: () => void;
  onOpen: (id: string) => void;
  onReplace: (id: string, loan: LoanInput) => void;
}) {
  const listFn = useServerFn(listLoanAnalyses);
  const summaryFn = useServerFn(getLoanPortfolioSummary);
  const getFn = useServerFn(getLoanAnalysis);
  const deleteFn = useServerFn(deleteLoanAnalysis);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const listQ = useQuery({ queryKey: ["loan-analyses"], queryFn: () => listFn() });
  const summaryQ = useQuery({ queryKey: ["loan-portfolio-summary"], queryFn: () => summaryFn() });

  async function onDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Remove this loan?",
      description: `${name} will be removed from your NitiLoan™ workspace. This cannot be undone.`,
      confirmLabel: "Remove loan",
      tone: "destructive",
    });
    if (!ok) return;
    await deleteFn({ data: { id } });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["loan-analyses"] }),
      qc.invalidateQueries({ queryKey: ["loan-portfolio-summary"] }),
      qc.invalidateQueries({ queryKey: ["niti-guide-briefing"] }),
    ]);
    toast.success("Loan removed.");
  }

  async function onReplaceClicked(id: string) {
    const res = await getFn({ data: { id } });
    if (res.analysis) onReplace(id, res.analysis.loan);
  }

  const analyses = listQ.data?.analyses ?? [];
  const summary = summaryQ.data?.summary ?? null;
  const isLoading = listQ.isLoading || summaryQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">Your loans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading your debt intelligence…"
              : analyses.length === 0
                ? "Add your first loan to see how it fits into your whole plan."
                : `${analyses.length} loan${analyses.length === 1 ? "" : "s"} tracked · every one scored deterministically.`}
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {analyses.length === 0 ? "Analyze Loan" : "Analyze New Loan"}
        </button>
      </div>

      {!isLoading && summary && summary.loanCount > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="font-display text-2xl text-foreground">NitiLoan™ Portfolio</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Debt intelligence summary</p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className={`font-display text-5xl ${summary.averageHealthScore >= 70 ? "text-success" : summary.averageHealthScore >= 50 ? "text-primary" : "text-warning"}`}>{summary.averageHealthScore}</span>
                <span className="text-sm text-muted-foreground">avg Loan Health · / 100</span>
              </div>
              {summary.poorDebtCount > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                  <AlertTriangle className="h-3 w-3" /> {summary.poorDebtCount} poor-quality loan{summary.poorDebtCount === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <StatBlock label="Total outstanding" value={inr(summary.totalOutstanding)} />
              <StatBlock label="Total EMI/mo" value={inr(summary.totalMonthlyEmi)} />
              <StatBlock label="Weighted rate" value={`${summary.weightedInterestRate.toFixed(2)}%`} />
              <StatBlock label="Loans" value={String(summary.loanCount)} />
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Landmark className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 font-display text-xl text-foreground">No loans analyzed yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            NitiLoan™ evaluates each loan against your whole financial life — affordability, buffer, insurance, interest cost — not just the EMI.
          </p>
          <button onClick={onAddNew} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Analyze your first loan
          </button>
        </div>
      ) : (
        <LoanList analyses={analyses} onOpen={onOpen} onReplace={onReplaceClicked} onDelete={onDelete} />
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function LoanList({ analyses, onOpen, onReplace, onDelete }: {
  analyses: LoanListItem[];
  onOpen: (id: string) => void;
  onReplace: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="font-display text-lg text-foreground">My loans</h3>
      <div className="mt-4 divide-y divide-border">
        {analyses.map((a) => {
          const quality = DEBT_QUALITY_BY_CATEGORY[a.category];
          const qCls = quality === "healthy" ? "bg-success-soft text-success"
            : quality === "neutral" ? "bg-primary-soft text-primary"
              : "bg-warning-soft text-warning";
          return (
            <div key={a.id} className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {LOAN_CATEGORY_LABEL[a.category]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${qCls}`}>
                    {quality} debt
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    a.loanHealthScore >= 70 ? "bg-success-soft text-success"
                      : a.loanHealthScore >= 50 ? "bg-primary-soft text-primary"
                        : "bg-warning-soft text-warning"
                  }`}>
                    Health {a.loanHealthScore}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{a.name}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {a.lender ? `${a.lender} · ` : ""}Outstanding {inr(a.outstanding)} · EMI {inr(a.monthlyEmi)}/mo · {a.interestRate.toFixed(2)}%
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button onClick={() => onOpen(a.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
                  Open
                </button>
                <button onClick={() => onReplace(a.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
                  <RefreshCw className="h-3 w-3" /> Update
                </button>
                <button onClick={() => onDelete(a.id, a.name)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────── FORM ──────────────────────────

function LoanForm({ replaceId, initial, onCancel, onDone }: {
  replaceId?: string;
  initial?: LoanInput;
  onCancel: () => void;
  onDone: (report: LoanReport, loan: LoanInput) => void;
}) {
  const analyzeFn = useServerFn(analyzeLoanServer);
  const qc = useQueryClient();
  const [loan, setLoan] = useState<LoanInput>(initial ?? emptyLoanInput());
  const [busy, setBusy] = useState(false);

  function set<K extends keyof LoanInput>(key: K, value: LoanInput[K]) {
    setLoan((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!loan.name.trim()) { toast.error("Give this loan a name."); return; }
    if (loan.outstanding <= 0) { toast.error("Outstanding must be greater than zero."); return; }
    if (loan.monthlyEmi <= 0) { toast.error("Monthly EMI must be greater than zero."); return; }
    setBusy(true);
    try {
      const res = await analyzeFn({
        data: {
          loan: {
            name: loan.name.trim(),
            category: loan.category,
            lender: loan.lender ?? null,
            principal: loan.principal,
            outstanding: loan.outstanding,
            interestRate: loan.interestRate,
            tenureMonths: loan.tenureMonths,
            remainingMonths: loan.remainingMonths ?? null,
            monthlyEmi: loan.monthlyEmi,
            annualPrepayment: loan.annualPrepayment ?? 0,
            taxDeductible: loan.taxDeductible ?? false,
          },
          narrate: true,
          replaceId,
        },
      });
      toast.success("Loan analyzed and saved.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["loan-analyses"] }),
        qc.invalidateQueries({ queryKey: ["loan-portfolio-summary"] }),
        qc.invalidateQueries({ queryKey: ["niti-guide-briefing"] }),
      ]);
      onDone(res.report, loan);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {busy && (
        <AnalysisSequence
          onComplete={() => { /* no-op */ }}
          stepDurationMs={480}
          title="Running NitiLoan™ analysis"
          subtitle="Scoring loan health, projecting debt freedom age and comparing repayment strategies."
          steps={[
            { id: "afford", label: "Checking affordability" },
            { id: "burden", label: "Measuring debt burden" },
            { id: "cost", label: "Computing post-tax interest cost" },
            { id: "quality", label: "Classifying debt quality" },
            { id: "freedom", label: "Projecting Debt Freedom Age" },
            { id: "prepay", label: "Running prepay-vs-invest math" },
            { id: "sim", label: "Simulating repayment strategies" },
            { id: "impact", label: "Assessing impact on your plan" },
            { id: "guide", label: "Preparing NitiGuide™ briefing" },
          ]}
        />
      )}

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
            {replaceId ? "Update loan" : "Add a loan"}
          </span>
        </div>
        <div>
          <h2 className="font-display text-2xl text-foreground">Loan details</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter the numbers exactly as they appear on your latest statement. NitiLoan™ never invents values.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" placeholder="e.g. HDFC Home Loan" value={loan.name} onChange={(v) => set("name", v)} />
          <SelectField label="Category" value={loan.category} onChange={(v) => set("category", v as LoanCategory)} options={CATEGORIES.map((c) => ({ value: c, label: LOAN_CATEGORY_LABEL[c] }))} />
          <TextField label="Lender (optional)" placeholder="e.g. HDFC Bank" value={loan.lender ?? ""} onChange={(v) => set("lender", v)} />
          <NumField label="Original principal (₹)" value={loan.principal} onChange={(v) => set("principal", v)} />
          <NumField label="Current outstanding (₹)" value={loan.outstanding} onChange={(v) => set("outstanding", v)} />
          <NumField label="Interest rate (%)" value={loan.interestRate} onChange={(v) => set("interestRate", v)} step={0.05} />
          <NumField label="Original tenure (months)" value={loan.tenureMonths} onChange={(v) => set("tenureMonths", v)} />
          <NumField label="Remaining tenure (months, optional)" value={loan.remainingMonths ?? 0} onChange={(v) => set("remainingMonths", v || null)} />
          <NumField label="Monthly EMI (₹)" value={loan.monthlyEmi} onChange={(v) => set("monthlyEmi", v)} />
          <NumField label="Annual prepayment (₹, optional)" value={loan.annualPrepayment ?? 0} onChange={(v) => set("annualPrepayment", v)} />
        </div>

        <label className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
          <input type="checkbox" checked={loan.taxDeductible ?? false} onChange={(e) => set("taxDeductible", e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" />
          <span>
            <span className="font-semibold text-foreground">Interest qualifies for tax deduction</span>
            <span className="ml-1 text-muted-foreground">(home loan Section 24 / education loan Section 80E)</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Analyzing…" : replaceId ? "Update and re-analyze" : "Analyze loan"}
          </button>
          <p className="text-[11px] text-muted-foreground">Every calculation is deterministic. AI narrates the findings — it never adjusts the math.</p>
        </div>
      </div>
    </>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
    </label>
  );
}
function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input inputMode="decimal" step={step ?? 1} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
    </label>
  );
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ─────────────────────────── SAVED ──────────────────────────

function SavedView({ id, onBack }: { id: string; onBack: () => void }) {
  const getFn = useServerFn(getLoanAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["loan-analysis", id],
    queryFn: () => getFn({ data: { id } }),
  });
  if (isLoading) return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!data?.analysis) return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
      <p className="text-sm text-muted-foreground">Loan not found.</p>
      <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
    </div>
  );
  return <ReportView report={data.analysis.report} loan={data.analysis.loan} onBack={onBack} />;
}

// ─────────────────────────── REPORT ──────────────────────────

function ReportView({ report, loan, onBack }: { report: LoanReport; loan: LoanInput; onBack: () => void }) {
  const recommended = report.strategies.find((s) => s.isRecommended);
  const qBadge = report.debtQuality;
  const qCls =
    qBadge.quality === "healthy" ? "bg-success-soft text-success"
      : qBadge.quality === "neutral" ? "bg-primary-soft text-primary"
        : "bg-warning-soft text-warning";
  const verdict = report.prepayment.verdict;
  const verdictCls = verdict === "prepay" ? "bg-warning-soft text-warning"
    : verdict === "invest" ? "bg-success-soft text-success" : "bg-primary-soft text-primary";

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
      </button>

      {/* HERO */}
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary-soft/50 via-card to-card p-6 shadow-elevated md:p-10">
        <div className="grid gap-8 md:grid-cols-[auto,1fr] md:items-center">
          <ScoreDial score={report.loanHealthScore} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Loan Health Score</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-foreground md:text-4xl">{report.scoreLabel}</h2>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{loan.name} · {LOAN_CATEGORY_LABEL[loan.category]}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${qCls}`}>{qBadge.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verdictCls}`}>Prepay-vs-invest: {verdict}</span>
              {loan.taxDeductible && <span className="rounded-full bg-secondary-soft px-2.5 py-1 text-xs font-semibold text-secondary">Tax-deductible</span>}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">{qBadge.description}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat label="Outstanding" value={inr(report.totalOutstanding)} />
          <HeroStat label="Monthly EMI" value={inr(report.monthlyEmi)} sub={`${report.emiToIncomePct.toFixed(1)}% of income`} />
          <HeroStat label="Effective cost" value={`${report.effectiveInterestCost.toFixed(2)}%`} sub={loan.taxDeductible ? "post-tax" : "gross"} />
          <HeroStat label="Debt-free age" value={String(report.debtFreedomAgeToday)} sub="if you keep the current plan" />
        </div>
      </section>

      {/* Score breakdown */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Gauge className="h-4 w-4 text-primary" />} title="Loan Health breakdown" subtitle="Every pillar of the score, transparently." />
        <ul className="mt-4 space-y-2.5">
          {report.breakdown.map((b) => (
            <li key={b.pillar}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{b.pillar} <span className="text-[10px] text-muted-foreground">· weight {b.weight}%</span></span>
                <span className="font-mono text-xs text-muted-foreground">{b.score}/100</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${b.score >= 75 ? "bg-secondary" : b.score >= 50 ? "bg-primary" : "bg-warning"}`} style={{ width: `${b.score}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{b.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Debt Freedom scenarios */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Hourglass className="h-4 w-4 text-primary" />} title="Debt Freedom Age" subtitle="When this loan closes under different repayment behaviours." />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {report.scenarios.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-3xl text-foreground">{s.ageAtFreedom}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Loan closes in {Math.floor(s.monthsToFreedom / 12)}y {s.monthsToFreedom % 12}m</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prepayment Intelligence */}
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
        <SectionHeading icon={<Target className="h-4 w-4 text-primary" />} title="Prepayment Intelligence" subtitle="Deterministic prepay-vs-invest reasoning — grounded in cost, expected return, tax and your risk profile." />
        <div className="mt-4 grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Post-tax loan cost</p>
            <p className="mt-1 font-mono text-lg text-foreground">{report.prepayment.loanEffectiveCostPct.toFixed(2)}%</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expected equity return</p>
            <p className="mt-1 font-mono text-lg text-foreground">{report.prepayment.expectedInvestmentReturnPct.toFixed(2)}%</p>
          </div>
          <div>
            <p className="font-display text-xl text-foreground">{report.prepayment.headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.prepayment.reasoning}</p>
            <div className="mt-3 rounded-lg bg-card/60 p-3 text-xs text-foreground">
              <p className="font-semibold text-primary">Opportunity cost</p>
              <p className="mt-1 text-muted-foreground">{report.prepayment.opportunityCostNote}</p>
            </div>
            {report.prepayment.tradeOffs.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {report.prepayment.tradeOffs.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Repayment Strategy Simulator */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<TrendingDown className="h-4 w-4 text-primary" />} title="Repayment Strategy Simulator" subtitle="Deterministic comparisons — interest saved, years saved, debt freedom age." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Strategy</th>
                <th className="px-3 py-2 text-right">Monthly outflow</th>
                <th className="px-3 py-2 text-right">Total interest</th>
                <th className="px-3 py-2 text-right">Interest saved</th>
                <th className="px-3 py-2 text-right">Years saved</th>
                <th className="px-3 py-2 text-right">Debt-free age</th>
              </tr>
            </thead>
            <tbody>
              {report.strategies.map((s) => (
                <tr key={s.id} className={`border-t border-border ${s.isRecommended ? "bg-primary-soft/30" : ""}`}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-foreground">
                      {s.name}
                      {s.isRecommended && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">Recommended</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{s.description}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{inr(s.monthlyOutflow)}{s.annualPrepayment > 0 ? <span className="ml-1 text-[10px] text-muted-foreground">+ ₹{Math.round(s.annualPrepayment).toLocaleString("en-IN")}/yr</span> : null}</td>
                  <td className="px-3 py-2 text-right font-mono">{inr(s.totalInterest)}</td>
                  <td className="px-3 py-2 text-right font-mono text-success">{s.interestSavedVsCurrent > 0 ? inr(s.interestSavedVsCurrent) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-success">{s.monthsSavedVsCurrent > 0 ? `${Math.floor(s.monthsSavedVsCurrent / 12)}y ${s.monthsSavedVsCurrent % 12}m` : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.debtFreedomAge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recommended && recommended.tradeOffs.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-xs">
            <p className="font-semibold text-foreground">Trade-offs of the recommended strategy</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {recommended.tradeOffs.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* Impact on plan */}
      {report.impactOnPlan.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <SectionHeading icon={<ShieldCheck className="h-4 w-4 text-primary" />} title="Impact on your wider plan" subtitle="How this loan interacts with your NitiScore™, savings and protection." />
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {report.impactOnPlan.map((f) => <FindingItem key={f.id} f={f} />)}
          </ul>
        </section>
      )}

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <section>
          <SectionHeading icon={<CheckCircle2 className="h-4 w-4 text-success" />} title="What is working" />
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {report.strengths.map((f) => <FindingItem key={f.id} f={f} />)}
          </ul>
        </section>
      )}

      {/* Risks */}
      {report.risks.length > 0 && (
        <section>
          <SectionHeading icon={<AlertTriangle className="h-4 w-4 text-warning" />} title="Risks & attention areas" />
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {report.risks.map((f) => <FindingItem key={f.id} f={f} />)}
          </ul>
        </section>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <SectionHeading icon={<Target className="h-4 w-4 text-primary" />} title="Recommended actions" subtitle="Ordered by NitiCore hierarchy — protection and buffer before optimisation." />
          <ul className="mt-4 space-y-3">
            {report.recommendations.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.priority === "high" ? "bg-destructive/10 text-destructive"
                      : r.priority === "medium" ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}>{r.priority}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                <p className="mt-2 text-sm text-foreground/90"><strong>Expected benefit:</strong> {r.expectedBenefit}</p>
                {r.tradeOffs.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {r.tradeOffs.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                )}
                {r.crossPillarNote && (
                  <p className="mt-2 rounded-md bg-accent/10 px-2 py-1 text-[11px] text-accent-foreground">{r.crossPillarNote}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* NitiGuide */}
      {report.mentorSummary && (
        <section className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">NitiGuide™ · loan review</p>
          </div>
          <div className="mt-3 space-y-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {report.mentorSummary}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">NitiGuide explains the deterministic findings above. It never recommends specific lenders or refinance offers.</p>
        </section>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground">
          Fixing this loan will also move your NitiScore™. See the whole picture in your{" "}
          <Link to="/financial-health" className="font-semibold text-primary hover:underline">Financial Health Report</Link>.
        </p>
      </div>
    </div>
  );
}

function FindingItem({ f }: { f: LoanReport["strengths"][number] }) {
  const cls = f.tone === "success" ? "border-success/30 bg-success-soft/30"
    : f.tone === "warning" ? "border-warning/30 bg-warning-soft/30"
      : f.tone === "danger" ? "border-destructive/30 bg-destructive/5"
        : "border-border bg-surface";
  const icon = f.tone === "success" ? <CheckCircle2 className="h-4 w-4 text-success" />
    : f.tone === "warning" ? <AlertTriangle className="h-4 w-4 text-warning" />
      : f.tone === "danger" ? <AlertTriangle className="h-4 w-4 text-destructive" />
        : <Info className="h-4 w-4 text-muted-foreground" />;
  return (
    <li className={`flex gap-3 rounded-xl border p-4 ${cls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground">{f.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
      </div>
    </li>
  );
}

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">{icon}<h3 className="font-display text-lg text-foreground">{title}</h3></div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const color = s >= 75 ? "hsl(var(--success, 145 60% 40%))"
    : s >= 55 ? "hsl(var(--primary))"
      : "hsl(var(--warning, 35 90% 50%))";
  const bg = `conic-gradient(${color} ${s * 3.6}deg, hsl(var(--muted)) 0deg)`;
  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full" style={{ background: bg }}>
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-card">
        <span className="font-display text-4xl leading-none text-foreground">{s}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
