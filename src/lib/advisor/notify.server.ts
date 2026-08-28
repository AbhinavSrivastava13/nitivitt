/**
 * Advisor notification channel (server-only).
 *
 * V1 sends a plain-text summary of every advisor request to the NitiVitt
 * operations inbox. The channel is intentionally pluggable: the moment an
 * email domain / provider is configured, only `deliver()` changes - callers
 * stay identical.
 */
import { getRuntimeEnv } from "@/lib/runtime-env";
import type { AdvisorBriefing } from "./types";

export const ADVISOR_OPS_INBOX = "nitivitt.in@gmail.com";

export interface AdvisorNotification {
  referenceId: string;
  packageName: string;
  amountInr: number;
  topics: string[];
  summary: string;
  preferredSlots: string[];
  contactPhone: string | null;
  documentCount: number;
  briefing: AdvisorBriefing;
}

export function renderAdvisorEmail(n: AdvisorNotification): { subject: string; text: string } {
  const b = n.briefing;
  const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
  const lines = [
    `New advisor request - ${n.referenceId}`,
    ``,
    `Package: ${n.packageName} (${inr(n.amountInr)})`,
    `Topics: ${n.topics.join(", ") || "-"}`,
    `Preferred times: ${n.preferredSlots.join(" | ") || "-"}`,
    `Contact: ${n.contactPhone ?? "-"}`,
    `Documents attached: ${n.documentCount}`,
    ``,
    `- What the client wrote -`,
    n.summary || "(no description provided)",
    ``,
    `- NitiCore™ briefing -`,
    `Client: ${b.client.firstName}, ${b.client.ageYears} yrs, ${b.client.city ?? "city n/a"}, ${b.client.occupation ?? "occupation n/a"}, dependents: ${b.client.dependents}`,
    `NitiScore: ${b.metrics.nitiScore} (${b.metrics.nitiScoreGrade}) · NitiAge: ${b.metrics.nitiAge} (${b.metrics.nitiAgeDirection})`,
    `Net worth: ${inr(b.metrics.netWorth)} · Income: ${inr(b.metrics.monthlyIncome)}/mo · Expenses: ${inr(b.metrics.monthlyExpenses)}/mo`,
    `Savings rate: ${b.metrics.savingsRatePct}% · Emergency: ${b.metrics.emergencyMonths} months · Debt ratio: ${b.metrics.debtRatioPct}%`,
    `Insurance adequacy: ${b.metrics.insuranceAdequacyPct}% · Retirement: ${b.metrics.retirementStatus}`,
    `Analyzers - NitiSure: ${b.analyzers.nitiSurePolicies} policies · NitiInvest: ${b.analyzers.nitiInvestPortfolios} portfolios (${inr(b.analyzers.nitiInvestValue)}) · NitiLoan: ${b.analyzers.nitiLoanCount} loans (${inr(b.analyzers.nitiLoanOutstanding)}) · NitiTax: ${b.analyzers.nitiTaxRegime ?? "not run"}`,
    `Context: ${b.context.summary}`,
    ``,
    `Top NitiPath™ actions:`,
    ...b.topActions.map((a, i) => `  ${i + 1}. [${a.priority}] ${a.title} → ${a.nextAction}`),
    ``,
    b.goals.length ? `Goals: ${b.goals.map((g) => `${g.name} (${inr(g.target)})`).join(", ")}` : `Goals: none recorded`,
  ];
  return {
    subject: `NitiVitt advisor request ${n.referenceId} - ${n.packageName}`,
    text: lines.join("\n"),
  };
}

/**
 * Delivers the notification. Returns true only when it actually left the
 * building - the caller records `notified_at` accordingly.
 */
export async function deliverAdvisorNotification(n: AdvisorNotification): Promise<boolean> {
  const { subject, text } = renderAdvisorEmail(n);

  // Optional ops webhook (Slack / Zapier / internal endpoint).
  const webhook = getRuntimeEnv("ADVISOR_NOTIFY_WEBHOOK_URL");
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: ADVISOR_OPS_INBOX, subject, text, reference: n.referenceId }),
      });
      if (res.ok) return true;
      console.error("Advisor webhook failed", res.status, await res.text().catch(() => ""));
    } catch (err) {
      console.error("Advisor webhook error", err);
    }
  }

  // Fallback: structured log so nothing is ever silently lost.
  console.info("[advisor-request]", JSON.stringify({ to: ADVISOR_OPS_INBOX, subject, text }));
  return false;
}
