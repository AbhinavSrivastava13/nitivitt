import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  extractInsurancePolicy,
  analyzeInsurancePolicy,
} from "@/lib/insurance-analyzer/analyzer.functions";
import {
  emptyExtractedPolicy,
  POLICY_TYPE_LABEL,
  type AnalysisReport,
  type ExtractedPolicy,
  type PolicyType,
} from "@/lib/insurance-analyzer/types";

export const Route = createFileRoute("/_authenticated/insurance-analyzer")({
  head: () => ({
    meta: [
      { title: "Insurance Analyzer — NitiVitt" },
      {
        name: "description",
        content:
          "Upload a policy PDF. NitiVitt reviews the coverage, gaps and improvements the way a fee-only planner would - no products sold.",
      },
    ],
  }),
  component: InsuranceAnalyzerPage,
});

type Step = "select" | "upload" | "confirm" | "analyzing" | "report";

const POLICY_TYPES: PolicyType[] = [
  "term",
  "health",
  "family_floater",
  "personal_accident",
  "critical_illness",
  "life",
  "other",
];

function InsuranceAnalyzerPage() {
  const [step, setStep] = useState<Step>("select");
  const [policyType, setPolicyType] = useState<PolicyType | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedPolicy>(emptyExtractedPolicy());
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const extractFn = useServerFn(extractInsurancePolicy);
  const analyzeFn = useServerFn(analyzeInsurancePolicy);

  async function handleFile(file: File) {
    if (!policyType) return;
    setError(null);
    setBusy(true);
    try {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("PDF is larger than 15 MB. Please upload a smaller file.");
      }
      const b64 = await fileToBase64(file);
      const res = await extractFn({
        data: {
          policyType,
          fileName: file.name,
          fileMime: file.type || "application/pdf",
          fileBase64: b64,
        },
      });
      setExtracted({ ...res.policy, policyType });
      setFileName(file.name);
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
        },
      });
      setReport(res.report);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setStep("confirm");
    }
  }

  function reset() {
    setPolicyType(null);
    setFileName(null);
    setExtracted(emptyExtractedPolicy());
    setReport(null);
    setError(null);
    setStep("select");
  }

  return (
    <PageShell
      eyebrow="Service"
      title="Insurance Analyzer"
      lede="Upload a policy PDF. We review it the way an experienced fee-only planner would - what's protected, what's missing, and what to change. No products are sold here."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Stepper step={step} />

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "select" && (
          <SelectPolicyType
            selected={policyType}
            onSelect={(t) => {
              setPolicyType(t);
              setStep("upload");
            }}
          />
        )}

        {step === "upload" && policyType && (
          <UploadStep
            policyType={policyType}
            busy={busy}
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

        {step === "report" && report && (
          <ReportView report={report} onNew={reset} />
        )}
      </div>
    </PageShell>
  );
}

// ─────────────────────────── Steps UI ───────────────────────────

function Stepper({ step }: { step: Step }) {
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
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              i <= activeIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= activeIdx ? "font-medium text-foreground" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function SelectPolicyType({
  selected,
  onSelect,
}: {
  selected: PolicyType | null;
  onSelect: (t: PolicyType) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl text-foreground">Which policy would you like reviewed?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Select the type first - the analysis rules differ by policy category.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {POLICY_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
              selected === t
                ? "border-primary bg-primary-soft"
                : "border-border bg-background hover:border-primary/40"
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
  policyType,
  busy,
  onBack,
  onFile,
}: {
  policyType: PolicyType;
  busy: boolean;
  onBack: () => void;
  onFile: (f: File) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground">Upload the policy PDF</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {POLICY_TYPE_LABEL[policyType]} - we'll extract the key fields and let you confirm before analysis.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary"
        >
          Change type
        </button>
      </div>

      <label
        className={`mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          busy ? "border-muted bg-muted/40" : "border-border bg-background hover:border-primary/60"
        }`}
      >
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
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
    </div>
  );
}

function ConfirmStep({
  policyType,
  extracted,
  onChange,
  onBack,
  onConfirm,
}: {
  policyType: PolicyType;
  extracted: ExtractedPolicy;
  onChange: (p: ExtractedPolicy) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const set = (patch: Partial<ExtractedPolicy>) => onChange({ ...extracted, ...patch });
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl text-foreground">Confirm the extracted details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Edit anything that looks wrong. We never invent missing values - blank means "not confidently detected".
      </p>

      {extracted.lowConfidenceFields.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-lg border border-warning/30 bg-warning-soft/50 p-3 text-xs text-warning">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Please double-check: {extracted.lowConfidenceFields.join(", ")}.
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Policy holder" value={extracted.policyHolder ?? ""} onChange={(v) => set({ policyHolder: v || null })} />
        <Field label="Insurer" value={extracted.insurer ?? ""} onChange={(v) => set({ insurer: v || null })} />
        <Field label="Policy number" value={extracted.policyNumber ?? ""} onChange={(v) => set({ policyNumber: v || null })} />
        <Field label="Sum insured (INR)" type="number" value={extracted.sumInsured?.toString() ?? ""} onChange={(v) => set({ sumInsured: v ? Number(v) : null })} />
        <Field label="Annual premium (INR)" type="number" value={extracted.premiumAnnual?.toString() ?? ""} onChange={(v) => set({ premiumAnnual: v ? Number(v) : null })} />
        <Field label="Policy term (years)" type="number" value={extracted.policyTermYears?.toString() ?? ""} onChange={(v) => set({ policyTermYears: v ? Number(v) : null })} />
        <Field label="Coverage start" value={extracted.coverageStart ?? ""} onChange={(v) => set({ coverageStart: v || null })} />
        <Field label="Coverage end" value={extracted.coverageEnd ?? ""} onChange={(v) => set({ coverageEnd: v || null })} />
        <Field label="Nominee" value={extracted.nominee ?? ""} onChange={(v) => set({ nominee: v || null })} />
        <Field label="Room rent limit" value={extracted.roomRentLimit ?? ""} onChange={(v) => set({ roomRentLimit: v || null })} />
        <Field label="Co-payment (%)" type="number" value={extracted.copayPct?.toString() ?? ""} onChange={(v) => set({ copayPct: v ? Number(v) : null })} />
        <Field label="Deductible (INR)" type="number" value={extracted.deductible?.toString() ?? ""} onChange={(v) => set({ deductible: v ? Number(v) : null })} />
      </div>

      <ListField label="Riders" values={extracted.riders} onChange={(v) => set({ riders: v })} />
      <ListField label="Waiting periods" values={extracted.waitingPeriods} onChange={(v) => set({ waitingPeriods: v })} />
      <ListField label="Notable exclusions" values={extracted.exclusions} onChange={(v) => set({ exclusions: v })} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-xs font-semibold uppercase tracking-wider text-secondary hover:text-primary"
        >
          ← Upload a different file
        </button>
        <button
          onClick={onConfirm}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" /> Run analysis
        </button>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Reviewing a {POLICY_TYPE_LABEL[policyType]} policy.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
    </label>
  );
}

function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="mt-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        rows={2}
        value={values.join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        placeholder="One item per line"
      />
    </div>
  );
}

// ─────────────────────────── Report UI ───────────────────────────

function ReportView({ report, onNew }: { report: AnalysisReport; onNew: () => void }) {
  const scoreTone = useMemo(() => {
    if (report.protectionScore >= 85) return "text-success";
    if (report.protectionScore >= 60) return "text-primary";
    if (report.protectionScore >= 40) return "text-warning";
    return "text-destructive";
  }, [report.protectionScore]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Overall protection score</p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className={`font-display text-6xl ${scoreTone}`}>{report.protectionScore}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className="mt-2 text-sm text-foreground">{report.scoreLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{report.contextSummary}</p>
          </div>
          <button
            onClick={onNew}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:border-primary/50"
          >
            Analyse another policy
          </button>
        </div>
      </div>

      {report.mentorSummary && (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Mentor summary</p>
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

      <FindingSection title="Strengths" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} items={report.strengths} />
      <FindingSection title="Protection gaps" tone="destructive" icon={<AlertTriangle className="h-4 w-4" />} items={report.gaps} />
      <FindingSection title="Important observations" tone="warning" icon={<Info className="h-4 w-4" />} items={report.observations} />

      {report.recommendations.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-lg text-foreground">Recommended improvements</h3>
          <ol className="mt-4 space-y-4">
            {report.recommendations.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      r.priority === "high"
                        ? "bg-destructive/10 text-destructive"
                        : r.priority === "medium"
                          ? "bg-warning-soft text-warning"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
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
    </div>
  );
}

function FindingSection({
  title,
  tone,
  icon,
  items,
}: {
  title: string;
  tone: "success" | "warning" | "destructive";
  icon: React.ReactNode;
  items: { id: string; title: string; detail: string }[];
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-destructive";
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

// ─────────────────────────── Utilities ───────────────────────────

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
