import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  AlertTriangle,
  ShieldCheck,
  Target,
  Layers,
  Gauge as GaugeIcon,
} from "lucide-react";
import { AnalysisSequence } from "@/components/analysis-sequence";
import { PageShell } from "@/components/page-shell";
import { useConfirm } from "@/components/platform/confirm-dialog";
import { toast } from "sonner";
import {
  ComparisonTracks,
  ExposureOverlap,
  AllocationDonut,
  ConcentrationLadder,
  StackedComposition,
  SectorTreemap,
  MiniMeter,
  ProjectionChart,
  SERIES_COLORS,
  EffectivenessDial,
  ScenarioMatrix,
  StressScenarios,
  PeerRails,
  type ExposureGroup,
} from "@/components/portfolio/charts";
import {
  SCENARIOS,
  computeEffectiveness,
  effectivenessGrid,
  highestImpactLever,
  scenarioReturn,
  detectOverlap,
  blendedCostFromDiagnostics,
  costDrag,
  stressScenarios,
  baselineSip,
  resolveHorizon,
  STEP_UP_ROWS,
  type ScenarioKey,
} from "@/lib/portfolio-analyzer/effectiveness";
import {
  buildProjectionSeries,
  projectValue,
  projectionGuidance,
  inrShort,
} from "@/lib/portfolio-analyzer/projection";
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
        content:
          "Upload broker screenshots. NitiInvest™ scores your portfolio deterministically and grounds every observation in your NitiCore™ context.",
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
            onExtracted={(holdings, platform, name) =>
              setView({ kind: "confirm", holdings, platform, name, replaceId: view.replaceId })
            }
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
  onAnalyzeNew,
  onOpenSaved,
  onReplaceStart,
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
            NitiInvest™ workspace
          </p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Your portfolios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload one screenshot or several. Everything you save shows up here for later
            re-analysis.
          </p>
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
            Take a screenshot of your holdings on Groww, Zerodha, INDmoney or any broker and drop it
            here. NitiInvest™ handles the rest.
          </p>
          <button
            onClick={onAnalyzeNew}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
          >
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
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                    My portfolio
                  </span>
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
                <button
                  onClick={() => onOpenSaved(a.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onReplaceStart(a.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Replace
                </button>
                <button
                  onClick={() => onDelete(a.id, a.name)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
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
  replaceId,
  onCancel,
  onExtracted,
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
    const arr = Array.from(list).filter(
      (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024,
    );
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
      const screenshots = await Promise.all(
        files.map(async (f) => ({
          fileName: f.name,
          fileMime: f.type,
          fileBase64: await fileToBase64(f),
        })),
      );
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
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          {replaceId ? "Step 1 of 2 · Replace" : "Step 1 of 2 · Upload"}
        </span>
      </div>
      <div>
        <h2 className="font-display text-2xl text-foreground">Add your holdings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload one or more screenshots from your broker or tracker. NitiInvest™ never stores the
          images — only the extracted holdings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Portfolio name (optional)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Long-term SIPs"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div
        className="rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onSelect(e.dataTransfer.files);
        }}
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
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onSelect(e.target.files)}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          PNG or JPG · up to 8 files · 10 MB each
        </p>
        {files.length > 0 && (
          <ul className="mt-4 space-y-1 text-left text-xs text-muted-foreground">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5"
              >
                <span className="truncate">{f.name}</span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-destructive"
                >
                  Remove
                </button>
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
        <button
          disabled={busy || files.length === 0}
          onClick={onExtract}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Extracting…" : "Extract holdings with AI"}
        </button>
        <button
          onClick={skipToManual}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
        >
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
  "equity_stock",
  "equity_mf",
  "index_fund",
  "etf",
  "debt_mf",
  "hybrid_mf",
  "gold_etf",
  "sgb",
  "reit",
  "invit",
  "bond",
  "fd",
  "cash",
  "other",
];

function ConfirmFlow({
  initialHoldings,
  platform,
  name,
  replaceId,
  onBack,
  onDone,
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
  const [rows, setRows] = useState<Holding[]>(
    initialHoldings.length ? initialHoldings : [emptyHolding()],
  );
  const [busy, setBusy] = useState(false);
  const [isPrimary, setIsPrimary] = useState(true);

  function update(i: number, patch: Partial<Holding>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyHolding()]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }

  const totalPreview = useMemo(
    () =>
      rows.reduce(
        (a, h) => a + Number(h.currentValue ?? Number(h.units ?? 0) * Number(h.currentPrice ?? 0)),
        0,
      ),
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
          onComplete={() => {
            /* deterministic sequence — final state controlled by RPC */
          }}
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
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
            Step 2 of 2 · Confirm
          </span>
        </div>
        <div>
          <h2 className="font-display text-2xl text-foreground">Review extracted holdings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            NitiInvest™ shows exactly what it saw. Correct anything that looks wrong — extraction
            never invents values.
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
                      <input
                        value={h.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                        placeholder="e.g. HDFC Flexi Cap"
                      />
                      {lowConf.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-warning">
                          <AlertTriangle className="h-3 w-3" /> Low confidence: {lowConf.join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={h.assetClass}
                        onChange={(e) => update(i, { assetClass: e.target.value as AssetClass })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                      >
                        {ASSET_CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {ASSET_CLASS_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={h.units ?? ""}
                        onChange={(e) =>
                          update(i, {
                            units: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={h.currentPrice ?? ""}
                        onChange={(e) =>
                          update(i, {
                            currentPrice: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={h.currentValue ?? ""}
                        onChange={(e) =>
                          update(i, {
                            currentValue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-28 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeRow(i)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add holding
          </button>
          <p className="text-xs text-muted-foreground">
            Preview total:{" "}
            <span className="font-semibold text-foreground">{formatInr(totalPreview)}</span>
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
              Link these holdings to your NitiCore™ profile so your investment total, net worth and
              recommendations across NitiVitt reflect them. Leave unticked to analyse someone
              else&rsquo;s portfolio or run a what-if without changing your financial picture.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={busy}
            onClick={onAnalyze}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Analyzing…" : "Analyze portfolio"}
          </button>
          <p className="text-[11px] text-muted-foreground">
            Analysis uses NitiCore™ deterministically. AI only narrates — it never picks stocks or
            funds.
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
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
    );
  }
  return (
    <ReportView
      report={data.analysis.report}
      onBack={onBack}
      title={data.analysis.name}
      lastReviewedAt={data.analysis.lastReviewedAt ?? data.analysis.createdAt}
    />
  );
}

// ─────────────────────────── REPORT ───────────────────────────

const SECTION_STEPS: { id: string; label: string }[] = [
  { id: "verdict", label: "Verdict" },
  { id: "profile", label: "You vs NitiCore™" },
  { id: "effectiveness", label: "Effectiveness" },
  { id: "xray", label: "X-Ray" },
  { id: "peers", label: "Peers & stress" },
  { id: "health", label: "Health" },

  { id: "actions", label: "Next moves" },
  { id: "guide", label: "NitiGuide™" },
];

/** Tracks which report section is in view so the sticky nav can mark it subtly. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(`pr-${id}`))
      .filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("pr-", ""));
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/* ─────────── exposure grouping (deterministic, no invented data) ─────────── */

function factValue(
  facts: { label: string; value: string }[] | undefined,
  re: RegExp,
): string | null {
  const f = facts?.find((x) => re.test(x.label));
  const v = f?.value?.trim();
  if (!v || /^(not available|unknown|n\/a|—)$/i.test(v)) return null;
  return v;
}

function exposureFamily(
  name: string,
  assetClass: AssetClass,
  facts?: { label: string; value: string }[],
): string {
  const n = name.toLowerCase();
  if (assetClass === "gold_etf" || assetClass === "sgb" || /gold|sgb/.test(n)) return "Gold";
  if (/nifty\s?50|nifty50|niftybees|sensex|nifty bees/.test(n)) return "Nifty 50 / large-cap index";
  if (
    /(next\s?50|junior|midcap|mid cap|smallcap|small cap)/.test(n) &&
    /(index|etf|bees|fund)/.test(n)
  ) {
    return "Mid & small-cap index";
  }
  if (/bank\s?bees|nifty bank|banking index/.test(n)) return "Banking index";
  if (assetClass === "index_fund" || assetClass === "etf") return "Other index exposure";
  if (
    assetClass === "debt_mf" ||
    assetClass === "bond" ||
    assetClass === "fd" ||
    assetClass === "cash"
  ) {
    return "Debt & cash";
  }
  if (assetClass === "hybrid_mf") return "Hybrid funds";
  if (assetClass === "reit" || assetClass === "invit") return "Real assets";
  if (assetClass === "equity_stock") {
    const sector = factValue(facts, /sector/i);
    return sector ? `Direct equity · ${sector}` : "Direct equity";
  }
  if (assetClass === "equity_mf") {
    const cat = factValue(facts, /categor/i);
    return cat ? `Active equity · ${cat}` : "Active equity funds";
  }
  return "Other exposure";
}

function buildExposureGroups(report: PortfolioReport): ExposureGroup[] {
  const intel = report.holdingIntelligence ?? [];
  const rows = intel.length
    ? intel.map((h) => ({
        name: h.name,
        pct: h.pct,
        value: h.value,
        assetClass: h.assetClass,
        facts: h.facts,
      }))
    : report.topHoldings.map((h) => ({
        name: h.name,
        pct: h.pct,
        value: Math.round((h.pct / 100) * report.totalValue),
        assetClass: h.assetClass,
        facts: undefined as { label: string; value: string }[] | undefined,
      }));
  const map = new Map<string, ExposureGroup>();
  for (const r of rows) {
    const label = exposureFamily(r.name, r.assetClass, r.facts);
    const g = map.get(label) ?? { label, pct: 0, value: 0, members: [] };
    g.pct += r.pct;
    g.value += r.value;
    g.members.push({ name: r.name, pct: Math.round(r.pct * 10) / 10 });
    map.set(label, g);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      pct: Math.round(g.pct * 10) / 10,
      members: g.members.sort((a, b) => b.pct - a.pct),
    }))
    .sort((a, b) => b.pct - a.pct);
}

function ReportView({
  report,
  onBack,
  title,
  lastReviewedAt,
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
  const equitySleeve = report.allocation.byMarketCap.reduce((a, s) => a + s.value, 0);
  const exposure = useMemo(() => buildExposureGroups(report), [report]);
  const overlap = useMemo(() => detectOverlap(exposure), [exposure]);
  const largest = report.topHoldings[0];
  const equityValue = report.allocation.byAssetClass
    .filter((s) => /equity|index|etf|hybrid/i.test(s.label))
    .reduce((a, s) => a + s.value, 0);
  const stress = useMemo(
    () => stressScenarios(report.totalValue, equityValue || report.totalValue),
    [report.totalValue, equityValue],
  );
  const blendedCost = useMemo(() => blendedCostFromDiagnostics(diagnostics), [diagnostics]);
  const drag = useMemo(
    () =>
      report.projection && blendedCost != null
        ? costDrag(report.projection, blendedCost, 0.4, report.projection.defaultHorizonYears)
        : null,
    [report.projection, blendedCost],
  );

  const sectionIds = useMemo(() => SECTION_STEPS.map((s) => s.id), []);
  const activeSection = useActiveSection(sectionIds);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
        </button>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {title ? `${title} · ` : ""}Reviewed{" "}
          {reviewed.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <nav className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-full border border-border/70 bg-card/85 px-3 py-2 backdrop-blur">
        <ul className="flex min-w-max items-center gap-1">
          {SECTION_STEPS.map((s) => (
            <li key={s.id}>
              <a
                href={`#pr-${s.id}`}
                className={`inline-block rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  activeSection === s.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 1. VERDICT */}
      <section id="pr-verdict" className="scroll-mt-24">
        <div className="rounded-3xl border border-border bg-card px-5 py-6 shadow-soft md:px-8 md:py-7">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Portfolio verdict
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-[2.1rem] leading-none tracking-tight text-foreground">
                  {rating.label}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone.bg} ${tone.text}`}
                >
                  Grade {rating.grade}
                </span>
                {report.isPrimary && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Linked to NitiCore™
                  </span>
                )}
              </div>
            </div>
            <p className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
              <span className="font-display text-2xl not-italic tracking-tight text-foreground">
                {snapshot?.valueLabel ?? formatInr(report.totalValue)}
              </span>
              <span className="px-2">·</span>
              {report.holdingCount} holdings
              {snapshot?.style ? (
                <>
                  <span className="px-2">·</span>
                  {snapshot.style}
                </>
              ) : null}
            </p>
          </div>

          <p className="mt-4 max-w-3xl text-[14.5px] leading-[1.6] text-foreground/90">
            {hero?.verdict ?? execSummary}
          </p>

          <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-border/70 pt-5 md:grid-cols-3">
            <InsightTile
              tone="good"
              label="What's working"
              body={
                report.biggestStrength ??
                report.strengths[0]?.title ??
                "You are invested and contributing consistently."
              }
            />
            <InsightTile
              tone="risk"
              label="What's holding you back"
              body={
                report.largestRisk ??
                (largest
                  ? `${largest.name} represents ${largest.pct}% of the portfolio.`
                  : (report.gaps[0]?.title ?? "Nothing material flagged."))
              }
            />
            <InsightTile
              tone="act"
              label="Highest-impact move"
              body={
                report.recommendations[0]?.title ?? "Keep contributing and review in six months."
              }
            />
          </div>
        </div>

      </section>

      {/* 2. YOU VS NITICORE */}
      {alloc.length > 0 && (
        <section id="pr-profile" className="scroll-mt-24">
          <SectionHeading
            icon={<Target className="h-4 w-4 text-primary" />}
            title="Your portfolio vs NitiCore™"
            subtitle="Where your money sits today, against what NitiCore™ would hold for your age, horizon and risk profile."
          />
          <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-7">
            <ComparisonTracks
              rows={alloc.map((r) => ({ label: r.label, you: r.you, recommended: r.recommended }))}
              peerNote={
                <span>
                  A gap matters only when it conflicts with your age, horizon and risk profile.
                  Cohort structure is compared further down.
                </span>
              }
            />
          </div>
        </section>
      )}

      {/* 3. PORTFOLIO EFFECTIVENESS */}
      {report.projection && report.totalValue > 0 && (
        <section id="pr-effectiveness" className="scroll-mt-24">
          <SectionHeading
            icon={<GaugeIcon className="h-4 w-4 text-primary" />}
            title="Portfolio effectiveness"
            subtitle="See how today's decisions change your future. Illustrative scenarios built on NitiCore™ assumptions — never a forecast."
          />
          <EffectivenessSection basis={report.projection} diagnostics={diagnostics} />
        </section>
      )}

      {/* 4. PORTFOLIO X-RAY */}
      <section id="pr-xray" className="scroll-mt-24">
        <SectionHeading
          icon={<Layers className="h-4 w-4 text-primary" />}
          title="Portfolio X-Ray"
          subtitle="See what you actually own — beyond the number of holdings."
        />

        {overlap && (
          <div className="mt-4 rounded-2xl border border-warning/40 bg-warning-soft/30 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" /> Redundant exposure detected
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Overlap severity · {overlap.severity}
              </p>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-foreground/85">
              {overlap.members.map((m) => m.name).join(" + ")} sit inside{" "}
              {overlap.label.toLowerCase()} and together represent{" "}
              <span className="font-semibold">{overlap.pct}%</span> of the portfolio. These holdings
              provide highly similar market exposure, so owning both adds complexity without adding
              an independent source of return.
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Exposure families"
            note="Holdings collapsed into the exposure they actually share."
          >
            <ExposureOverlap
              groups={exposure}
              formatValue={formatInr}
              empty="Exposure grouping needs identifiable holdings. None of these positions resolved to a security NitiInvest™ could classify."
            />
            {exposure.length > 0 && (
              <p className="mt-4 border-t border-border/70 pt-3 text-[12px] leading-relaxed text-foreground/85">
                {report.holdingCount} holdings resolve into{" "}
                <span className="font-semibold">
                  {exposure.length} distinct exposure{" "}
                  {exposure.length === 1 ? "family" : "families"}
                </span>
                . More positions do not automatically mean more independent sources of return.
              </p>
            )}
          </ChartCard>
          <ChartCard
            title="Concentration"
            note="How much of the outcome rests on a single position."
          >
            <ConcentrationLadder
              rows={report.topHoldings.map((h) => ({
                name: h.name,
                pct: h.pct,
                value: Math.round((h.pct / 100) * report.totalValue),
              }))}
              formatValue={formatInr}
            />
          </ChartCard>
          <ChartCard title="Asset allocation" note="Share and rupee value of each asset class.">
            <AllocationDonut
              slices={report.allocation.byAssetClass}
              formatValue={formatInr}
              centerLabel="Total portfolio"
              centerValue={inrShort(report.totalValue)}
              empty="Asset class data not available for these holdings."
            />
          </ChartCard>
          <ChartCard
            title="Market cap mix"
            note="Structure of the equity sleeve, shown exactly as identified."
          >
            <StackedComposition
              slices={report.allocation.byMarketCap}
              formatValue={formatInr}
              caption={
                equitySleeve > 0 ? (
                  <p className="font-mono text-[12px] tabular-nums text-foreground">
                    Equity sleeve · <span className="font-semibold">{formatInr(equitySleeve)}</span>
                  </p>
                ) : undefined
              }
              empty="Market cap could not be identified for these holdings."
            />
          </ChartCard>
          <ChartCard
            title="Sector mix"
            note="Sector exposure across holdings matched to verified security data."
          >
            <SectorTreemap
              slices={report.allocation.bySector}
              formatValue={formatInr}
              empty="Sector exposure appears once a holding is matched to a listed security. These positions are held through instruments that do not publish a single sector."
            />
          </ChartCard>
          {blendedCost != null && (
            <ChartCard
              title="Cost drag"
              note="What the portfolio pays every year, and what that compounds into."
            >
              <p className="font-display text-3xl leading-none tracking-tight text-foreground">
                {blendedCost}%
              </p>
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Blended portfolio cost
              </p>
              {drag && drag.difference > 0 ? (
                <p className="mt-4 border-t border-border/70 pt-3 text-[12.5px] leading-relaxed text-foreground/85">
                  At your current contribution rate, this cost could reduce long-term wealth by
                  roughly <span className="font-semibold">{inrShort(drag.difference)}</span> over{" "}
                  {report.projection?.defaultHorizonYears} years compared with a 0.4% low-cost
                  equivalent, holding every other assumption constant.
                </p>
              ) : (
                <p className="mt-4 border-t border-border/70 pt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  This is already at or below the cost of a low-cost index equivalent, so expense
                  drag is not materially reducing your outcome.
                </p>
              )}
            </ChartCard>
          )}
        </div>

        {holdings.length > 0 && (
          <details className="group mt-4 rounded-2xl border border-border bg-card px-5 py-3.5 shadow-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-semibold text-foreground">
              Fund &amp; stock intelligence — {holdings.length}{" "}
              {holdings.length === 1 ? "holding" : "holdings"}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <HoldingsExplorer holdings={holdings} />
          </details>
        )}
      </section>

      {/* 5. PEER COMPARISON + STRESS TEST */}
      <section id="pr-peers" className="scroll-mt-24">
        <SectionHeading
          icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          title="Peer comparison & stress test"
          subtitle="How your structure compares with people at a similar life stage — and how it behaves when markets fall."
        />
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
          {peer && peer.rows.length > 0 ? (
            <PeerComparison peer={peer} />
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              Cohort comparison needs a completed NitiCore™ profile.
            </div>
          )}
          <ChartCard
            title="If markets fall from here"
            note="Hypothetical drawdowns applied to today's holdings — not predictions."
          >
            <StressScenarios rows={stress} formatValue={formatInr} />
          </ChartCard>
        </div>
      </section>

      {/* 6. PORTFOLIO HEALTH */}
      {(diagnostics.length > 0 || insights.length > 0) && (
        <section id="pr-health" className="scroll-mt-24">
          <SectionHeading
            icon={<GaugeIcon className="h-4 w-4 text-primary" />}
            title="Portfolio health"
            subtitle="Six deterministic NitiCore™ checks. Open any card for the reasoning behind it."
          />
          {diagnostics.length > 0 && (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {diagnostics.map((d) => (
                <DiagnosticChip key={d.id} d={d} />
              ))}
            </div>
          )}

          {insights.length > 0 && (
            <details className="group mt-3 rounded-2xl border border-border bg-card px-5 py-3.5 shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-semibold text-foreground">
                What could hurt you — {insights.length} structural{" "}
                {insights.length === 1 ? "observation" : "observations"}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {insights.map((i) => (
                  <InsightCard key={i.id} insight={i} />
                ))}
              </ul>
            </details>
          )}
        </section>
      )}



      {/* 7. NEXT MOVES */}
      <section id="pr-actions" className="scroll-mt-24">
        <SectionHeading
          icon={<Target className="h-4 w-4 text-primary" />}
          title="Your next 3 moves · NitiPath™"
          subtitle="What to do, why it matters, what happens if you don't — and the least disruptive way to do it."
        />
        {report.recommendations.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No priority actions right now. Revisit after any material change to income, goals or
            life stage.
          </div>
        ) : (
          <>
            <ol className="mt-4 space-y-3">
              {report.recommendations.slice(0, 3).map((r, i) => (
                <ActionRow key={r.id} r={r} index={i} />
              ))}
            </ol>
            {report.recommendations.length > 3 && (
              <details className="group mt-3 rounded-2xl border border-border bg-card px-5 py-3.5 shadow-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-semibold text-foreground">
                  {report.recommendations.length - 3} secondary{" "}
                  {report.recommendations.length - 3 === 1 ? "action" : "actions"}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <ol className="mt-4 space-y-3">
                  {report.recommendations.slice(3).map((r, i) => (
                    <ActionRow key={r.id} r={r} index={i + 3} />
                  ))}
                </ol>
              </details>
            )}
          </>
        )}
      </section>

      {/* 8. NITIGUIDE */}
      <section id="pr-guide" className="scroll-mt-24">
        {report.mentorSummary ? (
          <GuideBriefing text={report.mentorSummary} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            NitiGuide briefing not available for this analysis.
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground">
          Want to close a protection or emergency-fund gap surfaced here?{" "}
          <Link to="/insurance-analyzer" className="font-semibold text-primary hover:underline">
            Open Insurance Analyzer
          </Link>{" "}
          or review your{" "}
          <Link to="/financial-health" className="font-semibold text-primary hover:underline">
            Financial Health Report
          </Link>
          .
        </p>
      </div>
    </div>
  );
}


function GuideBriefing({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).filter(Boolean);
  const [open, setOpen] = useState(false);
  const shown = open ? paras : paras.slice(0, 1);
  return (
    <div className="rounded-3xl border border-primary/25 bg-primary-soft/20 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          NitiGuide™ · portfolio mentor
        </p>
      </div>
      <div className="mt-4 max-w-3xl space-y-3.5 text-[14.5px] leading-[1.7] text-foreground/90">
        {shown.map((para, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {para}
          </p>
        ))}
      </div>
      {paras.length > 1 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 text-[11px] font-semibold text-primary hover:underline"
        >
          {open ? "Show less" : "Read the full explanation"}
        </button>
      )}
      <p className="mt-5 border-t border-primary/15 pt-3 text-[11px] text-muted-foreground">
        NitiGuide teaches and explains. Every number and recommendation above is calculated
        deterministically by NitiCore™.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
      <h4 className="font-display text-base tracking-tight text-foreground">{title}</h4>
      {note && (
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">{note}</p>
      )}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function InsightTile({
  tone,
  label,
  body,
}: {
  tone: "good" | "risk" | "act";
  label: string;
  body: string;
}) {
  const accent = {
    good: "border-success/60",
    risk: "border-destructive/50",
    act: "border-primary/60",
  }[tone];
  return (
    <div className={`border-l-2 pl-3.5 ${accent}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function SnapItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-[14px] font-medium leading-snug text-foreground">{value}</dd>
      {sub && (
        <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{sub}</dd>
      )}
    </div>
  );
}

/* ─────────── diagnostics ─────────── */

/**
 * Compact health chip. Status + measured value are glanceable; the reasoning
 * expands only on interaction so the matrix stays a strip, not six blocks.
 */
function DiagnosticChip({
  d,
}: {
  d: import("@/lib/portfolio-analyzer/types").PortfolioDiagnostic;
}) {
  const map = {
    good: { dot: SERIES_COLORS.positive, chip: "text-success", word: "Healthy" },
    watch: { dot: SERIES_COLORS.attention, chip: "text-warning", word: "Watch" },
    action: { dot: SERIES_COLORS.action, chip: "text-destructive", word: "Act" },
  }[d.status];
  return (
    <details className="group rounded-2xl border border-border bg-card px-4 py-3 shadow-soft transition-colors open:bg-surface/60">
      <summary className="flex cursor-pointer list-none items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: map.dot }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[12.5px] font-semibold text-foreground">{d.label}</span>
            <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-foreground">
              {d.valueLabel}
            </span>
          </span>
          <span className="mt-1.5 block">
            <MiniMeter value={d.score} color={map.dot} />
          </span>
        </span>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] ${map.chip}`}>
          {map.word}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[11.5px] leading-relaxed">
        <p>
          <strong className="font-semibold text-foreground/80">Why it matters. </strong>
          <span className="text-muted-foreground">{d.detail}</span>
        </p>
        <p>
          <strong className="font-semibold text-foreground/80">Target. </strong>
          <span className="text-muted-foreground">{d.targetLabel}</span>
        </p>
      </div>
    </details>
  );
}

/* ─────────── holdings ─────────── */

function shortRole(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("core")) return "Core";
  if (r.includes("stabilis") || r.includes("stabiliz") || r.includes("debt")) return "Stabiliser";
  if (r.includes("satellite")) return "Satellite";
  if (r.includes("support")) return "Supporting";
  return "Supporting";
}

function HoldingsExplorer({
  holdings,
}: {
  holdings: import("@/lib/portfolio-analyzer/types").HoldingIntelligence[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) return holdings.filter((h) => h.name.toLowerCase().includes(term));
    return showAll ? holdings : holdings.slice(0, 5);
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
          const sector = h.facts.find((f) => /sector/i.test(f.label))?.value;
          const mcap = h.facts.find((f) => /market cap/i.test(f.label))?.value;
          const category = h.facts.find((f) => /categor/i.test(f.label))?.value;
          return (
            <div key={key}>
              <button
                onClick={() => setOpenKey(open ? null : key)}
                aria-expanded={open}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-foreground">
                    {h.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                    {h.kind === "fund"
                      ? "Mutual fund"
                      : h.kind === "stock"
                        ? "Direct equity"
                        : ASSET_CLASS_LABEL[h.assetClass]}
                  </span>
                </span>
                <span className="hidden w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
                  {shortRole(h.suggestedRole)}
                </span>
                <span className="shrink-0 text-right font-mono text-[12px] tabular-nums text-foreground">
                  {h.pct}%
                  <span className="ml-2 hidden text-muted-foreground sm:inline">
                    {formatInr(h.value)}
                  </span>
                </span>
                <ArrowRight
                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                />
              </button>
              {open && (
                <div className="animate-in fade-in slide-in-from-top-1 border-t border-border/60 bg-surface px-5 py-5 duration-200">
                  {h.objective && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        What it is
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">
                        {h.objective}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SnapItem
                      label="Portfolio weight"
                      value={`${h.pct}%`}
                      sub={formatInr(h.value)}
                    />
                    <SnapItem
                      label="Category"
                      value={category ?? ASSET_CLASS_LABEL[h.assetClass]}
                    />
                    <SnapItem label="Sector" value={sector ?? "Not available"} />
                    <SnapItem label="Market cap" value={mcap ?? "Not available"} />
                  </div>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Why it matters
                      </p>
                      <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-foreground/90">
                        {(h.strengths.length > 0
                          ? h.strengths.slice(0, 2)
                          : ["Contributes to overall portfolio structure."]
                        ).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Risk
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">
                        {h.risks[0] ?? "No specific risk flagged beyond normal market movement."}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 border-t border-border/60 pt-3 text-[12.5px] text-foreground/85">
                    <strong className="font-semibold">Role in your portfolio.</strong>{" "}
                    {shortRole(h.suggestedRole)} — {h.suggestedRole}
                  </p>
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
        {list.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">No holdings match that search.</p>
        )}
      </div>
      {holdings.length > 5 && (
        <button
          onClick={() => {
            setShowAll((v) => !v);
            setQ("");
          }}
          className="mt-3 text-[11px] font-semibold text-primary hover:underline"
        >
          {showAll ? "Show top 5 holdings" : `View all ${holdings.length} holdings`}
        </button>
      )}
    </div>
  );
}

/* ─────────── actions ─────────── */

function ActionRow({
  r,
  index,
}: {
  r: import("@/lib/portfolio-analyzer/types").PortfolioRecommendation;
  index: number;
}) {
  const lead = index === 0;
  const chip =
    r.priority === "high"
      ? "text-destructive"
      : r.priority === "medium"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <li
      className={`rounded-2xl border bg-card shadow-soft ${lead ? "border-foreground/25" : "border-border"}`}
    >
      <details className="group px-5 py-4 md:px-6 md:py-5">
        <summary className="flex cursor-pointer list-none items-start gap-4">
          <span
            className={`shrink-0 font-mono tabular-nums leading-none ${lead ? "text-xl text-foreground" : "text-base text-muted-foreground"}`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span
                className={`font-display leading-snug text-foreground ${lead ? "text-lg md:text-xl" : "text-[15px]"}`}
              >
                {r.title}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${chip}`}>
                {r.priority}
              </span>
            </span>
          </span>
          <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3 border-t border-border/60 pt-3 md:pl-10">
          <dl className="space-y-2 text-[13px] leading-relaxed">
            <div>
              <dt className="inline font-semibold text-foreground/80">Why. </dt>
              <dd className="inline text-muted-foreground">{r.reason}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-foreground/80">If you don&rsquo;t. </dt>
              <dd className="inline text-muted-foreground">
                {r.opportunityCost ?? r.expectedBenefit}
              </dd>
            </div>
            {r.nextStep && (
              <div>
                <dt className="inline font-semibold text-foreground/80">Least disruptive way. </dt>
                <dd className="inline text-foreground/90">{r.nextStep}</dd>
              </div>
            )}
            {r.tradeOffs.length > 0 && (
              <div>
                <dt className="inline font-semibold text-foreground/80">Trade-offs. </dt>
                <dd className="inline text-muted-foreground">{r.tradeOffs.join(" ")}</dd>
              </div>
            )}
          </dl>
          {r.crossPillarNote && (
            <p className="mt-3 border-l-2 border-primary/50 pl-3 text-[11.5px] leading-relaxed text-muted-foreground">
              {r.crossPillarNote}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}


function InsightCard({
  insight,
}: {
  insight: import("@/lib/portfolio-analyzer/types").PortfolioInsight;
}) {
  const icon =
    insight.severity === "risk" ? (
      <AlertTriangle className="h-4 w-4 text-destructive" />
    ) : insight.severity === "gap" ? (
      <Info className="h-4 w-4 text-warning" />
    ) : (
      <Info className="h-4 w-4 text-muted-foreground" />
    );
  return (
    <li className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <p className="text-sm font-semibold leading-snug text-foreground">{insight.title}</p>
      </div>
      <dl className="mt-3 space-y-2 text-xs leading-relaxed">
        <div>
          <dt className="inline font-semibold text-foreground/80">Why it matters. </dt>
          <dd className="inline text-muted-foreground">{insight.whyItMatters}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground/80">Potential impact. </dt>
          <dd className="inline text-muted-foreground">{insight.impact}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground/80">Suggested action. </dt>
          <dd className="inline text-muted-foreground">{insight.action}</dd>
        </div>
      </dl>
    </li>
  );
}

// ─────────────────────────── ATOMS ───────────────────────────

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-xl tracking-tight text-foreground">{title}</h3>
      </div>
      {subtitle && (
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}

/** Qualitative rating only — NitiVitt no longer surfaces an "out of 100" score. */
function RatingPill({ score }: { score: number }) {
  const r = derivePortfolioRating(score);
  const t = ratingClasses(r.tone);
  return (
    <div
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${t.bg} ${t.text}`}
    >
      {r.label} · Grade {r.grade}
    </div>
  );
}

// ─────────────── PORTFOLIO EFFECTIVENESS · NitiSim™ ───────────────

/**
 * Effectiveness is derived, not invented: the projection basis and the
 * deterministic NitiCore™ diagnostics are the only inputs. See
 * lib/portfolio-analyzer/effectiveness.ts for the formula.
 */
function EffectivenessSection({
  basis,
  diagnostics,
}: {
  basis: ProjectionBasis;
  diagnostics: import("@/lib/portfolio-analyzer/types").PortfolioDiagnostic[];
}) {
  const baseSip = baselineSip(basis);
  const baseYears = resolveHorizon(basis);
  const [years, setYears] = useState(baseYears);
  const [monthlySip, setMonthlySip] = useState(baseSip);
  const [stepUpPct, setStepUpPct] = useState(0);
  const [scenario, setScenario] = useState<ScenarioKey>("base");

  const current = useMemo(
    () =>
      computeEffectiveness(basis, diagnostics, {
        monthlySip: baseSip,
        stepUpPct: 0,
        years: baseYears,
        scenario: "base",
      }),
    [basis, diagnostics, baseSip, baseYears],
  );
  const result = useMemo(
    () => computeEffectiveness(basis, diagnostics, { monthlySip, stepUpPct, years, scenario }),
    [basis, diagnostics, monthlySip, stepUpPct, years, scenario],
  );
  const grid = useMemo(
    () => effectivenessGrid(basis, diagnostics, { monthlySip, years }),
    [basis, diagnostics, monthlySip, years],
  );
  const lever = useMemo(() => highestImpactLever(grid), [grid]);

  const series = useMemo(() => {
    const common = { currentValue: basis.currentValue, years };
    return buildProjectionSeries(
      { ...common, monthlySip: baseSip, annualReturnPct: basis.expectedReturnPct },
      { ...common, monthlySip, annualReturnPct: result.returnPct, annualStepUpPct: stepUpPct },
    );
  }, [basis, baseSip, monthlySip, years, stepUpPct, result.returnPct]);

  const changed =
    monthlySip !== baseSip || stepUpPct !== 0 || years !== baseYears || scenario !== "base";
  const readiness = Math.min(100, result.fundingPct);
  const interpretation =
    result.fundingPct >= 100
      ? "This plan already clears the NitiCore™ reference path for your runway. Remaining upside now comes from portfolio structure, not from taking more market risk."
      : result.structure >= readiness
        ? "The shortfall here is a contribution question, not a market question: your structure is sounder than your funding pace. Raising what you invest moves this more than assuming a better return."
        : "Contributions are doing their job — structure is the constraint. Fixing concentration and allocation moves this score more than adding rupees.";

  const gapToReference = result.reference - result.projected;

  const scenarioLabel = SCENARIOS.find((s) => s.key === scenario)?.label ?? "Base";

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        {/* Scenario controls — one compact strip above the two analysis columns */}
        <div className="rounded-2xl border border-border/70 bg-surface/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Scenario controls
            </p>
            {changed && (
              <button
                onClick={() => {
                  setMonthlySip(baseSip);
                  setStepUpPct(0);
                  setYears(baseYears);
                  setScenario("base");
                }}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Reset to current plan
              </button>
            )}
          </div>
          <div className="mt-3.5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <Slider
              label="Monthly contribution"
              value={`₹${monthlySip.toLocaleString("en-IN")}`}
              min={0}
              max={Math.max(50000, (baseSip + basis.suggestedSipUplift) * 3)}
              step={Math.max(500, Math.round(basis.suggestedSipUplift / 5) || 500)}
              current={monthlySip}
              onChange={setMonthlySip}
              hint={
                basis.sipSource === "profile"
                  ? `Recorded · ₹${basis.monthlySip.toLocaleString("en-IN")}/month`
                  : `NitiCore™ suggested ₹${baseSip.toLocaleString("en-IN")}/month`
              }
            />
            <Slider
              label="Annual step-up"
              value={`${stepUpPct}%`}
              min={0}
              max={20}
              step={1}
              current={stepUpPct}
              onChange={setStepUpPct}
              hint="Most salaried investors can raise contributions with each increment."
            />
            <Slider
              label="Years to retirement"
              value={`${years} years`}
              min={3}
              max={40}
              step={1}
              current={years}
              onChange={setYears}
              hint={basis.horizonBasis}
            />
            <div>
              <p className="text-[12px] font-semibold text-foreground">Return scenario</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setScenario(s.key)}
                    className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                      scenario === s.key
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label} · {scenarioReturn(basis.expectedReturnPct, s.key)}%
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                ±2 percentage points on your blended {basis.expectedReturnPct}% assumption.
              </p>
            </div>
          </div>
        </div>

        {/* Left: score + outcomes · Right: contribution × return matrix */}
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0">
            <EffectivenessDial score={result.score} delta={result.score - current.score} />
            <div className="mt-4 space-y-2 border-t border-border/70 pt-4">
              {[
                {
                  label: "Current plan",
                  value: inrShort(current.projected),
                  sub: `₹${baseSip.toLocaleString("en-IN")}/mo · 0% step-up · ${baseYears} yrs`,
                },
                {
                  label: "Your scenario",
                  value: inrShort(result.projected),
                  sub: `₹${monthlySip.toLocaleString("en-IN")}/mo · ${stepUpPct}% step-up · ${scenarioLabel} · ${years} yrs`,
                  strong: true,
                },
                {
                  label: "NitiCore™ reference",
                  value: inrShort(result.reference),
                  sub: `Suggested contribution over ${baseYears} yrs`,
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className={`flex items-baseline justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
                    c.strong ? "border-foreground/25 bg-surface/70" : "border-border/70"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {c.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      {c.sub}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg tracking-tight text-foreground">
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
            <dl className="mt-3 space-y-1.5 border-t border-border/70 pt-3 text-[12px]">
              <EffStat
                label="Gap to reference"
                value={
                  gapToReference > 0
                    ? `${inrShort(gapToReference)} short · ${readiness}% funded`
                    : `Ahead by ${inrShort(Math.abs(gapToReference))}`
                }
              />
              <EffStat label="Structural health" value={`${result.structure}/100`} />
            </dl>
            <p className="mt-3 text-[12.5px] leading-relaxed text-foreground/85">{interpretation}</p>
            <details className="group mt-2.5">
              <summary className="cursor-pointer list-none text-[11px] font-semibold text-primary hover:underline">
                How this score is built
              </summary>
              <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
                Effectiveness = 65% readiness against the NitiCore™ reference path + 35%
                deterministic structural health.{" "}
                {basis.sipSource === "profile"
                  ? "Your current plan uses the contribution recorded in your profile."
                  : `No recurring contribution is recorded in your profile, so the current plan starts from the NitiCore™ suggested ₹${baseSip.toLocaleString("en-IN")}/month.`}
              </p>
            </details>
          </div>

          <div className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-surface/40 p-4 md:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Contribution × return · projected value at {years} years
            </p>
            <div className="mt-3 -mx-1 flex-1 overflow-x-auto px-1">
              <div className="min-w-[420px]">
                <ScenarioMatrix
                  cells={grid}
                  rows={STEP_UP_ROWS}
                  columns={SCENARIOS.map((s) => ({ key: s.key, label: s.label }))}
                  activeStepUp={stepUpPct}
                  activeScenario={scenario}
                  formatValue={inrShort}
                  onSelect={(st: number, sc: string) => {
                    setStepUpPct(st);
                    setScenario(sc as ScenarioKey);
                  }}
                />
              </div>
            </div>
            {lever && (
              <p className="mt-3 border-t border-border/60 pt-3 text-[11.5px] leading-relaxed text-foreground/85">
                {lever}
              </p>
            )}
          </div>
        </div>

        {/* Projected growth — full width beneath both columns */}
        <div className="mt-5 border-t border-border/70 pt-4">
          <ProjectionChart
            data={series}
            format={inrShort}
            height={260}
            series={[
              { key: "base", label: "Current plan", color: SERIES_COLORS.you },
              {
                key: "alternative",
                label: "Your scenario",
                color: SERIES_COLORS.recommended,
                dash: "6 4",
              },
            ]}
          />
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Illustrative scenarios, not guaranteed returns. Contributed over the period:{" "}
            {inrShort(result.contributed)} — the rest of the projected total is compounding, not
            money you paid in.
          </p>
        </div>
      </div>


      <details className="group rounded-2xl border border-border bg-surface px-5 py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-semibold text-foreground">
          What this means
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <ul className="mt-4 space-y-3">
          {projectionGuidance(basis, years).map((g, i) => (
            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-foreground/85">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}



function EffStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`font-mono tabular-nums ${strong ? "text-[14px] font-semibold text-foreground" : "text-foreground/85"}`}
      >
        {value}
      </dd>
    </div>
  );
}

// ─────────────────────── PEER COMPARISON ───────────────────────

const AGE_BANDS = ["25-29", "30-34", "35-39", "40-44", "45-49", "50-54"];

function PeerComparison({
  peer,
}: {
  peer: import("@/lib/portfolio-analyzer/types").PeerBenchmark;
}) {
  const detected = /Age\s(\d{2})-(\d{2})/.exec(peer.cohort);
  const detectedBand = detected ? `${detected[1]}-${detected[2]}` : AGE_BANDS[1];
  const [band, setBand] = useState(AGE_BANDS.includes(detectedBand) ? detectedBand : AGE_BANDS[1]);

  // Only the equity-participation reference moves with age, and it moves by the
  // same deterministic NitiCore™ rule (roughly 100 − age). Every other cohort
  // reference is structural, so it is left exactly as the engine calculated it.
  const bandStart = Number(band.split("-")[0]);
  const rows = peer.rows.map((r) =>
    /equity participation/i.test(r.label)
      ? { ...r, typical: Math.max(20, Math.min(90, 100 - (bandStart + 2))) }
      : r,
  );

  const conc = rows.find((r) => /largest holding/i.test(r.label));
  const div = rows.find((r) => /diversification/i.test(r.label));
  const conclusion = (() => {
    const bits: string[] = [];
    if (div)
      bits.push(
        Math.abs(div.you - div.typical) <= 8
          ? "Your portfolio is broadly aligned with peers on diversification"
          : div.you > div.typical
            ? "Your portfolio is better diversified than your cohort"
            : "Your portfolio is less diversified than your cohort",
      );
    if (conc)
      bits.push(
        Math.abs(conc.you - conc.typical) <= 5
          ? "and concentration sits in the usual range"
          : conc.you > conc.typical
            ? `but concentration is materially higher — ${conc.you}% in one holding against a typical ${conc.typical}%`
            : "and concentration is lower than typical",
      );
    return bits.length ? `${bits.join(", ")}.` : "";
  })();

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">{peer.cohort}</p>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Compare with age
          <select
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] text-foreground"
          >
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5">
        <PeerRails rows={rows} />
      </div>
      {conclusion && (
        <p className="mt-5 border-t border-border/70 pt-4 text-[13px] leading-relaxed text-foreground/90">
          {conclusion}
        </p>
      )}
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        {peer.note} City-level benchmarks are not shown because NitiVitt has no reliable location
        data to compare against — behaviour and structure are the comparisons that matter here.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      {hint && <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
