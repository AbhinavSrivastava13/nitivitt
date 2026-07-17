import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  extractInsurancePolicy,
  analyzeInsurancePolicy,
  listInsuranceAnalyses,
  getInsuranceAnalysis,
  deleteInsuranceAnalysis,
  reanalyzeInsurancePolicy,
  getPortfolioProtectionSummary,
  type AnalysisListItem,
} from "@/lib/insurance-analyzer/analyzer.functions";
import {
  emptyExtractedPolicy,
  POLICY_TYPE_LABEL,
  type AnalysisReport,
  type ExtractedPolicy,
  type PolicyType,
} from "@/lib/insurance-analyzer/types";
import type { PortfolioSummary } from "@/lib/insurance-analyzer/portfolio";

export const Route = createFileRoute("/_authenticated/insurance-analyzer")({
  head: () => ({
    meta: [
      { title: "Insurance Analyzer — NitiVitt" },
      {
        name: "description",
        content:
          "Your insurance workspace. Upload policies, review protection scores, and see the whole portfolio through NitiCore's deterministic lens.",
      },
    ],
  }),
  component: InsuranceAnalyzerPage,
});

type View =
  | { kind: "workspace" }
  | { kind: "upload"; replaceId?: string }
  | { kind: "report"; report: AnalysisReport; analysisId: string | null }
  | { kind: "saved"; id: string };

const POLICY_TYPES: PolicyType[] = [
  "term", "health", "family_floater", "personal_accident",
  "critical_illness", "life", "other",
];

function InsuranceAnalyzerPage() {
  const [view, setView] = useState<View>({ kind: "workspace" });

  return (
    <PageShell
      eyebrow="Service"
      title="Insurance Analyzer"
      lede="Your insurance workspace. Every reviewed policy is saved here so NitiCore™ can evaluate your whole portfolio — not just one policy at a time."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {view.kind === "workspace" && (
          <Workspace
            onAnalyzeNew={() => setView({ kind: "upload" })}
            onOpenSaved={(id) => setView({ kind: "saved", id })}
            onReplaceStart={(id) => setView({ kind: "upload", replaceId: id })}
          />
        )}
        {view.kind === "upload" && (
          <UploadFlow
            replaceId={view.replaceId}
            onCancel={() => setView({ kind: "workspace" })}
            onDone={(report, analysisId) => setView({ kind: "report", report, analysisId })}
          />
        )}
        {view.kind === "report" && (
          <ReportViewInline
            report={view.report}
            onBack={() => setView({ kind: "workspace" })}
          />
        )}
        {view.kind === "saved" && (
          <SavedAnalysisView
            id={view.id}
            onBack={() => setView({ kind: "workspace" })}
            onReanalyzed={(report) => setView({ kind: "report", report, analysisId: view.id })}
            onReplaceStart={(id) => setView({ kind: "upload", replaceId: id })}
          />
        )}
      </div>
    </PageShell>
  );
}

// ─────────────────────────── WORKSPACE ───────────────────────────

function Workspace({
  onAnalyzeNew,
  onOpenSaved,
  onReplaceStart,
}: {
  onAnalyzeNew: () => void;
  onOpenSaved: (id: string) => void;
  onReplaceStart: (id: string) => void;
}) {
  const listFn = useServerFn(listInsuranceAnalyses);
  const summaryFn = useServerFn(getPortfolioProtectionSummary);
  const deleteFn = useServerFn(deleteInsuranceAnalysis);
  const qc = useQueryClient();

  const listQ = useQuery({ queryKey: ["insurance-analyses"], queryFn: () => listFn() });
  const summaryQ = useQuery({ queryKey: ["insurance-portfolio-summary"], queryFn: () => summaryFn() });

  async function onDelete(id: string) {
    if (!confirm("Remove this policy from your library? This action cannot be undone.")) return;
    await deleteFn({ data: { id } });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["insurance-analyses"] }),
      qc.invalidateQueries({ queryKey: ["insurance-portfolio-summary"] }),
    ]);
  }

  const analyses = listQ.data?.analyses ?? [];
  const summary = summaryQ.data?.summary ?? null;
  const isLoading = listQ.isLoading || summaryQ.isLoading;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">My insurance workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading your protection snapshot…"
              : analyses.length === 0
                ? "You haven't added any policies yet. Analyze your first one to begin."
                : `${analyses.length} ${analyses.length === 1 ? "policy" : "policies"} in your library.`}
          </p>
        </div>
        <button
          onClick={onAnalyzeNew}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {analyses.length === 0 ? "Analyze Policy" : "Analyze New Policy"}
        </button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-muted/70" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-2xl bg-muted/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-muted/60" />
          </div>
        </div>
      )}

      {!isLoading && summary && <PortfolioSummaryCard summary={summary} />}

      {!isLoading && analyses.length > 0 && (
        <PolicyList
          analyses={analyses}
          onOpen={onOpenSaved}
          onReplace={onReplaceStart}
          onDelete={onDelete}
        />
      )}

      {!isLoading && analyses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 font-display text-lg text-foreground">Build your protection library</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload a policy PDF. NitiCore™ will read it, score it against your financial context, and
            keep it here so you can see your whole portfolio at a glance.
          </p>
          <button
            onClick={onAnalyzeNew}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" /> Analyze Policy
          </button>
        </div>
      )}
    </>
  );
}

function PortfolioSummaryCard({ summary }: { summary: PortfolioSummary }) {
  const scoreTone = summary.protectionScore >= 85
    ? "text-success" : summary.protectionScore >= 60
      ? "text-primary" : summary.protectionScore >= 40
        ? "text-warning" : "text-destructive";

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-display text-2xl text-foreground">NitiSure™</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Protection Score</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className={`font-display text-5xl ${scoreTone}`}>{summary.protectionScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-1 text-sm text-foreground">{summary.scoreLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.contextSummary}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <StatBlock label="Life cover" value={fmtInr(summary.totalLifeCover)} />
          <StatBlock label="Health cover" value={fmtInr(summary.totalHealthCover)} />
          <StatBlock label="PA cover" value={fmtInr(summary.totalPersonalAccidentCover)} />
          <StatBlock label="CI cover" value={fmtInr(summary.totalCriticalIllnessCover)} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {summary.strengths.length > 0 && (
          <MiniFindings title="Strengths" tone="success" items={summary.strengths} icon={<CheckCircle2 className="h-4 w-4" />} />
        )}
        {summary.gaps.length > 0 && (
          <MiniFindings title="Coverage gaps" tone="destructive" items={summary.gaps} icon={<AlertTriangle className="h-4 w-4" />} />
        )}
        {summary.observations.length > 0 && (
          <MiniFindings title="Observations" tone="warning" items={summary.observations} icon={<Info className="h-4 w-4" />} />
        )}
      </div>

      {summary.recommendations.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Priority actions</p>
          <ol className="mt-3 space-y-3">
            {summary.recommendations.slice(0, 4).map((r) => (
              <li key={r.id} className="flex gap-3">
                <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  r.priority === "high" ? "bg-destructive/10 text-destructive"
                    : r.priority === "medium" ? "bg-warning-soft text-warning"
                      : "bg-muted text-muted-foreground"
                } flex items-center justify-center`}>{r.priority[0].toUpperCase()}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
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

function MiniFindings({
  title, tone, items, icon,
}: {
  title: string;
  tone: "success" | "warning" | "destructive";
  items: { id: string; title: string }[];
  icon: React.ReactNode;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className={`flex items-center gap-2 ${toneClass}`}>
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{title}</p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-foreground/90">
        {items.slice(0, 3).map((f) => (
          <li key={f.id} className="flex gap-1.5">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
            <span>{f.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PolicyList({
  analyses,
  onOpen, onReplace, onDelete,
}: {
  analyses: AnalysisListItem[];
  onOpen: (id: string) => void;
  onReplace: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="font-display text-lg text-foreground">My insurance policies</h3>
      <div className="mt-4 divide-y divide-border">
        {analyses.map((a) => (
          <div key={a.id} className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {POLICY_TYPE_LABEL[a.policyType]}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  a.protectionScore >= 70 ? "bg-success-soft text-success"
                    : a.protectionScore >= 40 ? "bg-warning-soft text-warning"
                      : "bg-destructive/10 text-destructive"
                }`}>
                  Score {a.protectionScore}
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
                {a.insurer ?? a.fileName ?? "Unnamed policy"}
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Sum insured: {a.sumInsured ? fmtInr(a.sumInsured) : "—"} · Premium: {a.premiumAnnual ? fmtInr(a.premiumAnnual) : "—"} · Uploaded {fmtDate(a.createdAt)} · Last reviewed {fmtDate(a.lastReviewedAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button onClick={() => onOpen(a.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
                Open
              </button>
              <button onClick={() => onReplace(a.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary">
                <RefreshCw className="h-3 w-3" /> Replace
              </button>
              <button onClick={() => onDelete(a.id)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── UPLOAD FLOW ───────────────────────────

function UploadFlow({
  replaceId, onCancel, onDone,
}: {
  replaceId?: string;
  onCancel: () => void;
  onDone: (report: AnalysisReport, analysisId: string | null) => void;
}) {
  const [step, setStep] = useState<"select" | "upload" | "confirm" | "analyzing">("select");
  const [policyType, setPolicyType] = useState<PolicyType | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedPolicy>(emptyExtractedPolicy());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const qc = useQueryClient();
  const extractFn = useServerFn(extractInsurancePolicy);
  const analyzeFn = useServerFn(analyzeInsurancePolicy);

  async function handleFile(file: File) {
    if (!policyType) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("PDF is larger than 15 MB.");
      const b64 = await fileToBase64(file);
      const res = await extractFn({
        data: {
          policyType,
          fileName: file.name,
          fileMime: file.type || "application/pdf",
          fileBase64: b64,
        },
      });
      // ALWAYS hydrate the confirm form with whatever came back — never blank it.
      setExtracted({ ...res.policy, policyType });
      setFileName(file.name);
      if (res.usedAi) {
        setNotice({ tone: "success", text: "AI extracted the details below — please confirm or edit before running the analysis." });
      } else if (res.note) {
        setNotice({ tone: "warning", text: res.note });
      }
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    if (!policyType) return;
    setError(null);
    setStep("analyzing");
    try {
      const res = await analyzeFn({
        data: {
          policyType,
          fileName: fileName ?? undefined,
          extracted: extracted as unknown as Record<string, unknown>,
          narrate: true,
          replaceId,
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["insurance-analyses"] }),
        qc.invalidateQueries({ queryKey: ["insurance-portfolio-summary"] }),
        qc.invalidateQueries({ queryKey: ["insurance-analysis", res.analysisId] }),
      ]);
      onDone(res.report, res.analysisId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setStep("confirm");
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
      </button>

      <Stepper step={step} />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && step === "confirm" && (
        <div className={`rounded-lg border p-3 text-xs ${
          notice.tone === "success"
            ? "border-success/30 bg-success-soft/50 text-success"
            : "border-warning/30 bg-warning-soft/50 text-warning"
        }`}>
          {notice.text}
        </div>
      )}

      {step === "select" && (
        <SelectPolicyType selected={policyType} onSelect={(t) => { setPolicyType(t); setStep("upload"); }} />
      )}
      {step === "upload" && policyType && (
        <UploadStep
          policyType={policyType}
          busy={busy}
          isReplacing={Boolean(replaceId)}
          onBack={() => setStep("select")}
          onFile={handleFile}
        />
      )}
      {step === "confirm" && policyType && (
        <ConfirmStep
          policyType={policyType}
          extracted={extracted}
          onChange={setExtracted}
          onBack={() => setStep("upload")}
          onConfirm={runAnalysis}
        />
      )}
      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Running deterministic analysis with NitiCore…</p>
          <p className="text-xs text-muted-foreground">Then translating findings into plain English.</p>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: string }) {
  const steps = [
    { id: "select", label: "Policy type" },
    { id: "upload", label: "Upload" },
    { id: "confirm", label: "Confirm" },
    { id: "report", label: "Report" },
  ];
  const activeIdx = steps.findIndex((s) => s.id === step || (step === "analyzing" && s.id === "confirm"));
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
            i <= activeIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {i + 1}
          </span>
          <span className={i <= activeIdx ? "font-medium text-foreground" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function SelectPolicyType({ selected, onSelect }: { selected: PolicyType | null; onSelect: (t: PolicyType) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl text-foreground">Which policy would you like reviewed?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Select the type first — the analysis rules differ by category.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {POLICY_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
              selected === t ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40"
            }`}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground">{POLICY_TYPE_LABEL[t]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadStep({
  policyType, busy, isReplacing, onBack, onFile,
}: {
  policyType: PolicyType; busy: boolean; isReplacing: boolean;
  onBack: () => void; onFile: (f: File) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground">{isReplacing ? "Upload the replacement policy" : "Upload the policy PDF"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {POLICY_TYPE_LABEL[policyType]} — we'll extract the key fields and let you confirm before analysis.
          </p>
        </div>
        <button onClick={onBack} className="text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary">
          Change type
        </button>
      </div>

      <label className={`mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
        busy ? "border-muted bg-muted/40" : "border-border bg-background hover:border-primary/60"
      }`}>
        {busy ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Reading your policy…</p>
            <p className="text-xs text-muted-foreground">This may take 20–40 seconds for large PDFs.</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-foreground">Click to select a PDF (up to 15 MB)</p>
            <p className="text-xs text-muted-foreground">Your document is processed for extraction and never shared.</p>
          </>
        )}
        <input
          type="file" accept="application/pdf" className="hidden" disabled={busy}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }}
        />
      </label>
    </div>
  );
}

function ConfirmStep({
  policyType, extracted, onChange, onBack, onConfirm,
}: {
  policyType: PolicyType; extracted: ExtractedPolicy;
  onChange: (p: ExtractedPolicy) => void;
  onBack: () => void; onConfirm: () => void;
}) {
  const set = (patch: Partial<ExtractedPolicy>) => onChange({ ...extracted, ...patch });
  const low = new Set(extracted.lowConfidenceFields);
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl text-foreground">Confirm the extracted details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We've pre-filled everything we could read. Edit anything that looks wrong; fields we couldn't confidently detect are highlighted.
      </p>

      {extracted.lowConfidenceFields.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-lg border border-warning/30 bg-warning-soft/50 p-3 text-xs text-warning">
          <Info className="h-4 w-4 shrink-0" />
          <span>Please double-check the highlighted fields: {extracted.lowConfidenceFields.join(", ")}.</span>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Policy holder" value={extracted.policyHolder ?? ""} lowConf={low.has("policyHolder")} onChange={(v) => set({ policyHolder: v || null })} />
        <Field label="Insurer" value={extracted.insurer ?? ""} lowConf={low.has("insurer")} onChange={(v) => set({ insurer: v || null })} />
        <Field label="Policy number" value={extracted.policyNumber ?? ""} lowConf={low.has("policyNumber")} onChange={(v) => set({ policyNumber: v || null })} />
        <Field label="Sum insured (INR)" type="number" value={extracted.sumInsured?.toString() ?? ""} lowConf={low.has("sumInsured")} onChange={(v) => set({ sumInsured: v ? Number(v) : null })} />
        <Field label="Annual premium (INR)" type="number" value={extracted.premiumAnnual?.toString() ?? ""} lowConf={low.has("premiumAnnual")} onChange={(v) => set({ premiumAnnual: v ? Number(v) : null })} />
        <Field label="Policy term (years)" type="number" value={extracted.policyTermYears?.toString() ?? ""} lowConf={low.has("policyTermYears")} onChange={(v) => set({ policyTermYears: v ? Number(v) : null })} />
        <Field label="Coverage start" value={extracted.coverageStart ?? ""} lowConf={low.has("coverageStart")} onChange={(v) => set({ coverageStart: v || null })} />
        <Field label="Coverage end" value={extracted.coverageEnd ?? ""} lowConf={low.has("coverageEnd")} onChange={(v) => set({ coverageEnd: v || null })} />
        <Field label="Nominee" value={extracted.nominee ?? ""} lowConf={low.has("nominee")} onChange={(v) => set({ nominee: v || null })} />
        <Field label="Room rent limit" value={extracted.roomRentLimit ?? ""} lowConf={low.has("roomRentLimit")} onChange={(v) => set({ roomRentLimit: v || null })} />
        <Field label="Co-payment (%)" type="number" value={extracted.copayPct?.toString() ?? ""} lowConf={low.has("copayPct")} onChange={(v) => set({ copayPct: v ? Number(v) : null })} />
        <Field label="Deductible (INR)" type="number" value={extracted.deductible?.toString() ?? ""} lowConf={low.has("deductible")} onChange={(v) => set({ deductible: v ? Number(v) : null })} />
      </div>

      <ListField label="Riders" values={extracted.riders} onChange={(v) => set({ riders: v })} />
      <ListField label="Waiting periods" values={extracted.waitingPeriods} onChange={(v) => set({ waitingPeriods: v })} />
      <ListField label="Notable exclusions" values={extracted.exclusions} onChange={(v) => set({ exclusions: v })} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary">
          ← Upload a different file
        </button>
        <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90">
          <Sparkles className="h-4 w-4" /> Run analysis
        </button>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">Reviewing a {POLICY_TYPE_LABEL[policyType]} policy.</p>
    </div>
  );
}

function Field({
  label, value, onChange, type, lowConf,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; lowConf?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {lowConf && <span className="ml-1 rounded bg-warning-soft px-1 py-0.5 text-[9px] text-warning">low confidence</span>}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none ${
          lowConf ? "border-warning/50" : "border-border"
        }`}
      />
    </label>
  );
}

function ListField({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="mt-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        rows={2}
        value={values.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        placeholder="One item per line"
      />
    </div>
  );
}

// ─────────────────────────── REPORT ───────────────────────────

function ReportViewInline({ report, onBack }: { report: AnalysisReport; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
      </button>
      <ReportView report={report} />
    </div>
  );
}

function SavedAnalysisView({
  id, onBack, onReanalyzed, onReplaceStart,
}: {
  id: string;
  onBack: () => void;
  onReanalyzed: (report: AnalysisReport) => void;
  onReplaceStart: (id: string) => void;
}) {
  const getFn = useServerFn(getInsuranceAnalysis);
  const reFn = useServerFn(reanalyzeInsurancePolicy);
  const delFn = useServerFn(deleteInsuranceAnalysis);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["insurance-analysis", id], queryFn: () => getFn({ data: { id } }) });

  const analysis = q.data?.analysis ?? null;

  async function onReanalyze() {
    setErr(null);
    setBusy(true);
    try {
      const res = await reFn({ data: { id, narrate: true } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["insurance-analysis", id] }),
        qc.invalidateQueries({ queryKey: ["insurance-analyses"] }),
        qc.invalidateQueries({ queryKey: ["insurance-portfolio-summary"] }),
      ]);
      if (res.report) onReanalyzed(res.report);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Re-analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this policy from your library?")) return;
    setBusy(true);
    try {
      await delFn({ data: { id } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["insurance-analyses"] }),
        qc.invalidateQueries({ queryKey: ["insurance-portfolio-summary"] }),
      ]);
      onBack();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
      </button>

      {q.isLoading && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading saved analysis…
        </div>
      )}
      {!q.isLoading && !analysis && (
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          This analysis is no longer available.
        </div>
      )}
      {err && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</div>}

      {analysis && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              disabled={busy}
              onClick={onReanalyze}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
            </button>
            <button
              disabled={busy}
              onClick={() => onReplaceStart(analysis.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> Replace with newer version
            </button>
            <button
              disabled={busy}
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
          <ReportView report={analysis.report} />
        </>
      )}
    </div>
  );
}

function ReportView({ report }: { report: AnalysisReport }) {
  const scoreTone = useMemo(() => {
    if (report.protectionScore >= 85) return "text-success";
    if (report.protectionScore >= 60) return "text-primary";
    if (report.protectionScore >= 40) return "text-warning";
    return "text-destructive";
  }, [report.protectionScore]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <p className="font-display text-2xl text-foreground">NitiSure™</p>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Protection Score</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className={`font-display text-6xl ${scoreTone}`}>{report.protectionScore}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <p className="mt-2 text-sm text-foreground">{report.scoreLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">{report.contextSummary}</p>
      </div>

      {report.mentorSummary && (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Executive summary — NitiGuide</p>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{report.mentorSummary}</div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 className="font-display text-lg text-foreground">Coverage summary</h3>
        {report.coverageSummary.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No coverage fields were confirmed.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {report.coverageSummary.map((row, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{row}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FindingSection title="Policy strengths" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} items={report.strengths} />
      <FindingSection title="Coverage gaps" tone="destructive" icon={<AlertTriangle className="h-4 w-4" />} items={report.gaps} />
      <FindingSection title="Portfolio observations" tone="warning" icon={<Info className="h-4 w-4" />} items={report.observations} />

      {report.recommendations.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-lg text-foreground">Recommended improvements</h3>
          <ol className="mt-4 space-y-4">
            {report.recommendations.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    r.priority === "high" ? "bg-destructive/10 text-destructive"
                      : r.priority === "medium" ? "bg-warning-soft text-warning"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {r.priority} priority
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">{r.title}</h4>
                </div>
                <p className="mt-2 text-sm text-foreground/90"><span className="font-medium">Why: </span>{r.reason}</p>
                <p className="mt-1 text-sm text-foreground/90"><span className="font-medium">Benefit: </span>{r.expectedBenefit}</p>
                <p className="mt-1 text-sm text-foreground/90"><span className="font-medium">Impact: </span>{r.financialImpact}</p>
                {r.tradeOffs.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">Trade-offs: </span>
                    {r.tradeOffs.join(" • ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-[11px] text-muted-foreground">
        <Link to="/services" className="font-semibold text-primary hover:underline">← All services</Link> · Deterministic reasoning by NitiCore™. Explanations by NitiGuide™.
      </div>
    </div>
  );
}

function FindingSection({
  title, tone, icon, items,
}: {
  title: string;
  tone: "success" | "warning" | "destructive";
  icon: React.ReactNode;
  items: { id: string; title: string; detail: string }[];
}) {
  if (items.length === 0) return null;
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className={`mb-3 flex items-center gap-2 ${toneClass}`}>
        {icon}
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((f) => (
          <li key={f.id} className="rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-semibold text-foreground">{f.title}</p>
            <p className="mt-1 text-sm text-foreground/85">{f.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────── UTILITIES ───────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.includes(",") ? result.split(",", 2)[1] : result;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function fmtInr(n: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}
