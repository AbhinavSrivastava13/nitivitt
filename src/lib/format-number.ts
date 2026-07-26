/**
 * Number formatting helpers for input experience.
 *
 * - Indian digit grouping (1,50,000 / 25,00,000) while typing.
 * - Decimal-tolerant parsing so 8.35, 8.75, 9.15 all round-trip cleanly.
 */

/** Strip everything except digits and a single dot. */
export function sanitizeNumericInput(raw: string, opts?: { allowDecimal?: boolean }): string {
  const allowDecimal = opts?.allowDecimal ?? true;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!allowDecimal) return cleaned.replace(/\./g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  // keep only the first dot
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

/** Parse Indian-formatted or plain string to a finite number. Empty → 0. */
export function parseIndianNumber(raw: string): number {
  const s = sanitizeNumericInput(raw);
  if (!s || s === ".") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Format a number with Indian digit grouping. Preserves the user's decimal tail. */
export function formatIndianNumber(raw: string | number): string {
  const s = typeof raw === "number" ? String(raw) : sanitizeNumericInput(raw);
  if (!s) return "";
  const [intPartRaw, decPart] = s.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  // Indian grouping: last 3, then groups of 2.
  let formatted: string;
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}
