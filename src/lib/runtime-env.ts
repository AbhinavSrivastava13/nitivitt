/**
 * Runtime environment resolver.
 *
 * On Cloudflare Workers, secrets/vars are delivered via the `env` argument
 * of the Worker's `fetch(request, env, ctx)` handler, not `process.env`.
 * `src/server.ts` calls `captureRuntimeEnv(env)` at the top of every request
 * so downstream server code can read variables via `getRuntimeEnv(name)`.
 *
 * Resolution order:
 *   1. Cloudflare `env` captured for this Worker instance.
 *   2. Nitro's Cloudflare binding store (`globalThis.__env__`).
 *   3. `process.env`  (Node/Lovable Cloud SSR).
 *
 * Also normalizes SUPABASE_URL to always include an `https://` scheme.
 */

type EnvRecord = Record<string, string | undefined>;

let capturedEnv: EnvRecord | undefined;

function getCloudflareGlobalEnv(): EnvRecord | undefined {
  const maybeGlobal = globalThis as typeof globalThis & { __env__?: unknown };
  return maybeGlobal.__env__ && typeof maybeGlobal.__env__ === "object"
    ? (maybeGlobal.__env__ as EnvRecord)
    : undefined;
}

export function captureRuntimeEnv(env: unknown): void {
  if (env && typeof env === "object") {
    // Merge — later captures win, but keep previously-seen keys as fallback.
    capturedEnv = { ...(capturedEnv ?? {}), ...(env as EnvRecord) };
  }
}

function normalize(name: string, raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const v = String(raw).trim();
  if (!v) return undefined;
  if (name === "SUPABASE_URL" && !/^https?:\/\//i.test(v)) {
    return `https://${v.replace(/^\/+/, "")}`;
  }
  return v;
}

export function getRuntimeEnv(name: string): string | undefined {
  const fromCf = capturedEnv?.[name];
  if (fromCf !== undefined && fromCf !== null && fromCf !== "") {
    return normalize(name, fromCf);
  }
  const fromCfGlobal = getCloudflareGlobalEnv()?.[name];
  if (fromCfGlobal !== undefined && fromCfGlobal !== null && fromCfGlobal !== "") {
    return normalize(name, fromCfGlobal);
  }
  const fromNode = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return normalize(name, fromNode);
}
