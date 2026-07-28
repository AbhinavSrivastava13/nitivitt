/**
 * NitiTax™ — server functions (scaffold).
 *
 * These are wired to Supabase in the next milestone once the `tax_analyses`
 * table exists. For now they compile against the deterministic engine only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { analyzeTax } from "./engine";
import { emptyTaxInput, type TaxInput, type TaxReport } from "./types";

const AnalyzeInput = z.object({
  input: z.custom<TaxInput>().optional(),
});

export const analyzeTaxServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AnalyzeInput.parse(v ?? {}))
  .handler(async ({ data }): Promise<{ report: TaxReport; input: TaxInput }> => {
    const input = data.input ?? emptyTaxInput();
    const report = analyzeTax(input);
    return { report, input };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const listTaxAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<never[]> => {
    return [];
  });

export const getTaxAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async (): Promise<null> => {
    return null;
  });

export const deleteTaxAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async (): Promise<{ ok: true }> => {
    return { ok: true };
  });
