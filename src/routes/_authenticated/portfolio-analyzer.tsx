import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Info, Loader2, Plus,
  RefreshCw, Sparkles, Trash2, TrendingUp, Upload, AlertTriangle,
  ShieldCheck, Target, Layers, PieChart, Gauge,
} from "lucide-react";
import { AnalysisSequence } from "@/components/analysis-sequence";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/platform/confirm-dialog";
import { toast } from "sonner";

import {
  extractPortfolioFromScreenshots,
  analyzePortfolio,
  listPortfolioAnalyses,
  getPortfolioAnalysis,
  deletePortfolioAnalysis,
  type PortfolioListItem,
} from "@/lib/portfolio-analyzer/analyzer.functions";
import {
  ASSET_CLASS_LABEL,
  emptyHolding,
  type AssetClass,
  type Holding,
  type PortfolioReport,
} from "@/lib/portfolio-analyzer/types";
import { formatInr } from "@/lib/portfolio-analyzer/engine";

export const Route = createFileRoute("/_authenticated/portfolio-analyzer")({
  head: () => ({
    meta: [
      { title: "NitiInvest™ — Portfolio Analyzer — NitiVitt" },
      {
        name: "description",
        content: "Upload broker screenshots. NitiInvest™ scores your portfolio deterministically and grounds every observation in your NitiCore™ context.",
      },
    ],
  }),
  component: PortfolioAnalyzerPage,
});

type View =
  | { kind: "workspace" }
  | { kind: "upload"; replaceId?: string }
  | { kind: "confirm"; holdings: Holding[]; platform: string; name: string; replaceId?: string }
  | { kind: "report"; report: PortfolioReport; analysisId: string | null }
  | { kind: "saved"; id: string };

const PLATFORMS = ["Groww", "Zerodha", "INDmoney", "Upstox", "Angel One", "Paytm Money", "Other"];

function PortfolioAnalyzerPage() {
  const [view, setView] = useState<View>({ kind: "workspace" });
  return (
    <PageShell
      eyebrow="Service · NitiInvest™"
      title="Portfolio Analyzer"
      lede="Upload broker screenshots. Every portfolio is saved here so NitiCore™ can evaluate your investments in the context of your whole financial life — not just the pie chart."
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
            onExtracted={(holdings, platform, name) => setView({ kind: "confirm", holdings, platform, name, replaceId: view.replaceId })}
          />
        )}
        {view.kind === "confirm" && (
          <ConfirmFlow
            initialHoldings={view.holdings}
            platform={view.platform}
            name={view.name}
            replaceId={view.replaceId}
            onBack={() => setView({ kind: "upload", replaceId: view.replaceId })}
            onDone={(report, analysisId) => setView({ kind: "report", report, analysisId })}
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

function Workspace({
  onAnalyzeNew, onOpenSaved, onReplaceStart,
}: {
  onAnalyzeNew: () => void;
  onOpenSaved: (id: string) => void;
  onReplaceStart: (id: string) => void;
}) {
  const listFn = useServerFn(listPortfolioAnalyses);
  const deleteFn = useServerFn(deletePortfolioAnalysis);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-analyses"],
    queryFn: () => listFn({}),
  });
  const analyses: PortfolioListItem[] = data?.analyses ?? [];

  async function onDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Delete this portfolio?",
      description: `${name} will be removed from your workspace. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Portfolio removed.");
      qc.invalidateQueries({ queryKey: ["portfolio-analyses"] });
      qc.invalidateQueries({ queryKey: ["portfolio-intel-summary"] });
      qc.invalidateQueries({ queryKey: ["niti-guide-briefing"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">NitiInvest™ workspace</p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Your portfolios</h2>
          <p className="mt-1 text-sm text-muted-foreground">Upload one screenshot or several. Everything you save shows up here for later re-analysis.</p>
        </div>
        <button
          onClick={onAnalyzeNew}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add portfolio
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your workspace…</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 font-display text-xl text-foreground">No portfolios yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Take a screenshot of your holdings on Groww, Zerodha, INDmoney or any broker and drop it here. NitiInvest™ handles the rest.
          </p>
          <button onClick={onAnalyzeNew} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90">
            <Upload className="h-4 w-4" /> Upload screenshots
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {analyses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                    {a.platform ?? "Portfolio"}
                  </p>
                  <h3 className="mt-1 font-display text-lg text-foreground">{a.name}</h3>
                </div>
                <ScorePill score={a.portfolioScore} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Total value" value={formatInr(a.totalValue)} />
                <Metric label="Holdings" value={String(a.holdingCount)} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Last reviewed {new Date(a.lastReviewedAt).toLocaleDateString("en-IN")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => onOpenSaved(a.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onReplaceStart(a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
                  <RefreshCw className="h-3.5 w-3.5" /> Replace
                </button>
                <button onClick={() => onDelete(a.id, a.name)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────── UPLOAD ─────────────────────────────

function UploadFlow({
  replaceId, onCancel, onExtracted,
}: {
  replaceId?: string;
  onCancel: () => void;
  onExtracted: (holdings: Holding[], platform: string, name: string) => void;
}) {
  const extractFn = useServerFn(extractPortfolioFromScreenshots);
  const [platform, setPlatform] = useState("Groww");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onSelect(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    if (arr.length + files.length > 8) {
      toast.error("Maximum 8 screenshots per upload.");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
  }

  async function onExtract() {
    if (files.length === 0) {
      toast.error("Add at least one screenshot.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const screenshots = await Promise.all(files.map(async (f) => ({
        fileName: f.name,
        fileMime: f.type,
        fileBase64: await fileToBase64(f),
      })));
      const res = await extractFn({ data: { platform, screenshots } });
      if (res.holdings.length === 0) {
        setNote(res.note ?? "Nothing was extracted. Add holdings manually on the next step.");
        onExtracted([emptyHolding()], platform, name || `${platform} portfolio`);
      } else {
        if (res.note) toast.info(res.note);
        onExtracted(res.holdings, platform, name || `${platform} portfolio`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  function skipToManual() {
    onExtracted([emptyHolding()], platform, name || `${platform} portfolio`);
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          {replaceId ? "Step 1 of 2 · Replace" : "Step 1 of 2 · Upload"}
        </span>
      </div>
      <div>
        <h2 className="font-display text-2xl text-foreground">Add your holdings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload one or more screenshots from your broker or tracker. NitiInvest™ never stores the images — only the extracted holdings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Long-term SIPs" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>

      <div
        className="rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onSelect(e.dataTransfer.files); }}
      >
        <Upload className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-2 text-sm font-semibold text-foreground">Drop screenshots or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Choose images
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onSelect(e.target.files)} />
        <p className="mt-2 text-[11px] text-muted-foreground">PNG or JPG · up to 8 files · 10 MB each</p>
        {files.length > 0 && (
          <ul className="mt-4 space-y-1 text-left text-xs text-muted-foreground">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5">
                <span className="truncate">{f.name}</span>
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-destructive">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {note && (
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-xs text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" /> <span>{note}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || files.length === 0} onClick={onExtract} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Extracting…" : "Extract holdings with AI"}
        </button>
        <button onClick={skipToManual} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
          Skip and add manually
        </button>
      </div>
    </div>
  );
}

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ─────────────────────────── CONFIRM ────────────────────────────

const ASSET_CLASSES: AssetClass[] = [
  "equity_stock","equity_mf","index_fund","etf","debt_mf","hybrid_mf",
  "gold_etf","sgb","reit","invit","bond","fd","cash","other",
];

function ConfirmFlow({
  initialHoldings, platform, name, replaceId, onBack, onDone,
}: {
  initialHoldings: Holding[];
  platform: string;
  name: string;
  replaceId?: string;
  onBack: () => void;
  onDone: (report: PortfolioReport, analysisId: string | null) => void;
}) {
  const analyzeFn = useServerFn(analyzePortfolio);
  const qc = useQueryClient();
  const [rows, setRows] = useState<Holding[]>(initialHoldings.length ? initialHoldings : [emptyHolding()]);
  const [busy, setBusy] = useState(false);

  function update(i: number, patch: Partial<Holding>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, emptyHolding()]); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, j) => j !== i)); }

  const totalPreview = useMemo(
    () => rows.reduce((a, h) => a + Number(h.currentValue ?? (Number(h.units ?? 0) * Number(h.currentPrice ?? 0))), 0),
    [rows],
  );

  async function onAnalyze() {
    const cleaned = rows.filter((r) => r.name.trim().length > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one holding.");
      return;
    }
    setBusy(true);
    try {
      const res = await analyzeFn({
        data: {
          name,
          platform,
          holdings: cleaned as unknown as Record<string, unknown>[],
          narrate: true,
          enrich: true,
          replaceId,
        },
      });
      toast.success("Portfolio saved and analyzed.");
      qc.invalidateQueries({ queryKey: ["portfolio-analyses"] });
      qc.invalidateQueries({ queryKey: ["portfolio-intel-summary"] });
      qc.invalidateQueries({ queryKey: ["niti-guide-briefing"] });
      onDone(res.report, res.analysisId);
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
          onComplete={() => { /* deterministic sequence — final state controlled by RPC */ }}
          stepDurationMs={520}
          title="Building your portfolio report"
          subtitle="NitiInvest™ is analyzing your holdings and grounding every finding in your NitiCore™ context."
          steps={[
            { id: "upload", label: "Uploading portfolio" },
            { id: "extract", label: "Extracting holdings" },
            { id: "match", label: "Matching securities" },
            { id: "market", label: "Fetching market intelligence" },
            { id: "core", label: "Running NitiCore™ analysis" },
            { id: "context", label: "Applying financial context" },
            { id: "guide", label: "Preparing NitiGuide™ briefing" },
            { id: "report", label: "Composing your portfolio report" },
          ]}
        />
      )}

    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Step 2 of 2 · Confirm</span>
      </div>
      <div>
        <h2 className="font-display text-2xl text-foreground">Review extracted holdings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          NitiInvest™ shows exactly what it saw. Correct anything that looks wrong — extraction never invents values.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Holding</th>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-right">Units</th>
              <th className="px-3 py-2 text-right">Current price</th>
              <th className="px-3 py-2 text-right">Current value</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => {
              const lowConf = h.lowConfidenceFields ?? [];
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input value={h.name} onChange={(e) => update(i, { name: e.target.value })} className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm" placeholder="e.g. HDFC Flexi Cap" />
                    {lowConf.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-warning">
                        <AlertTriangle className="h-3 w-3" /> Low confidence: {lowConf.join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select value={h.assetClass} onChange={(e) => update(i, { assetClass: e.target.value as AssetClass })} className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm">
                      {ASSET_CLASSES.map((c) => <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input inputMode="decimal" value={h.units ?? ""} onChange={(e) => update(i, { units: e.target.value === "" ? null : Number(e.target.value) })} className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input inputMode="decimal" value={h.currentPrice ?? ""} onChange={(e) => update(i, { currentPrice: e.target.value === "" ? null : Number(e.target.value) })} className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input inputMode="decimal" value={h.currentValue ?? ""} onChange={(e) => update(i, { currentValue: e.target.value === "" ? null : Number(e.target.value) })} className="w-28 rounded-md border border-border bg-background px-2 py-1 text-right text-sm" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeRow(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
          <Plus className="h-3.5 w-3.5" /> Add holding
        </button>
        <p className="text-xs text-muted-foreground">
          Preview total: <span className="font-semibold text-foreground">{formatInr(totalPreview)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={onAnalyze} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Analyzing…" : "Analyze portfolio"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Analysis uses NitiCore™ deterministically. AI only narrates — it never picks stocks or funds.
        </p>
      </div>
    </div>
    </>
  );
}


// ─────────────────────────── SAVED ───────────────────────────

function SavedView({ id, onBack }: { id: string; onBack: () => void }) {
  const getFn = useServerFn(getPortfolioAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-analysis", id],
    queryFn: () => getFn({ data: { id } }),
  });
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.analysis) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">Portfolio not found.</p>
        <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
    );
  }
  return <ReportView report={data.analysis.report} onBack={onBack} title={data.analysis.name} />;
}

// ─────────────────────────── REPORT ───────────────────────────

const SECTION_STEPS: { id: string; label: string }[] = [
  { id: "score", label: "Portfolio Health Score" },
  { id: "summary", label: "Executive Summary" },
  { id: "snapshot", label: "Portfolio Snapshot" },
  { id: "visuals", label: "Portfolio Visualisations" },
  { id: "strengths", label: "Strengths" },
  { id: "risks", label: "Risks & Gaps" },
  { id: "intel", label: "Portfolio Intelligence" },
  { id: "actions", label: "Recommended Actions" },
  { id: "guide", label: "NitiGuide™" },
];

function ReportView({ report, onBack, title }: { report: PortfolioReport; onBack: () => void; title?: string }) {
  const snapshot = report.snapshot;
  const risk = report.riskMeter;
  const goal = report.goalAlignment;
  const positives = report.intelligence?.positives ?? report.strengths;
  const insights = report.intelligence?.insights ?? report.observations;
  const execSummary = report.executiveSummary ?? report.scoreLabel;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
      </button>

      {/* Table of contents / roadmap */}
      <nav className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Portfolio review · sections</p>
        <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground">
          {SECTION_STEPS.map((s, i) => (
            <li key={s.id}>
              <a href={`#pr-${s.id}`} className="hover:text-primary">
                <span className="text-foreground/80">{String(i + 1).padStart(2, "0")}.</span> {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 1. Portfolio Health Score */}
      <section id="pr-score" className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary-soft/30 p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Portfolio Health Score</p>
            <h2 className="mt-1 font-display text-3xl text-foreground">{title ?? "Portfolio report"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{report.scoreLabel}</p>
          </div>
          <ScoreDial score={report.portfolioScore} />
        </div>
      </section>

      {/* 2. Executive Summary */}
      <section id="pr-summary" className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Executive summary</p>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/90">{execSummary}</p>
        <p className="mt-4 rounded-lg bg-surface p-3 text-[11px] text-muted-foreground">{report.contextSummary}</p>
      </section>

      {/* 3. Portfolio Snapshot */}
      <section id="pr-snapshot" className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<Layers className="h-4 w-4 text-primary" />} title="Portfolio snapshot" subtitle="A quick read of what this portfolio looks like today." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapCard label="Portfolio value" value={snapshot?.valueLabel ?? formatInr(report.totalValue)} />
          <SnapCard label="Holdings" value={snapshot?.holdingsLabel ?? String(report.holdingCount)} />
          <SnapCard label="Portfolio style" value={snapshot?.style ?? "—"} />
          <SnapCard label="Diversification" value={snapshot?.diversificationBand ?? `${report.diversificationScore}/100`} />
          <SnapCard label="Risk level" value={snapshot?.riskLevelLabel ?? "—"} />
          <SnapCard
            label="Largest holding"
            value={snapshot?.largestHolding ?? (report.topHoldings[0]?.name ?? "—")}
            sub={snapshot ? `${snapshot.largestHoldingPct}% of portfolio` : undefined}
          />
          <SnapCard label="Investment behaviour" value={snapshot?.investmentBehaviour ?? "—"} className="sm:col-span-2" />
        </div>
      </section>

      {/* 4. Portfolio Visualisations */}
      <section id="pr-visuals" className="space-y-4">
        <SectionHeading icon={<PieChart className="h-4 w-4 text-primary" />} title="Portfolio visualisations" subtitle="Understand the structure of the portfolio at a glance." />
        <div className="grid gap-4 md:grid-cols-3">
          <DonutCard title="Asset allocation" slices={report.allocation.byAssetClass} />
          <DonutCard title="Market cap (equity)" slices={report.allocation.byMarketCap} />
          <DonutCard title="Sector mix" slices={report.allocation.bySector} empty="Sector data will appear once holdings are enriched." />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MeterCard
            title="Risk meter"
            icon={<Gauge className="h-4 w-4 text-primary" />}
            label={risk?.label ?? "—"}
            value={risk?.equityPct ?? 0}
            target={risk?.targetEquityPct ?? 0}
            valueLabel={`${risk?.equityPct ?? 0}% equity`}
            targetLabel={`Target ~${risk?.targetEquityPct ?? 0}%`}
          />
          <ConcentrationCard topHoldings={report.topHoldings} />
          <GoalAlignmentCard goal={goal} />
        </div>
        {report.topHoldings.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h4 className="text-sm font-semibold text-foreground">Top holdings</h4>
            <ul className="mt-3 space-y-2">
              {report.topHoldings.map((h) => (
                <li key={h.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{h.name}<span className="ml-2 text-[11px] text-muted-foreground">{ASSET_CLASS_LABEL[h.assetClass]}</span></span>
                    <span className="font-mono text-muted-foreground">{h.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, h.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 5. Strengths */}
      <section id="pr-strengths">
        <FindingsBlock title="Strengths" tone="success" findings={positives} />
      </section>

      {/* 6. Risks & Gaps */}
      <section id="pr-risks">
        <FindingsBlock title="Risks & gaps" tone="danger" findings={report.gaps} emptyLabel="No material risks were flagged — keep monitoring quarterly." />
      </section>

      {/* 7. Portfolio Intelligence */}
      <section id="pr-intel" className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <SectionHeading icon={<ShieldCheck className="h-4 w-4 text-primary" />} title="Portfolio intelligence" subtitle="What is worth understanding beyond the raw numbers." />
        {insights.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No additional insights right now.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {insights.map((f) => (
              <li key={f.id} className="rounded-xl border border-border/60 bg-surface p-4">
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 8. Recommended Actions */}
      <section id="pr-actions">
        {report.recommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No priority actions right now. Revisit this portfolio after any material change (income, goals, life event).
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <SectionHeading icon={<Target className="h-4 w-4 text-primary" />} title="Recommended actions" subtitle="Ordered by what matters most, given your whole financial context." />
            <ul className="mt-4 space-y-3">
              {report.recommendations.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{r.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      r.priority === "high" ? "bg-destructive/10 text-destructive" :
                      r.priority === "medium" ? "bg-accent/15 text-accent-foreground" :
                      "bg-muted text-muted-foreground"
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
          </div>
        )}
      </section>

      {/* 9. NitiGuide */}
      <section id="pr-guide">
        {report.mentorSummary ? (
          <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">NitiGuide™ · portfolio review</p>
            </div>
            <div className="mt-3 space-y-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {report.mentorSummary}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              NitiGuide explains the deterministic findings above. It never recommends specific funds or predicts returns.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            NitiGuide briefing not available for this analysis.
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground">
          Want to close a protection or emergency-fund gap surfaced here?{" "}
          <Link to="/insurance-analyzer" className="font-semibold text-primary hover:underline">Open Insurance Analyzer</Link>{" "}
          or review your{" "}
          <Link to="/financial-health" className="font-semibold text-primary hover:underline">Financial Health Report</Link>.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────── ATOMS ───────────────────────────

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-lg text-foreground">{title}</h3>
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}

function SnapCard({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className ?? ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base leading-snug text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ScorePill({ score, large }: { score: number; large?: boolean }) {
  const tone =
    score >= 75 ? "bg-success-soft text-success" :
    score >= 55 ? "bg-secondary-soft text-secondary" :
    "bg-destructive/10 text-destructive";
  return (
    <div className={`rounded-full ${large ? "px-4 py-2 text-lg" : "px-2.5 py-1 text-xs"} font-semibold ${tone}`}>
      {score}/100
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const color =
    s >= 75 ? "var(--color-success, #16a34a)" :
    s >= 55 ? "var(--color-secondary, #6366f1)" :
    "var(--color-destructive, #dc2626)";
  const bg = `conic-gradient(${color} ${s * 3.6}deg, hsl(var(--muted)) 0deg)`;
  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: bg }}>
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card">
        <span className="font-display text-3xl leading-none text-foreground">{s}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

const SLICE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#0ea5e9",
  "#a855f7",
  "#ef4444",
];

function DonutCard({ title, slices, empty }: { title: string; slices: { label: string; pct: number; value: number }[]; empty?: string }) {
  const top = slices.slice(0, 6);
  let acc = 0;
  const stops = top.map((s, i) => {
    const start = acc;
    acc += s.pct;
    return `${SLICE_COLORS[i % SLICE_COLORS.length]} ${start * 3.6}deg ${acc * 3.6}deg`;
  }).join(", ");
  const remainder = Math.max(0, 100 - acc);
  const bg =
    top.length === 0
      ? `conic-gradient(hsl(var(--muted)) 0deg 360deg)`
      : `conic-gradient(${stops}${remainder > 0 ? `, hsl(var(--muted)) ${acc * 3.6}deg 360deg` : ""})`;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {top.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{empty ?? "No data yet."}</p>
      ) : (
        <div className="mt-3 flex gap-4">
          <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background: bg }}>
            <div className="absolute inset-3 rounded-full bg-card" />
          </div>
          <ul className="flex-1 space-y-1 text-[11px]">
            {top.map((s, i) => (
              <li key={s.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate text-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="font-mono text-muted-foreground">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MeterCard({
  title, icon, label, value, target, valueLabel, targetLabel,
}: {
  title: string; icon: React.ReactNode; label: string;
  value: number; target: number; valueLabel: string; targetLabel: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const t = Math.max(0, Math.min(100, target));
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <p className="mt-3 font-display text-lg text-foreground">{label}</p>
      <div className="relative mt-3 h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${v}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-foreground/70" style={{ left: `${t}%` }} title={targetLabel} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{valueLabel}</span>
        <span>{targetLabel}</span>
      </div>
    </div>
  );
}

function ConcentrationCard({ topHoldings }: { topHoldings: { name: string; pct: number }[] }) {
  const top = topHoldings[0];
  const topPct = top?.pct ?? 0;
  const band =
    topPct >= 25 ? { label: "High concentration", tone: "text-destructive" } :
    topPct >= 15 ? { label: "Moderate concentration", tone: "text-accent-foreground" } :
    topPct === 0 ? { label: "No holdings yet", tone: "text-muted-foreground" } :
    { label: "Well spread", tone: "text-success" };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Concentration</h4>
      </div>
      <p className={`mt-3 font-display text-lg ${band.tone}`}>{band.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Largest holding {top ? `(${top.name})` : ""} is <span className="font-mono">{topPct}%</span> of the portfolio.
      </p>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${topPct >= 25 ? "bg-destructive" : topPct >= 15 ? "bg-accent" : "bg-success"}`}
          style={{ width: `${Math.min(100, topPct * 2)}%` }}
        />
      </div>
    </div>
  );
}

function GoalAlignmentCard({ goal }: { goal: PortfolioReport["goalAlignment"] }) {
  const tone =
    goal?.status === "aligned" ? "text-success" :
    goal?.status === "under_allocated" || goal?.status === "over_allocated" ? "text-accent-foreground" :
    "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Goal alignment</h4>
      </div>
      <p className={`mt-3 font-display text-lg ${tone}`}>{goal?.label ?? "—"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{goal?.note ?? "Add profile data to assess alignment."}</p>
    </div>
  );
}

function FindingsBlock({
  title, tone, findings, emptyLabel,
}: {
  title: string; tone: "success" | "danger" | "muted";
  findings: { id: string; title: string; detail: string }[];
  emptyLabel?: string;
}) {
  const badge = tone === "success" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
    tone === "danger" ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
    <Info className="h-4 w-4 text-muted-foreground" />;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">{badge}<h3 className="font-display text-lg text-foreground">{title}</h3></div>
      {findings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel ?? "Nothing to report here."}</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {findings.map((f) => (
            <li key={f.id} className="rounded-xl border border-border/60 bg-surface p-3">
              <p className="text-sm font-semibold text-foreground">{f.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

  );
}
