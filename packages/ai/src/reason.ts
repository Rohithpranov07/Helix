import { z } from "zod";
import { ExternalApiError } from "@helix/shared";
import { chat, type ChatMessage, type ChatResult } from "./groq.js";
import { withRetry } from "./_retry.js";

export interface ReasonOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  json?: boolean;
  schema?: z.ZodTypeAny;
}

const CREDIT_EXHAUSTED = new Set([402, 429]);

export async function reason(opts: ReasonOptions): Promise<ChatResult> {
  if (process.env["HELIX_SOVEREIGN"] === "1") {
    return sovereignChat(opts);
  }
  try {
    return await chat(opts);
  } catch (err) {
    // Auto-fallback: Groq credits/rate exhausted → sovereign if configured
    if (
      err instanceof ExternalApiError &&
      err.provider === "groq" &&
      err.statusCode != null &&
      CREDIT_EXHAUSTED.has(err.statusCode) &&
      process.env["HELIX_SOVEREIGN_BASE"]
    ) {
      return sovereignChat(opts);
    }
    throw err;
  }
}

async function sovereignChat(opts: ReasonOptions): Promise<ChatResult> {
  const base = process.env["HELIX_SOVEREIGN_BASE"];
  if (!base) {
    throw new ExternalApiError(
      "HELIX_SOVEREIGN_BASE is not set (required when HELIX_SOVEREIGN=1)",
      "sovereign",
    );
  }
  const url = `${base}/v1/chat/completions`;

  const body: Record<string, unknown> = {
    model: opts.model ?? process.env["HELIX_SOVEREIGN_MODEL"] ?? "local",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.json) body["response_format"] = { type: "json_object" };

  return withRetry(
    async () => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new ExternalApiError(
          `Sovereign LLM ${r.status}: ${t.slice(0, 200)}`,
          "sovereign",
          r.status,
        );
      }
      const json = await r.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      const content = json.choices?.[0]?.message?.content;
      if (content == null) {
        throw new ExternalApiError("Sovereign LLM returned no content", "sovereign");
      }
      return { content, model: json.model ?? "sovereign" };
    },
    { maxAttempts: 3, baseDelayMs: 500, provider: "sovereign" },
  );
}
