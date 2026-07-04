/**
 * Platform-agnostic AI chat helper.
 *
 * Resolution order:
 *   1. LOVABLE_API_KEY → Lovable AI Gateway (OpenAI-compatible, model: google/gemini-2.5-flash).
 *   2. GEMINI_API_KEY  → Google Generative Language API (direct), used when
 *      deployed outside Lovable Cloud (e.g. Cloudflare Workers).
 *
 * Same input / same output shape either way, so callers don't change.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
}

export interface ChatResult {
  text: string;
  provider: "lovable-gateway" | "gemini-direct";
}

import { getRuntimeEnv } from "./runtime-env";

function getEnv(name: string): string | undefined {
  return getRuntimeEnv(name);
}


export function isAiConfigured(): boolean {
  return Boolean(getEnv("LOVABLE_API_KEY") || getEnv("GEMINI_API_KEY"));
}

export async function callAiChat(opts: ChatOptions): Promise<ChatResult | null> {
  const lovableKey = getEnv("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = json.choices?.[0]?.message?.content?.trim() ?? "";
        if (text) return { text, provider: "lovable-gateway" };
      } else {
        console.error("Lovable gateway error", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("Lovable gateway fetch failed", err);
    }
  }

  const geminiKey = getEnv("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      // Fold system+user into Gemini's parts format.
      const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const userTurns = opts.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

      const body: Record<string, unknown> = {
        contents: userTurns,
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
        if (text) return { text, provider: "gemini-direct" };
      } else {
        console.error("Gemini direct error", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("Gemini direct fetch failed", err);
    }
  }

  return null;
}
