import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Info, Loader2, Plus,
  RefreshCw, Sparkles, Trash2, TrendingUp, Upload, AlertTriangle,
  ShieldCheck, Target, Layers, PieChart, Gauge as GaugeIcon,
  LineChart as LineChartIcon,
} from "lucide-react";
import { AnalysisSequence } from "@/components/analysis-sequence";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/platform/confirm-dialog";
import { toast } from "sonner";
import {
  ComparisonBars, AllocationDonut, ConcentrationBars, StackedComposition, SectorTreemap,
  ScoreRing, MiniMeter, ThresholdMarker, ProjectionChart, NoData, SERIES_COLORS,
} from "@/components/portfolio/charts";
import { buildProjectionSeries, projectValue, projectionGuidance, inrShort } from "@/lib/portfolio-analyzer/projection";
import type { ProjectionBasis } from "@/lib/portfolio-analyzer/types";


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
import { derivePortfolioRating, ratingClasses } from "@/lib/ratings";


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
                <RatingPill score={a.portfolioScore} />
                {a.isPrimary && (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">My portfolio</span>
                )}
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
  const [isPrimary, setIsPrimary] = useState(true);

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
          isPrimary,
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

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
        />
        <span>
          <span className="text-sm font-semibold text-foreground">This is my portfolio</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Link these holdings to your NitiCore™ profile so your investment total, net worth and recommendations across NitiVitt reflect them. Leave unticked to analyse someone else&rsquo;s portfolio or run a what-if without changing your financial picture.
          </span>
        </span>
      </label>

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
  return <ReportView report={data.analysis.report} onBack={onBack} title={data.analysis.name} lastReviewedAt={data.analysis.lastReviewedAt ?? data.analysis.createdAt} />;
}

// ─────────────────────────── REPORT ───────────────────────────

const SECTION_STEPS: { id: string; label: string }[] = [
  { id: "summary", label: "Executive Summary" },
  { id: "snapshot", label: "Portfolio Snapshot" },
  { id: "allocation", label: "Portfolio Allocation" },
  { id: "diagnostics", label: "Portfolio Diagnostics" },
  { id: "holdings", label: "Fund & Stock Intelligence" },
  { id: "projection", label: "Portfolio Projection" },
  { id: "peers", label: "Peer Benchmark" },
  { id: "actions", label: "Recommended Actions" },
  { id: "guide", label: "NitiGuide™" },
];


function ReportView({
  report, onBack, title, lastReviewedAt,
}: {
  report: PortfolioReport;
  onBack: () => void;
  title?: string;
  lastReviewedAt?: string;
}) {
  const snapshot = report.snapshot;
  const rating = derivePortfolioRating(report.portfolioScore);
  const tone = ratingClasses(rating.tone);
  const execSummary = report.executiveSummary ?? rating.label;
  const hero = report.hero;
  const alloc = report.allocationComparison ?? [];
  const diagnostics = report.diagnostics ?? [];
  const holdings = report.holdingIntelligence ?? [];
  const peer = report.peerBenchmark;
  const insights = report.insights ?? [];
  const reviewed = lastReviewedAt ? new Date(lastReviewedAt) : new Date();
  const equityPct = alloc.find((r) => r.label === "Equity")?.you ?? 0;
  const debtPct = alloc.find((r) => r.label === "Debt")?.you ?? 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
        </button>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground">
          {SECTION_STEPS.map((s) => (
            <a key={s.id} href={`#pr-${s.id}`} className="hover:text-primary">{s.label}</a>
          ))}
        </nav>
      </div>

      {/* 1. EXECUTIVE SUMMARY */}
      <section id="pr-summary" className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-soft/40 via-card to-card p-8 shadow-elevated md:p-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Executive summary</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${tone.bg} ${tone.text}`}>
            {rating.label} · Grade {rating.grade}
          </span>
          {report.isPrimary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
              <CheckCircle2 className="h-3 w-3" /> Linked to NitiCore™
            </span>
          )}
        </div>
        <h2 className="mt-4 max-w-3xl font-display text-3xl leading-[1.12] tracking-tight text-foreground md:text-[2.6rem]">
          {hero?.verdict ?? rating.label}
        </h2>
        {title && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <SummaryPoint tone="good" label="Biggest strength" body={report.biggestStrength ?? report.strengths[0]?.title ?? "Being established."} />
          <SummaryPoint tone="risk" label="Biggest risk" body={report.largestRisk ?? report.gaps[0]?.title ?? "Nothing material flagged."} />
          <SummaryPoint tone="note" label="Most important observation" body={hero?.keyInsights?.[0] ?? insights[0]?.title ?? execSummary} />
          <SummaryPoint tone="act" label="One immediate priority" body={report.recommendations[0]?.title ?? "Keep contributing and review in six months."} />
        </div>
      </section>

      {/* 2. PORTFOLIO SNAPSHOT */}
      <section id="pr-snapshot">
        <SectionHeading icon={<Layers className="h-4 w-4 text-primary" />} title="Portfolio snapshot" subtitle="The facts that frame everything below." />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapCard label="Portfolio value" value={snapshot?.valueLabel ?? formatInr(report.totalValue)} />
          <SnapCard label="Holdings" value={String(report.holdingCount)} />
          <SnapCard label="Equity" value={`${equityPct}%`} />
          <SnapCard label="Debt" value={`${debtPct}%`} />
          <SnapCard label="Largest holding" value={report.topHoldings[0]?.name ?? "—"} sub={report.topHoldings[0] ? `${report.topHoldings[0].pct}% of portfolio` : undefined} />
          <SnapCard label="Style" value={snapshot?.style ?? "—"} />
          <SnapCard label="Diversification" value={snapshot?.diversificationBand ?? "—"} />
          <SnapCard label="Last reviewed" value={reviewed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
        </div>
      </section>

      {/* 3. PORTFOLIO ALLOCATION */}
      <section id="pr-allocation" className="space-y-5">
        <SectionHeading icon={<PieChart className="h-4 w-4 text-primary" />} title="Portfolio allocation" subtitle="Where your money sits — and where NitiCore™ would place it." />
        {alloc.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h4 className="font-display text-lg text-foreground">You → NitiCore™ recommended</h4>
            <p className="mt-1 text-xs text-muted-foreground">Recommended reflects your age, risk profile and life stage. A gap is only a problem when it conflicts with your horizon.</p>
            <div className="mt-6"><AllocationCompare rows={alloc.map((r) => ({ label: r.label, you: r.you, recommended: r.recommended }))} /></div>
          </div>
        )}
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h4 className="font-display text-lg text-foreground">Asset allocation</h4>
            <p className="mt-1 text-xs text-muted-foreground">Every asset class with its share and rupee value.</p>
            <div className="mt-6"><SegmentedAllocation slices={report.allocation.byAssetClass} formatValue={formatInr} /></div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h4 className="font-display text-lg text-foreground">Holdings distribution</h4>
            <p className="mt-1 text-xs text-muted-foreground">Your top positions, with the 15% concentration line marked.</p>
            <div className="mt-6"><HoldingsDistribution rows={report.topHoldings} /></div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h4 className="font-display text-lg text-foreground">Market cap mix</h4>
            <p className="mt-1 text-xs text-muted-foreground">Large, mid and small exposure across the equity sleeve.</p>
            <div className="mt-6"><SegmentedAllocation slices={report.allocation.byMarketCap} formatValue={formatInr} empty="Data unavailable — these holdings could not be identified reliably." /></div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h4 className="font-display text-lg text-foreground">Sector mix</h4>
            <p className="mt-1 text-xs text-muted-foreground">Sector spread across identified holdings.</p>
            <div className="mt-6"><SegmentedAllocation slices={report.allocation.bySector} formatValue={formatInr} empty="Data unavailable — sector data appears once holdings match listed securities." /></div>
          </div>
        </div>
      </section>

      {/* 4. PORTFOLIO DIAGNOSTICS */}
      {diagnostics.length > 0 && (
        <section id="pr-diagnostics">
          <SectionHeading icon={<GaugeIcon className="h-4 w-4 text-primary" />} title="Portfolio diagnostics" subtitle="Structural checks scored deterministically by NitiCore™. Open a row for the reasoning." />
          <div className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {diagnostics.map((d) => <DiagnosticRow key={d.id} d={d} />)}
          </div>
          {insights.length > 0 && (
            <ul className="mt-5 grid gap-3 lg:grid-cols-2">
              {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
            </ul>
          )}
        </section>
      )}

      {/* 5. FUND & STOCK INTELLIGENCE */}
      {holdings.length > 0 && (
        <section id="pr-holdings">
          <SectionHeading icon={<ShieldCheck className="h-4 w-4 text-primary" />} title="Fund & stock intelligence" subtitle="What each holding actually is, and the job it is doing here." />
          <HoldingsExplorer holdings={holdings} />
        </section>
      )}


      {/* 6. PORTFOLIO PROJECTION & WHAT-IF */}
      {report.projection && report.totalValue > 0 && (
        <section id="pr-projection">
          <SectionHeading
            icon={<LineChartIcon className="h-4 w-4 text-primary" />}
            title="Portfolio projection"
            subtitle="What could your portfolio look like? Starting from what you actually hold today."
          />
          <ProjectionSection basis={report.projection} />
        </section>
      )}

      {/* 7. PEER BENCHMARK */}
      {peer && (
        <section id="pr-peers">
          <SectionHeading icon={<Target className="h-4 w-4 text-primary" />} title="Peer benchmark" subtitle={peer.cohort} />
          <div className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-9">
            <PeerLollipop rows={peer.rows} />
            <p className="mt-7 border-t border-border/70 pt-4 text-[11px] leading-relaxed text-muted-foreground">{peer.note}</p>
          </div>
        </section>
      )}


      {/* 7. RECOMMENDED ACTIONS */}
      <section id="pr-actions">
        <SectionHeading icon={<Target className="h-4 w-4 text-primary" />} title="Recommended actions" subtitle="Ordered by what matters most, given your whole financial context." />
        {report.recommendations.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No priority actions right now. Revisit after any material change to income, goals or life stage.
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {report.recommendations.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg leading-snug text-foreground">{r.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.priority === "high" ? "bg-destructive/10 text-destructive" :
                    r.priority === "medium" ? "bg-accent/15 text-accent-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>{r.priority}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{r.reason}</p>
                <p className="mt-3 text-sm text-foreground/90"><strong className="font-semibold">Expected benefit:</strong> {r.expectedBenefit}</p>
                {r.tradeOffs.length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground"><strong className="font-semibold text-foreground/80">Trade-offs:</strong> {r.tradeOffs.join(" ")}</p>
                )}
                {r.nextStep && (
                  <p className="mt-3 text-xs leading-relaxed text-foreground/90"><strong className="font-semibold">Next step:</strong> {r.nextStep}</p>
                )}
                {r.crossPillarNote && (
                  <p className="mt-3 rounded-lg bg-accent/10 px-3 py-1.5 text-[11px] text-accent-foreground">{r.crossPillarNote}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 8. NITIGUIDE */}
      <section id="pr-guide">
        {report.mentorSummary ? (
          <div className="rounded-3xl border border-primary/30 bg-primary-soft/25 p-7 md:p-10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">NitiGuide™ · portfolio mentor</p>
            </div>
            <div className="mt-5 max-w-3xl space-y-4 whitespace-pre-wrap text-[15px] leading-[1.75] text-foreground/90">
              {report.mentorSummary}
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground">
              NitiGuide teaches and explains. Every number and recommendation above is calculated deterministically by NitiCore™.
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

function SummaryPoint({ tone, label, body }: { tone: "good" | "risk" | "note" | "act"; label: string; body: string }) {
  const cls = {
    good: "border-success/30 bg-success-soft/40 text-success",
    risk: "border-destructive/25 bg-destructive/5 text-destructive",
    note: "border-border bg-surface text-muted-foreground",
    act: "border-primary/30 bg-primary-soft/40 text-primary",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

/** Compact diagnostic row — one line by default, reasoning on demand. */
function DiagnosticRow({ d }: { d: import("@/lib/portfolio-analyzer/types").PortfolioDiagnostic }) {
  const map = {
    good: { chip: "bg-success-soft text-success", bar: "bg-success", word: "Healthy" },
    watch: { chip: "bg-warning-soft text-warning", bar: "bg-warning", word: "Watch" },
    action: { chip: "bg-destructive/10 text-destructive", bar: "bg-destructive", word: "Act" },
  }[d.status];
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 hover:bg-muted/40">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{d.label}</span>
        <span className="hidden w-40 sm:block">
          <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={`block h-full rounded-full ${map.bar}`} style={{ width: `${Math.max(4, Math.min(100, d.score))}%` }} />
          </span>
        </span>
        <span className="w-28 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">{d.valueLabel}</span>
        <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider ${map.chip}`}>{map.word}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-2 border-t border-border/60 bg-surface px-5 py-4 text-xs leading-relaxed">
        <p><strong className="font-semibold text-foreground/80">Why it matters. </strong><span className="text-muted-foreground">{d.detail}</span></p>
        <p><strong className="font-semibold text-foreground/80">Target. </strong><span className="text-muted-foreground">{d.targetLabel}</span></p>
      </div>
    </details>
  );
}

/** Holdings Intelligence Explorer — top five by default, searchable beyond that. */
function HoldingsExplorer({ holdings }: { holdings: import("@/lib/portfolio-analyzer/types").HoldingIntelligence[] }) {
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const list = useMemo(() => {
    const base = showAll ? holdings : holdings.slice(0, 5);
    const term = q.trim().toLowerCase();
    return term ? holdings.filter((h) => h.name.toLowerCase().includes(term)) : base;
  }, [holdings, showAll, q]);

  return (
    <div className="mt-5">
      {showAll && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search holdings…"
          className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
        />
      )}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {list.map((h) => {
          const key = `${h.name}-${h.pct}`;
          const open = openKey === key;
          return (
            <div key={key}>
              <button
                onClick={() => setOpenKey(open ? null : key)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{h.name}</span>
                  <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    {h.kind === "fund" ? "Mutual fund" : h.kind === "stock" ? "Direct equity" : ASSET_CLASS_LABEL[h.assetClass]}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{h.pct}% · {formatInr(h.value)}</span>
                <ArrowRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
              </button>
              {open && (
                <div className="border-t border-border/60 bg-surface px-5 py-5">
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {h.facts.map((f) => (
                      <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</dt>
                        <dd className="truncate text-xs font-medium text-foreground">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {h.objective && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{h.objective}</p>}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {h.strengths.length > 0 && (
                      <div className="rounded-xl bg-success-soft/40 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-success">Strengths</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-foreground/85">{h.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    )}
                    {h.risks.length > 0 && (
                      <div className="rounded-xl bg-warning-soft/40 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-warning">Risks</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-foreground/85">{h.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-xs text-foreground/90"><strong className="font-semibold">Suggested role.</strong> {h.suggestedRole}</p>
                  {h.aiSummary && (
                    <p className="mt-3 flex gap-2 rounded-xl bg-primary-soft/30 p-3 text-xs leading-relaxed text-foreground/85">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{h.aiSummary}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No holdings match that search.</p>}
      </div>
      {holdings.length > 5 && (
        <button onClick={() => { setShowAll((v) => !v); setQ(""); }} className="mt-3 text-[11px] font-semibold text-primary hover:underline">
          {showAll ? "Show top 5 holdings" : `View all ${holdings.length} holdings`}
        </button>
      )}
    </div>
  );
}


function InsightCard({ insight }: { insight: import("@/lib/portfolio-analyzer/types").PortfolioInsight }) {
  const icon = insight.severity === "risk"
    ? <AlertTriangle className="h-4 w-4 text-destructive" />
    : insight.severity === "gap"
      ? <Info className="h-4 w-4 text-warning" />
      : <Info className="h-4 w-4 text-muted-foreground" />;
  return (
    <li className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <p className="text-sm font-semibold leading-snug text-foreground">{insight.title}</p>
      </div>
      <dl className="mt-3 space-y-2 text-xs leading-relaxed">
        <div><dt className="inline font-semibold text-foreground/80">Why it matters. </dt><dd className="inline text-muted-foreground">{insight.whyItMatters}</dd></div>
        <div><dt className="inline font-semibold text-foreground/80">Potential impact. </dt><dd className="inline text-muted-foreground">{insight.impact}</dd></div>
        <div><dt className="inline font-semibold text-foreground/80">Suggested action. </dt><dd className="inline text-muted-foreground">{insight.action}</dd></div>
      </dl>
    </li>
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

/** Qualitative rating only — NitiVitt no longer surfaces an "out of 100" score. */
function RatingPill({ score }: { score: number }) {
  const r = derivePortfolioRating(score);
  const t = ratingClasses(r.tone);
  return (
    <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${t.bg} ${t.text}`}>
      {r.label} · Grade {r.grade}
    </div>
  );
}


// ───────────────────── PORTFOLIO PROJECTION ─────────────────────

function ProjectionSection({ basis }: { basis: ProjectionBasis }) {
  const [years, setYears] = useState(basis.defaultHorizonYears);
  const [extraSip, setExtraSip] = useState(basis.suggestedSipUplift);
  const [returnPct, setReturnPct] = useState(basis.expectedReturnPct);

  const series = useMemo(
    () =>
      buildProjectionSeries(
        { currentValue: basis.currentValue, monthlySip: basis.monthlySip, annualReturnPct: basis.expectedReturnPct, years },
        { currentValue: basis.currentValue, monthlySip: basis.monthlySip + extraSip, annualReturnPct: returnPct, years },
      ),
    [basis, years, extraSip, returnPct],
  );

  const baseFv = projectValue({ currentValue: basis.currentValue, monthlySip: basis.monthlySip, annualReturnPct: basis.expectedReturnPct, years });
  const altFv = projectValue({ currentValue: basis.currentValue, monthlySip: basis.monthlySip + extraSip, annualReturnPct: returnPct, years });
  const guidance = useMemo(() => projectionGuidance(basis, years), [basis, years]);
  const invested = basis.currentValue + (basis.monthlySip + extraSip) * years * 12;
  const changed = extraSip !== 0 || returnPct !== basis.expectedReturnPct;

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-9">
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
          <div>
            <ProjectionChart
              data={series}
              format={inrShort}
              baseLabel="Current plan"
              altLabel={changed ? "Your scenario" : "Adjusted scenario"}
            />
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <ProjStat label={`In ${years} years — current plan`} value={inrShort(baseFv)} tone="you" />
              <ProjStat label="With your adjustments" value={inrShort(altFv)} tone="alt" />
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Difference of <span className="font-semibold text-foreground">{inrShort(Math.max(0, altFv - baseFv))}</span>, of which{" "}
              <span className="font-semibold text-foreground">{inrShort(Math.max(0, invested - basis.currentValue))}</span> is money you contribute. The rest is compounding.
            </p>

            <div className="space-y-5 border-t border-border/70 pt-5">
              <Slider
                label="Time horizon"
                value={`${years} years`}
                min={3} max={35} step={1}
                current={years}
                onChange={setYears}
                hint={basis.horizonBasis}
              />
              <Slider
                label="Extra monthly investment"
                value={`₹${extraSip.toLocaleString("en-IN")}`}
                min={0} max={Math.max(25000, basis.suggestedSipUplift * 5)} step={Math.max(500, Math.round(basis.suggestedSipUplift / 5) || 500)}
                current={extraSip}
                onChange={setExtraSip}
                hint={basis.sipSource === "profile"
                  ? `On top of your recorded ₹${basis.monthlySip.toLocaleString("en-IN")}/month`
                  : "No recurring contribution recorded in your profile yet"}
              />
              <Slider
                label="Assumed annual return"
                value={`${returnPct}%`}
                min={5} max={15} step={0.5}
                current={returnPct}
                onChange={setReturnPct}
                hint={basis.returnBasis}
              />
            </div>

            {changed && (
              <button
                onClick={() => { setExtraSip(basis.suggestedSipUplift); setReturnPct(basis.expectedReturnPct); setYears(basis.defaultHorizonYears); }}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Reset to NitiCore™ defaults
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-6 md:p-8">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">What this means</h4>
        <ul className="mt-4 space-y-3">
          {guidance.map((g, i) => (
            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-foreground/85">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border/70 pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Illustrative only. This compounds an assumption you can change above — it is not a forecast, and markets do not deliver a smooth annual return.
        </p>
      </div>
    </div>
  );
}

function ProjStat({ label, value, tone }: { label: string; value: string; tone: "you" | "alt" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "you" ? "border-border bg-surface" : "border-primary/25 bg-primary/[0.04]"}`}>
      <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl text-foreground">{value}</p>
    </div>
  );
}

function Slider({
  label, value, min, max, step, current, onChange, hint,
}: {
  label: string; value: string; min: number; max: number; step: number;
  current: number; onChange: (n: number) => void; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      {hint && <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
