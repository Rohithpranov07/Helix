import { ExternalApiError, ValidationError } from "@helix/shared";
import { withRetry } from "./_retry.js";

const _GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

function apiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new ExternalApiError("GEMINI_API_KEY is not set", "gemini");
  return key;
}

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export interface AnalyzeOptions {
  parts: GeminiPart[];
  systemPrompt?: string;
  model?: string;
  json?: boolean;
}

export interface AnalyzeResult {
  content: string;
}

export async function analyze(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const key = apiKey();
  const model = opts.model ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: opts.parts }],
  };
  if (opts.systemPrompt) {
    body["systemInstruction"] = { parts: [{ text: opts.systemPrompt }] };
  }
  if (opts.json) {
    body["generationConfig"] = { responseMimeType: "application/json" };
  }

  const res = await withRetry(
    async () => {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new ExternalApiError(
          `Gemini generateContent ${r.status}: ${text.slice(0, 200)}`,
          "gemini",
          r.status,
        );
      }
      return r.json() as Promise<{
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      }>;
    },
    { maxAttempts: 3, baseDelayMs: 800, provider: "gemini" },
  );

  const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text == null) {
    throw new ExternalApiError("Gemini returned no content", "gemini");
  }

  if (opts.json) {
    try {
      JSON.parse(text);
    } catch {
      throw new ValidationError("Gemini returned invalid JSON", { raw: text });
    }
  }

  return { content: text };
}

export async function embed(text: string, dimensions = 1536): Promise<number[]> {
  const key = apiKey();

  const body = {
    content: { parts: [{ text }] },
    embedContentConfig: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: dimensions,
    },
  };

  const res = await withRetry(
    async () => {
      const r = await fetch(EMBED_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new ExternalApiError(
          `Gemini embedContent ${r.status}: ${t.slice(0, 200)}`,
          "gemini",
          r.status,
        );
      }
      return r.json() as Promise<{ embedding?: { values?: number[] } }>;
    },
    { maxAttempts: 3, baseDelayMs: 800, provider: "gemini" },
  );

  const values = res.embedding?.values;
  if (!values || values.length === 0) {
    throw new ExternalApiError("Gemini embedContent returned no values", "gemini");
  }
  return values;
}
