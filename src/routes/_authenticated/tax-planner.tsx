import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, CheckCircle2, Info, Loader2, Plus, Receipt, RefreshCw,
  Sparkles, Trash2, AlertTriangle, Scale, ListChecks, PiggyBank, Target,
  MessageCircleQuestion, Wallet,
} from "lucide-react";
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageShell } from "@/components/page-shell";
import { AnalysisSequence } from "@/components/analysis-sequence";
import { EmptyState } from "@/components/platform/empty-state";
import { useConfirm } from "@/components/platform/confirm-dialog";
import { toast } from "sonner";
import { formatIndianNumber, parseIndianNumber, sanitizeNumericInput } from "@/lib/format-number";
import {
  analyzeTaxServer, askTaxQuestion, deleteTaxAnalysis, getTaxAnalysis,
  getTaxPrefill, getTaxSummary, listTaxAnalyses, type TaxListItem,
} from "@/lib/tax-analyzer/analyzer.functions";
import { inr } from "@/lib/tax-analyzer/engine";
import {
  EMPLOYMENT_LABEL, emptyTaxInput,
  type EmploymentType, type TaxInput, type TaxRegime, type TaxReport,
} from "@/lib/tax-analyzer/types";

export const Route = createFileRoute("/_authenticated/tax-planner")({
  head: () => ({
    meta: [
      { title: "NitiTax™ — Tax Decision Engine — NitiVitt" },
      { name: "description", content: "Old vs new regime, deductions, capital gains and a year-end action plan — decided deterministically, explained like a tax consultation." },
      { property: "og:title", content: "NitiTax™ — Tax Decision Engine — NitiVitt" },
      { property: "og:description", content: "Pay the least tax legally possible, and make smarter money decisions all year." },
    ],
  }),
  component: TaxPlannerPage,
});

type View =
  | { kind: "workspace" }
  | { kind: "form"; replaceId?: string; initial?: TaxInput; name?: string }
  | { kind: "report"; report: TaxReport }
  | { kind: "saved"; id: string };

const PALETTE = ["#3f6f9e", "#57937f", "#c1874b", "#8a6ea8", "#c96a63", "#6e8ea3", "#9aa66c"];

function TaxPlannerPage() {
  const [view, setView] = useState<View>({ kind: "workspace" });
  return (
    <PageShell
      eyebrow="Service · NitiTax™"
      title="Tax Planner"
      lede="NitiTax™ is not a calculator. It is a decision engine — it works out the regime, the deductions and the year-end moves that legally leave the most money with you."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {view.kind === "workspace" && (
          <Workspace
            onAddNew={() => setView({ kind: "form" })}
            onOpen={(id) => setView({ kind: "saved", id })}
            onUpdate={(id, input, name) => setView({ kind: "form", replaceId: id, initial: input, name })}
          />
        )}
        {view.kind === "form" && (
          <TaxForm
            replaceId={view.replaceId}
            initial={view.initial}
            initialName={view.name}
            onCancel={() => setView({ kind: "workspace" })}
            onDone={(report) => setView({ kind: "report", report })}
          />
        )}
        {view.kind === "report" && (
          <ReportView report={view.report} onBack={() => setView({ kind: "workspace" })} />
        )}
        {view.kind === "saved" && (
          <SavedView id={view.id} onBack={() => setView({ kind: "workspace" })} />
        )}
      </div>
    </PageShell>
  );
}

// ─────────────────────────── WORKSPACE ──────────────────────────

function Workspace({ onAddNew, onOpen, onUpdate }: {
  onAddNew: () => void;
  onOpen: (id: string) => void;
  onUpdate: (id: string, input: TaxInput, name: string) => void;
}) {
  const listFn = useServerFn(listTaxAnalyses);
  const summaryFn = useServerFn(getTaxSummary);
  const getFn = useServerFn(getTaxAnalysis);
  const deleteFn = useServerFn(deleteTaxAnalysis);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const listQ = useQuery({ queryKey: ["tax-analyses"], queryFn: () => listFn() });
  const summaryQ = useQuery({ queryKey: ["tax-summary"], queryFn: () => summaryFn() });

  const analyses = listQ.data?.analyses ?? [];
  const summary = summaryQ.data?.summary ?? null;
  const isLoading = listQ.isLoading || summaryQ.isLoading;

  async function onDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Remove this tax review?",
      description: `${name} will be removed from your NitiTax™ workspace. This cannot be undone.`,
      confirmLabel: "Remove review",
      tone: "destructive",
    });
    if (!ok) return;
    await deleteFn({ data: { id } });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["tax-analyses"] }),
      qc.invalidateQueries({ queryKey: ["tax-summary"] }),
      qc.invalidateQueries({ queryKey: ["niti-guide-briefing"] }),
    ]);
    toast.success("Tax review removed.");
  }

  async function onUpdateClicked(id: string) {
    const res = await getFn({ data: { id } });
    if (res.analysis) onUpdate(id, res.analysis.input, res.analysis.name);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">Your tax reviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading your tax intelligence…"
              : analyses.length === 0
                ? "Run your first review to see which regime actually costs you less."
                : `${analyses.length} review${analyses.length === 1 ? "" : "s"} saved · every rupee computed deterministically.`}
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {analyses.length === 0 ? "Run Tax Review" : "New Tax Review"}
        </button>
      </div>

      {!isLoading && summary && summary.analysisCount > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Latest position</p>
          <p className="mt-1 font-display text-2xl text-foreground">
            {summary.latestRegime === "old" ? "Old regime" : "New regime"} recommended
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBlock label="Tax payable" value={inr(summary.latestTaxPayable)} />
            <StatBlock label="Effective rate" value={`${summary.latestEffectiveRate.toFixed(2)}%`} />
            <StatBlock label="Unused capacity" value={inr(summary.unusedCapacity)} />
            <StatBlock label="Reviews" value={String(summary.analysisCount)} />
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : analyses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          eyebrow="NitiTax™"
          title="No tax review yet"
          description="NitiTax™ compares both regimes on your actual numbers, finds the deductions you are leaving on the table, and gives you an ordered checklist before 31 March. No score, no grade — just better decisions."
          action={
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-elevated"
            >
              <Plus className="h-4 w-4" /> Run your first tax review
            </button>
          }
        />
      ) : (
        <TaxList analyses={analyses} onOpen={onOpen} onUpdate={onUpdateClicked} onDelete={onDelete} />
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

function TaxList({ analyses, onOpen, onUpdate, onDelete }: {
  analyses: TaxListItem[];
  onOpen: (id: string) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="font-display text-lg text-foreground">Saved reviews</h3>
      <div className="mt-4 divide-y divide-border">
        {analyses.map((a) => (
          <div key={a.id} className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {a.taxYear}
                </span>
                <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                  {a.recommendedRegime === "old" ? "Old regime" : "New regime"}
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{a.name}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Gross {inr(a.grossIncome)} · Tax {inr(a.totalTax)} · Effective {a.effectiveRatePct.toFixed(2)}%
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button onClick={() => onOpen(a.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
                Open
              </button>
              <button onClick={() => onUpdate(a.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
                <RefreshCw className="h-3 w-3" /> Update
              </button>
              <button onClick={() => onDelete(a.id, a.name)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── FORM ──────────────────────────

const EMPLOYMENT: EmploymentType[] = ["salaried", "self_employed", "business", "freelancer", "other"];

function TaxForm({ replaceId, initial, initialName, onCancel, onDone }: {
  replaceId?: string;
  initial?: TaxInput;
  initialName?: string;
  onCancel: () => void;
  onDone: (report: TaxReport) => void;
}) {
  const analyzeFn = useServerFn(analyzeTaxServer);
  const prefillFn = useServerFn(getTaxPrefill);
  const qc = useQueryClient();
  const [input, setInput] = useState<TaxInput>(initial ?? emptyTaxInput());
  const [name, setName] = useState(initialName ?? "FY 2025-26 Tax Review");
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState<{ sources: string[]; missing: string[] } | null>(null);
  const [prefilling, setPrefilling] = useState(false);

  function patch(fn: (draft: TaxInput) => void) {
    setInput((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }

  async function loadFromNitiVitt() {
    setPrefilling(true);
    try {
      const res = await prefillFn();
      setInput(res.input);
      setPrefilled({ sources: res.sources, missing: res.missing });
      toast.success("Pulled everything NitiVitt already knows about you.");
    } catch {
      toast.error("Could not read your NitiVitt profile.");
    } finally {
      setPrefilling(false);
    }
  }

  async function submit() {
    const gross = input.salary.basic + input.salary.hra + input.salary.specialAllowance +
      input.salary.lta + input.salary.bonus + input.otherIncome.interest +
      input.otherIncome.rental + input.otherIncome.dividend + input.otherIncome.business +
      input.otherIncome.other;
    if (gross <= 0) { toast.error("Enter at least one source of income."); return; }
    setBusy(true);
    try {
      const res = await analyzeFn({
        data: { name: name.trim() || "Tax Review", input, narrate: true, replaceId },
      });
      toast.success("Tax review complete and saved.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tax-analyses"] }),
        qc.invalidateQueries({ queryKey: ["tax-summary"] }),
        qc.invalidateQueries({ queryKey: ["niti-guide-briefing"] }),
      ]);
      onDone(res.report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tax analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {busy && (
        <AnalysisSequence
          onComplete={() => { /* no-op */ }}
          stepDurationMs={470}
          title="Running NitiTax™ decision engine"
          subtitle="Computing both regimes, mapping deductions and building your year-end plan."
          steps={[
            { id: "income", label: "Consolidating every income head" },
            { id: "hra", label: "Applying HRA and house-property rules" },
            { id: "via", label: "Applying Chapter VI-A ceilings" },
            { id: "old", label: "Computing the old regime" },
            { id: "new", label: "Computing the new regime" },
            { id: "cg", label: "Taxing capital gains under 111A / 112A" },
            { id: "surcharge", label: "Adding surcharge and cess" },
            { id: "gaps", label: "Finding unused deduction capacity" },
            { id: "plan", label: "Building the year-end action plan" },
            { id: "guide", label: "Preparing NitiGuide™ advisory" },
          ]}
        />
      )}

      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
            {replaceId ? "Update review" : "New review"} · FY 2025-26
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-foreground">Your tax picture</h2>
            <p className="mt-1 text-sm text-muted-foreground">Only fill what applies. NitiTax™ never invents a number you did not give it.</p>
          </div>
          <button
            onClick={loadFromNitiVitt}
            disabled={prefilling}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary-soft px-4 py-2 text-xs font-semibold text-primary hover:bg-primary-soft/80 disabled:opacity-50"
          >
            {prefilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Prefill from my NitiVitt data
          </button>
        </div>

        {prefilled && (
          <div className="rounded-xl border border-border bg-surface p-4 text-xs">
            <p className="font-semibold text-foreground">Pulled from your existing NitiVitt data</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {prefilled.sources.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
            {prefilled.missing.length > 0 && (
              <p className="mt-2 text-muted-foreground">
                Still needed from you: {prefilled.missing.join(", ")}. Salary splits are estimates — correct them if your payslip differs.
              </p>
            )}
          </div>
        )}

        <TextField label="Review name" value={name} onChange={setName} placeholder="FY 2025-26 Tax Review" />

        <FormSection title="About you">
          <IntField label="Age (years)" value={input.ageYears} onChange={(v) => patch((d) => { d.ageYears = v || 30; })} />
          <SelectField
            label="Employment type"
            value={input.employmentType}
            onChange={(v) => patch((d) => { d.employmentType = v as EmploymentType; })}
            options={EMPLOYMENT.map((e) => ({ value: e, label: EMPLOYMENT_LABEL[e] }))}
          />
          <SelectField
            label="City type (for HRA)"
            value={input.cityMetro ? "metro" : "non_metro"}
            onChange={(v) => patch((d) => { d.cityMetro = v === "metro"; d.hra.cityType = v as "metro" | "non_metro"; })}
            options={[{ value: "metro", label: "Metro (50% of basic)" }, { value: "non_metro", label: "Non-metro (40% of basic)" }]}
          />
          <SelectField
            label="Regime"
            value={input.regimePreference ?? "auto"}
            onChange={(v) => patch((d) => { d.regimePreference = v === "auto" ? null : (v as TaxRegime); })}
            options={[
              { value: "auto", label: "Let NitiTax recommend" },
              { value: "old", label: "Force old regime" },
              { value: "new", label: "Force new regime" },
            ]}
          />
        </FormSection>

        <FormSection title="Salary income (annual)">
          <MoneyField label="Basic salary" value={input.salary.basic} onChange={(v) => patch((d) => { d.salary.basic = v; })} />
          <MoneyField label="HRA received" value={input.salary.hra} onChange={(v) => patch((d) => { d.salary.hra = v; })} />
          <MoneyField label="Special allowance" value={input.salary.specialAllowance} onChange={(v) => patch((d) => { d.salary.specialAllowance = v; })} />
          <MoneyField label="LTA" value={input.salary.lta} onChange={(v) => patch((d) => { d.salary.lta = v; })} />
          <MoneyField label="Bonus / variable pay" value={input.salary.bonus} onChange={(v) => patch((d) => { d.salary.bonus = v; })} />
          <MoneyField label="Professional tax paid" value={input.salary.professionalTax} onChange={(v) => patch((d) => { d.salary.professionalTax = v; })} />
          <MoneyField label="Employer NPS contribution" value={input.d80ccd.employerNps} onChange={(v) => patch((d) => { d.d80ccd.employerNps = v; d.salary.employerNps = v; })} />
          <MoneyField label="Monthly rent you pay" value={input.hra.monthlyRentPaid} onChange={(v) => patch((d) => { d.hra.monthlyRentPaid = v; })} />
        </FormSection>

        <FormSection title="Other income (annual)">
          <MoneyField label="Interest (FD + savings)" value={input.otherIncome.interest} onChange={(v) => patch((d) => { d.otherIncome.interest = v; })} />
          <MoneyField label="Rent received" value={input.otherIncome.rental} onChange={(v) => patch((d) => { d.otherIncome.rental = v; })} />
          <MoneyField label="Dividend" value={input.otherIncome.dividend} onChange={(v) => patch((d) => { d.otherIncome.dividend = v; })} />
          <MoneyField label="Business / professional (net)" value={input.otherIncome.business} onChange={(v) => patch((d) => { d.otherIncome.business = v; })} />
          <MoneyField label="Other income" value={input.otherIncome.other} onChange={(v) => patch((d) => { d.otherIncome.other = v; })} />
        </FormSection>

        <FormSection title="Capital gains booked this year">
          <MoneyField label="Long-term equity (112A)" value={input.capitalGains.ltcgEquity} onChange={(v) => patch((d) => { d.capitalGains.ltcgEquity = v; })} />
          <MoneyField label="Short-term equity (111A)" value={input.capitalGains.stcgEquity} onChange={(v) => patch((d) => { d.capitalGains.stcgEquity = v; })} />
          <MoneyField label="Debt fund gains (long-term)" value={input.capitalGains.ltcgDebt} onChange={(v) => patch((d) => { d.capitalGains.ltcgDebt = v; })} />
          <MoneyField label="Debt fund gains (short-term)" value={input.capitalGains.stcgDebt} onChange={(v) => patch((d) => { d.capitalGains.stcgDebt = v; })} />
          <MoneyField label="Property long-term gain" value={input.capitalGains.ltcgProperty} onChange={(v) => patch((d) => { d.capitalGains.ltcgProperty = v; })} />
          <MoneyField label="Other gains" value={input.capitalGains.otherGains} onChange={(v) => patch((d) => { d.capitalGains.otherGains = v; })} />
        </FormSection>

        <FormSection title="Section 80C (₹1,50,000 ceiling)">
          <MoneyField label="EPF (your share)" value={input.d80c.epfEmployee} onChange={(v) => patch((d) => { d.d80c.epfEmployee = v; })} />
          <MoneyField label="PPF" value={input.d80c.ppf} onChange={(v) => patch((d) => { d.d80c.ppf = v; })} />
          <MoneyField label="ELSS" value={input.d80c.elss} onChange={(v) => patch((d) => { d.d80c.elss = v; })} />
          <MoneyField label="Life insurance premium" value={input.d80c.lifeInsurancePremium} onChange={(v) => patch((d) => { d.d80c.lifeInsurancePremium = v; })} />
          <MoneyField label="Children's tuition fees" value={input.d80c.childTuition} onChange={(v) => patch((d) => { d.d80c.childTuition = v; })} />
          <MoneyField label="Home-loan principal repaid" value={input.d80c.homeLoanPrincipal} onChange={(v) => patch((d) => { d.d80c.homeLoanPrincipal = v; })} />
          <MoneyField label="NSC / other 80C" value={input.d80c.other80c} onChange={(v) => patch((d) => { d.d80c.other80c = v; })} />
          <MoneyField label="NPS Tier-1, your own — 80CCD(1B)" value={input.d80ccd.additionalNps} onChange={(v) => patch((d) => { d.d80ccd.additionalNps = v; })} />
        </FormSection>

        <FormSection title="Health, home and other deductions">
          <MoneyField label="Health premium (self + family)" value={input.d80d.selfFamilyPremium} onChange={(v) => patch((d) => { d.d80d.selfFamilyPremium = v; })} />
          <MoneyField label="Health premium (parents)" value={input.d80d.parentsPremium} onChange={(v) => patch((d) => { d.d80d.parentsPremium = v; })} />
          <MoneyField label="Preventive health check-up" value={input.d80d.preventiveHealthCheck} onChange={(v) => patch((d) => { d.d80d.preventiveHealthCheck = v; })} />
          <MoneyField label="Home-loan interest — Sec 24(b)" value={input.otherDeductions.homeLoanInterestSelf} onChange={(v) => patch((d) => { d.otherDeductions.homeLoanInterestSelf = v; })} />
          <MoneyField label="Education-loan interest — 80E" value={input.otherDeductions.educationLoanInterest} onChange={(v) => patch((d) => { d.otherDeductions.educationLoanInterest = v; })} />
          <MoneyField label="Donations — 80G" value={input.otherDeductions.charity80G} onChange={(v) => patch((d) => { d.otherDeductions.charity80G = v; })} />
          <MoneyField
            label={input.ageYears >= 60 ? "Interest deduction — 80TTB" : "Savings interest — 80TTA"}
            value={input.ageYears >= 60 ? input.otherDeductions.seniorInterest80TTB : input.otherDeductions.savingsInterest80TTA}
            onChange={(v) => patch((d) => {
              if (d.ageYears >= 60) d.otherDeductions.seniorInterest80TTB = v;
              else d.otherDeductions.savingsInterest80TTA = v;
            })}
          />
        </FormSection>

        <label className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
          <input
            type="checkbox"
            checked={input.d80d.parentsSenior}
            onChange={(e) => patch((d) => { d.d80d.parentsSenior = e.target.checked; })}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span>
            <span className="font-semibold text-foreground">My parents are senior citizens</span>
            <span className="ml-1 text-muted-foreground">(raises the 80D ceiling for their premium to ₹50,000)</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-elevated disabled:opacity-50 disabled:hover:translate-y-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Analyzing…" : replaceId ? "Update and re-analyze" : "Run tax review"}
          </button>
          <p className="text-[11px] text-muted-foreground">Every rupee is deterministic. AI only explains the result — it never computes your tax.</p>
        </div>
      </div>
    </>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">{title}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
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

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string>(() => (value ? formatIndianNumber(value) : ""));
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={text}
        placeholder="0"
        onChange={(e) => {
          const cleaned = sanitizeNumericInput(e.target.value);
          setText(formatIndianNumber(cleaned));
          onChange(parseIndianNumber(cleaned));
        }}
        onBlur={() => setText(value ? formatIndianNumber(value) : "")}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:outline-none"
      />
    </label>
  );
}

function IntField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={value ? String(value) : ""}
        placeholder="0"
        onChange={(e) => {
          const cleaned = sanitizeNumericInput(e.target.value, { allowDecimal: false });
          onChange(cleaned === "" ? 0 : Number(cleaned));
        }}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:outline-none"
      />
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
  const getFn = useServerFn(getTaxAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["tax-analysis", id],
    queryFn: () => getFn({ data: { id } }),
  });
  if (isLoading) return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!data?.analysis) return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
      <p className="text-sm text-muted-foreground">Tax review not found.</p>
      <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
    </div>
  );
  return <ReportView report={data.analysis.report} onBack={onBack} />;
}

// ─────────────────────────── REPORT ──────────────────────────

function ReportView({ report, onBack }: { report: TaxReport; onBack: () => void }) {
  const chosen = report.recommendedRegime === "new" ? report.new : report.old;
  const other = report.recommendedRegime === "new" ? report.old : report.new;

  return (
    <div className="space-y-10">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
      </button>

      {/* 1 · EXECUTIVE SUMMARY */}
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-soft/50 via-card to-card p-8 shadow-elevated md:p-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{report.taxYear} · Tax decision</p>
        <h2 className="mt-3 font-display text-3xl leading-[1.1] tracking-tight text-foreground md:text-5xl">
          {report.recommendedRegime === "new" ? "Choose the new regime" : "Choose the old regime"}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-foreground/90">{report.contextSummary}</p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroStat label="Total tax payable" value={inr(report.totalTaxPayable)} sub={`${inr(report.monthlyTdsEstimate)} / month`} />
          <HeroStat label="Saved by regime choice" value={inr(report.regimeDeltaTax)} sub={`vs the ${report.recommendedRegime === "new" ? "old" : "new"} regime`} />
          <HeroStat label="Saved by deductions" value={inr(report.estimatedTaxSaved)} sub="vs claiming nothing" />
          <HeroStat label="Effective rate" value={`${report.effectiveRatePct.toFixed(2)}%`} sub={`Marginal ${report.marginalRatePct.toFixed(1)}%`} />
        </div>
      </section>

      {/* 2 · REGIME COMPARISON */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Scale className="h-4 w-4 text-primary" />} title="Old vs new regime" subtitle="Both computed on the exact same income, on your actual deductions." />
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Old regime", tax: report.old.totalTax },
                  { name: "New regime", tax: report.new.totalTax },
                ]}
                margin={{ top: 12, right: 12, left: 12, bottom: 8 }}
              >
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={11} width={48} />
                <Tooltip formatter={(v: number) => inr(v)} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="tax" radius={[10, 10, 0, 0]} barSize={72}>
                  <Cell fill={report.recommendedRegime === "old" ? PALETTE[1] : "#c9cfd6"} />
                  <Cell fill={report.recommendedRegime === "new" ? PALETTE[1] : "#c9cfd6"} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-3">
            <RegimeCard label="Old regime" r={report.old} winner={report.recommendedRegime === "old"} />
            <RegimeCard label="New regime" r={report.new} winner={report.recommendedRegime === "new"} />
            <p className="text-xs text-muted-foreground">
              The gap between the two is {inr(Math.abs(report.old.totalTax - report.new.totalTax))} for the year. Salaried taxpayers may re-test this choice every year at filing time.
            </p>
          </div>
        </div>
      </section>

      {/* 3 · INCOME BREAKDOWN */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Wallet className="h-4 w-4 text-primary" />} title="Where your income comes from" subtitle="Different income heads are taxed very differently — this is the starting point of every tax decision." />
        <div className="mt-6 grid gap-8 md:grid-cols-[320px_1fr] md:items-center">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={report.incomeComposition} dataKey="amount" nameKey="label" innerRadius={62} outerRadius={110} paddingAngle={3} stroke="none">
                  {report.incomeComposition.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2.5">
            {report.incomeComposition.map((s, i) => (
              <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  {s.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{inr(s.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4 · TAX BREAKDOWN */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Receipt className="h-4 w-4 text-primary" />} title="How the tax is built up" subtitle={`Line by line under the ${report.recommendedRegime === "new" ? "new" : "old"} regime.`} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <tbody>
              {chosen.breakdown.map((b, i) => (
                <tr key={i} className={`border-t border-border ${i === chosen.breakdown.length - 1 ? "bg-primary-soft/30 font-semibold" : ""}`}>
                  <td className="px-3 py-2 text-foreground">{b.label}</td>
                  <td className={`px-3 py-2 text-right font-mono ${b.amount < 0 ? "text-success" : "text-foreground"}`}>
                    {b.amount < 0 ? `− ${inr(Math.abs(b.amount))}` : inr(b.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.taxComposition.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {report.taxComposition.map((t, i) => (
              <span key={t.label} className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `${PALETTE[i % PALETTE.length]}1f`, color: PALETTE[i % PALETTE.length] }}>
                {t.label} {inr(t.amount)}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 5 · DEDUCTIONS UTILIZED */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<PiggyBank className="h-4 w-4 text-primary" />} title="Deductions utilised" subtitle={`${inr(report.remainingDeductionCapacity)} of usable capacity is still open under the recommended regime.`} />
        <ul className="mt-4 space-y-3">
          {report.deductions.map((d) => {
            const pct = d.limit > 0 ? Math.min(100, Math.round((d.used / d.limit) * 100)) : d.used > 0 ? 100 : 0;
            const dim = report.recommendedRegime === "new" && !d.allowedInNewRegime;
            return (
              <li key={d.section} className={dim ? "opacity-45" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">
                    <span className="font-semibold">{d.section}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{d.label}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {inr(d.used)}{d.limit > 0 ? ` / ${inr(d.limit)}` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-secondary" : pct >= 50 ? "bg-primary" : "bg-warning"}`} style={{ width: `${pct}%` }} />
                </div>
                {dim && <p className="mt-1 text-[11px] text-muted-foreground">Not available in the new regime.</p>}
                {!dim && d.note && <p className="mt-1 text-[11px] text-muted-foreground">{d.note}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 6 · MISSED OPPORTUNITIES */}
      {report.opportunities.length > 0 && (
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
          <SectionHeading icon={<Target className="h-4 w-4 text-primary" />} title="Tax saving still available to you" subtitle="Ranked by rupee impact. Every one of these is legal, mainstream and reversible in the sense that you choose whether to act." />
          <ul className="mt-4 space-y-3">
            {report.opportunities.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{o.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary">{o.section}</span>
                    {o.estimatedTaxSaving > 0 && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">saves ~{inr(o.estimatedTaxSaving)}</span>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{o.reason}</p>
                <p className="mt-2 text-sm text-foreground/90"><strong>What to do:</strong> {o.action}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7 · STRATEGIES & FINANCIAL IMPACT */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Scale className="h-4 w-4 text-primary" />} title="Optimisation strategies and their real cost" subtitle="Tax saved is only half the picture — cash locked away is the other half." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Strategy</th>
                <th className="px-3 py-2 text-right">Tax saved / yr</th>
                <th className="px-3 py-2 text-right">Cash required</th>
                <th className="px-3 py-2 text-left">Lock-in</th>
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
                    {s.tradeOffs.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                        {s.tradeOffs.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-success">{s.estimatedAnnualSaving > 0 ? inr(s.estimatedAnnualSaving) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.cashRequired > 0 ? inr(s.cashRequired) : "—"}</td>
                  <td className="px-3 py-2 text-[12px] text-muted-foreground">{s.lockIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8 · FINDINGS */}
      {report.findings.length > 0 && (
        <section>
          <SectionHeading icon={<Info className="h-4 w-4 text-primary" />} title="What this says about your money" />
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {report.findings.map((f) => <FindingItem key={f.id} f={f} />)}
          </ul>
        </section>
      )}

      {/* 9 · CHECKLIST */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<ListChecks className="h-4 w-4 text-primary" />} title="Year-end action checklist" subtitle="In the order it should actually happen." />
        <ol className="mt-4 space-y-3">
          {report.checklist.map((c, i) => (
            <li key={c.id} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{i + 1}</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    c.priority === "high" ? "bg-destructive/10 text-destructive"
                      : c.priority === "medium" ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}>{c.priority}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                <p className="mt-1 text-[11px] font-semibold text-secondary">Deadline · {c.deadline}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 10 · NITIGUIDE */}
      {report.narrative && (
        <section className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">NitiGuide™ · tax advisory</p>
          </div>
          <div className="mt-3 space-y-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {report.narrative}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">NitiGuide explains the deterministic findings above. It never computes tax and never recommends a specific product.</p>
        </section>
      )}

      {/* 11 · ASK */}
      <AskBox report={report} />

      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground">
          Tax decisions ripple into everything else. See the whole picture in your{" "}
          <Link to="/financial-health" className="font-semibold text-primary hover:underline">Financial Health Report</Link>.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          NitiTax™ is a planning tool for {report.taxYear}, not a filing utility or a substitute for a chartered accountant. Verify every figure before you file.
        </p>
      </div>
    </div>
  );
}

function AskBox({ report }: { report: TaxReport }) {
  const askFn = useServerFn(askTaxQuestion);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = [
    "What if I sell my equity mutual funds this year?",
    "Should I prepay my home loan or invest instead?",
    "What changes if I switch jobs mid-year?",
  ];

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await askFn({ data: { question: question.trim(), report } });
      setAnswer(res.answer ?? "NitiGuide is unavailable right now. Please try again shortly.");
    } catch {
      toast.error("Could not reach NitiGuide.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <SectionHeading icon={<MessageCircleQuestion className="h-4 w-4 text-primary" />} title="Ask a what-if" subtitle="Consequences, sequencing and trade-offs — answered against this exact analysis." />
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setQ(s); void ask(s); }} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary">
            {s}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void ask(q); }}
          placeholder="Ask NitiGuide about your tax position…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button disabled={busy} onClick={() => void ask(q)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ask
        </button>
      </div>
      {answer && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-primary/25 bg-primary-soft/25 p-4 text-sm leading-relaxed text-foreground/90">
          {answer}
        </div>
      )}
    </section>
  );
}

function RegimeCard({ label, r, winner }: { label: string; r: TaxReport["old"]; winner: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${winner ? "border-primary/40 bg-primary-soft/30" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {winner && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">Recommended</span>}
      </div>
      <p className="mt-1 font-display text-2xl text-foreground">{inr(r.totalTax)}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Taxable {inr(r.taxableIncome)} · deductions {inr(r.chapterVIA + r.standardDeduction + r.hraExempt)} · effective {r.effectiveRatePct.toFixed(2)}%
      </p>
    </div>
  );
}

function FindingItem({ f }: { f: TaxReport["findings"][number] }) {
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
