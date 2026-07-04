import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { captureRuntimeEnv } from "./lib/runtime-env";


type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Cloudflare Workers deliver env via the fetch arg, not process.env.
    // Capture it before anything else runs so downstream server code
    // (auth-middleware, client.server, ai-gateway) can read it.
    captureRuntimeEnv(env);

    // Loud diagnostic: catch missing/placeholder Supabase config early.
    const e = (env ?? {}) as Record<string, string | undefined>;
    const key = e.SUPABASE_PUBLISHABLE_KEY;
    if (!e.SUPABASE_URL || !key || /XXXX|PLACEHOLDER|<.+>/i.test(key)) {
      console.error(
        `[NitiVitt] Bad Supabase Worker config: SUPABASE_URL=${
          e.SUPABASE_URL ? "set" : "MISSING"
        }, SUPABASE_PUBLISHABLE_KEY=${
          !key ? "MISSING" : /XXXX|PLACEHOLDER|<.+>/i.test(key) ? "PLACEHOLDER" : "set"
        }`,
      );
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);

    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
