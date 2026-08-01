import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, FileText, Loader2, Lock,
  Paperclip, Shield, Sparkles, Trash2, UserRound, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/platform/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  submitAdvisorRequest,
  listAdvisorRequests,
} from "@/lib/advisor/advisor.functions";
import {
  ADVISOR_PACKAGES,
  ADVISOR_TOPICS,
  SLOT_WINDOWS,
  slotLabel,
  type AdvisorDocumentRef,
  type AdvisorPackageId,
  type AdvisorPreferredSlot,
  type AdvisorSlotWindow,
  type AdvisorTopicId,
} from "@/lib/advisor/types";

export const Route = createFileRoute("/_authenticated/financial-advisor")({
  head: () => ({
    meta: [
      { title: "Financial Advisor — Talk to a Fee-Only Expert — NitiVitt" },
      {
        name: "description",
        content:
          "Book a private session with a SEBI-registered, fee-only advisor. Your NitiVitt briefing — NitiScore™, NitiAge™ and top actions — is attached automatically.",
      },
      { property: "og:title", content: "Financial Advisor — NitiVitt" },
      {
        property: "og:description",
        content:
          "A human conversation grounded in your own numbers. Fee-only advisors, no product pitches, transparent packages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancialAdvisorPage,
});

const MAX_FILE_MB = 10;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx";

interface Draft {
  topics: AdvisorTopicId[];
  summary: string;
  documents: AdvisorDocumentRef[];
  slots: AdvisorPreferredSlot[];
  contactPhone: string;
  packageId: AdvisorPackageId | null;
}

const EMPTY_DRAFT: Draft = {
  topics: [],
  summary: "",
  documents: [],
  slots: [],
  contactPhone: "",
  packageId: null,
};

type Confirmation = {
  referenceId: string;
  packageName: string;
  amountInr: number;
  slots: AdvisorPreferredSlot[];
};

function FinancialAdvisorPage() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  return (
    <PageShell
      eyebrow="Service · Financial Advisor"
      title="Talk to a human"
      lede="Fee-only, SEBI-registered advisors who read your NitiVitt briefing before the call. No commissions, no product pitches - just a calm conversation about your money."
    >
      <div className="mx-auto max-w-5xl space-y-8">
        {confirmation ? (
          <SuccessScreen
            confirmation={confirmation}
            onNew={() => setConfirmation(null)}
          />
        ) : (
          <>
            <Wizard onDone={setConfirmation} />
            <PastRequests />
          </>
        )}
      </div>
    </PageShell>
  );
}

// ───────────────────────────── WIZARD ─────────────────────────────

const STEPS = [
  { n: 1, label: "Topics" },
  { n: 2, label: "Your situation" },
  { n: 3, label: "Documents" },
  { n: 4, label: "Preferred time" },
  { n: 5, label: "Package" },
] as const;

function Wizard({ onDone }: { onDone: (c: Confirmation) => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const submitFn = useServerFn(submitAdvisorRequest);
  const qc = useQueryClient();

  const canContinue = useMemo(() => {
    if (step === 1) return draft.topics.length > 0;
    if (step === 2) return draft.summary.trim().length >= 20;
    if (step === 3) return true;
    if (step === 4) return draft.slots.length > 0;
    if (step === 5) return draft.packageId !== null;
    return false;
  }, [step, draft]);

  async function submit() {
    if (!draft.packageId) return;
    setBusy(true);
    try {
      const res = await submitFn({
        data: {
          topics: draft.topics,
          summary: draft.summary.trim(),
          documents: draft.documents,
          preferredSlots: draft.slots,
          timezone: "Asia/Kolkata",
          contactPhone: draft.contactPhone.trim() || undefined,
          packageId: draft.packageId,
        },
      });
      await qc.invalidateQueries({ queryKey: ["advisor-requests"] });
      onDone({
        referenceId: res.referenceId,
        packageName: res.packageName,
        amountInr: res.amountInr,
        slots: draft.slots,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      <Stepper current={step} />

      <div className="mt-8">
        {step === 1 && <StepTopics draft={draft} setDraft={setDraft} />}
        {step === 2 && <StepSummary draft={draft} setDraft={setDraft} />}
        {step === 3 && <StepDocuments draft={draft} setDraft={setDraft} />}
        {step === 4 && <StepSlots draft={draft} setDraft={setDraft} />}
        {step === 5 && <StepPackage draft={draft} setDraft={setDraft} />}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || busy}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canContinue || busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Submitting…" : "Confirm request"}
          </button>
        )}
      </div>
    </section>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                done
                  ? "bg-success text-success-foreground"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span
              className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="hidden h-px w-6 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl text-foreground md:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

type StepProps = { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> };

function StepTopics({ draft, setDraft }: StepProps) {
  function toggle(id: AdvisorTopicId) {
    setDraft((d) => ({
      ...d,
      topics: d.topics.includes(id)
        ? d.topics.filter((t) => t !== id)
        : d.topics.length >= 6
          ? d.topics
          : [...d.topics, id],
    }));
  }
  return (
    <div>
      <StepHeading
        title="What would you like to discuss?"
        hint="Pick up to six. This decides which specialist we route you to."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ADVISOR_TOPICS.map((t) => {
          const on = draft.topics.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                on
                  ? "border-primary bg-primary-soft ring-1 ring-primary/30"
                  : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">{t.label}</span>
                {on && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                {t.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepSummary({ draft, setDraft }: StepProps) {
  const len = draft.summary.trim().length;
  return (
    <div>
      <StepHeading
        title="Tell the advisor what's on your mind"
        hint="Write it the way you'd say it out loud. The more context, the less time you spend explaining on the call."
      />
      <textarea
        value={draft.summary}
        onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value.slice(0, 3000) }))}
        rows={9}
        placeholder="e.g. I'm 34, salaried in Bengaluru, ₹1.6L take-home. I have a home loan at 8.6% and I'm confused whether to prepay it or increase my SIPs. Also unsure if my ₹50L term cover is enough now that we have a child."
        className="mt-6 w-full rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{len < 20 ? `At least ${20 - len} more characters` : "Looks good."}</span>
        <span>{draft.summary.length}/3000</span>
      </div>

      <label className="mt-6 block max-w-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Phone (optional)
        </span>
        <input
          value={draft.contactPhone}
          onChange={(e) => setDraft((d) => ({ ...d, contactPhone: e.target.value.slice(0, 20) }))}
          placeholder="+91 98XXXXXXXX"
          className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        />
      </label>
    </div>
  );
}

function StepDocuments({ draft, setDraft }: StepProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onSelect(list: FileList | null) {
    if (!list || !user) return;
    const files = Array.from(list);
    setUploading(true);
    try {
      for (const file of files) {
        if (draft.documents.length >= 10) {
          toast.error("You can attach up to 10 documents.");
          break;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          toast.error(`${file.name} is larger than ${MAX_FILE_MB} MB.`);
          continue;
        }
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from("advisor-documents")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        setDraft((d) => ({
          ...d,
          documents: [...d.documents, { path, name: file.name, size: file.size, type: file.type }],
        }));
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(path: string) {
    await supabase.storage.from("advisor-documents").remove([path]);
    setDraft((d) => ({ ...d, documents: d.documents.filter((x) => x.path !== path) }));
  }

  return (
    <div>
      <StepHeading
        title="Attach anything useful"
        hint="Salary slips, Form 16, policy PDFs, portfolio statements, loan schedules. Optional - but it makes the session sharper."
      />

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <Paperclip className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm text-foreground">PDF, image, spreadsheet or document — up to {MAX_FILE_MB} MB each</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stored privately. Only you and the advisor assigned to this request can open them.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => onSelect(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Choose files"}
        </button>
      </div>

      {draft.documents.length > 0 && (
        <ul className="mt-5 space-y-2">
          {draft.documents.map((doc) => (
            <li
              key={doc.path}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{doc.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(doc.size / 1024).toFixed(0)} KB
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(doc.path)}
                className="rounded-full p-2 text-muted-foreground transition hover:text-destructive"
                aria-label={`Remove ${doc.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepSlots({ draft, setDraft }: StepProps) {
  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = 1; i <= 14; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, []);
  const [date, setDate] = useState(dates[0] ?? "");

  function add(window: AdvisorSlotWindow) {
    setDraft((d) => {
      if (d.slots.length >= 3) return d;
      if (d.slots.some((s) => s.date === date && s.window === window)) return d;
      return { ...d, slots: [...d.slots, { date, window }] };
    });
  }

  return (
    <div>
      <StepHeading
        title="When suits you?"
        hint="Give us up to three options (IST) and we'll confirm one within 24 hours."
      />

      <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Date
          </span>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Time window
          </span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {SLOT_WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={draft.slots.length >= 3}
                onClick={() => add(w.id)}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-left transition hover:border-primary/50 disabled:opacity-40"
              >
                <span className="block text-sm font-semibold text-foreground">{w.label}</span>
                <span className="text-xs text-muted-foreground">{w.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Selected ({draft.slots.length}/3)
        </span>
        {draft.slots.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Pick at least one slot to continue.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {draft.slots.map((s) => (
              <li
                key={`${s.date}-${s.window}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm text-primary"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {slotLabel(s)}
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      slots: d.slots.filter((x) => !(x.date === s.date && x.window === s.window)),
                    }))
                  }
                  className="text-primary/70 transition hover:text-primary"
                  aria-label="Remove slot"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StepPackage({ draft, setDraft }: StepProps) {
  return (
    <div>
      <StepHeading
        title="Choose your package"
        hint="Flat fees, paid once. Advisors are fee-only - they earn nothing from what you buy."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {ADVISOR_PACKAGES.map((p) => {
          const on = draft.packageId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, packageId: p.id }))}
              className={`flex h-full flex-col rounded-2xl border p-6 text-left transition ${
                on
                  ? "border-primary bg-primary-soft ring-1 ring-primary/30"
                  : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              {p.featured && (
                <span className="mb-3 inline-flex w-fit rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-foreground">
                  Most chosen
                </span>
              )}
              <span className="text-sm font-semibold text-foreground">{p.name}</span>
              <span className="mt-2 font-display text-3xl text-foreground">
                ₹{p.priceInr}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{p.duration}</span>
              <span className="mt-3 text-xs leading-relaxed text-muted-foreground">{p.tagline}</span>
              <ul className="mt-4 space-y-2">
                {p.includes.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {i}
                  </li>
                ))}
              </ul>
              {on && (
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your request is confirmed the moment you submit. We'll send a secure payment link for{" "}
          {draft.packageId
            ? `₹${ADVISOR_PACKAGES.find((p) => p.id === draft.packageId)?.priceInr}`
            : "the selected package"}{" "}
          along with the confirmed slot - you are never charged before a slot is agreed.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your NitiCore™ briefing - NitiScore™, NitiAge™, net worth, savings rate, protection,
          debt and your top NitiPath™ actions - is attached automatically so the advisor arrives
          prepared.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────── SUCCESS ───────────────────────────

function SuccessScreen({
  confirmation,
  onNew,
}: {
  confirmation: Confirmation;
  onNew: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="relative border-b border-border bg-primary-soft px-8 py-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 className="mt-5 font-display text-3xl text-foreground">Request received</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          A fee-only advisor is being matched to your request. You'll hear from us within 24 hours
          with a confirmed slot and a secure payment link.
        </p>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(confirmation.referenceId);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-5 py-2.5 font-mono text-sm font-semibold text-foreground transition hover:border-primary"
        >
          {confirmation.referenceId}
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">Your reference ID — quote it in any reply.</p>
      </div>

      <div className="grid gap-6 px-8 py-8 sm:grid-cols-3">
        <Detail label="Package" value={confirmation.packageName} />
        <Detail label="Amount" value={`₹${confirmation.amountInr}`} />
        <Detail
          label="Preferred times"
          value={confirmation.slots.map((s) => slotLabel(s)).join(" · ")}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-8 py-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <UserRound className="h-4 w-4" /> Book another session
        </button>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

// ─────────────────────── PAST REQUESTS ───────────────────────

function PastRequests() {
  const listFn = useServerFn(listAdvisorRequests);
  const q = useQuery({ queryKey: ["advisor-requests"], queryFn: () => listFn() });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your requests…
      </div>
    );
  }

  const items = q.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={UserRound}
        title="No advisor sessions yet"
        description="Once you book a session it appears here with its reference ID, package and status."
      />
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      <h2 className="font-display text-2xl text-foreground">Your advisor requests</h2>
      <ul className="mt-5 space-y-3">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-foreground">{r.referenceId}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.packageName} · ₹{r.amountInr} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {r.status}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  r.paymentStatus === "paid"
                    ? "bg-success-soft text-success"
                    : "bg-warning-soft text-warning"
                }`}
              >
                {r.paymentStatus === "paid" ? "paid" : "payment pending"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
