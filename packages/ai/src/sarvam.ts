import { z } from "zod";
import { ExternalApiError, ValidationError } from "@helix/shared";
import { withRetry } from "./_retry.js";

const CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";
const TTS_URL = "https://api.sarvam.ai/text-to-speech";
const STT_URL = "https://api.sarvam.ai/speech-to-text";

function apiKey(): string {
  const key = process.env["SARVAM_API_KEY"];
  if (!key) throw new ExternalApiError("SARVAM_API_KEY is not set", "sarvam");
  return key;
}

function defaultModel(): string {
  return process.env["SARVAM_MODEL"] ?? "sarvam-105b";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  json?: boolean;
  schema?: z.ZodTypeAny;
}

export interface ChatResult {
  content: string;
  model: string;
}

const ChatApiResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
        reasoning_content: z.string().nullable().optional(),
      }),
    }),
  ).min(1),
  model: z.string(),
});

async function doChat(opts: ChatOptions): Promise<ChatResult> {
  const key = apiKey();
  const useJson = opts.json === true || opts.schema != null;

  const messages = [...opts.messages];
  if (opts.schema != null) {
    const sysIdx = messages.findIndex((m) => m.role === "system");
    const instruction =
      "Respond with valid JSON only. No markdown code fences. No prose outside the JSON.";
    if (sysIdx >= 0) {
      messages[sysIdx] = {
        ...messages[sysIdx]!,
        content: messages[sysIdx]!.content + "\n\n" + instruction,
      };
    } else {
      messages.unshift({ role: "system", content: instruction });
    }
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? defaultModel(),
    messages,
    temperature: opts.temperature ?? 0.2,
  };
  if (useJson) body["response_format"] = { type: "json_object" };

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ExternalApiError(
      `Sarvam chat ${res.status}: ${text.slice(0, 200)}`,
      "sarvam",
      res.status,
    );
  }

  const raw = await res.json();
  const parsed = ChatApiResponseSchema.parse(raw);
  // sarvam-105b is a reasoning model: actual response lives in `content`;
  // when token budget is tight it may spill into `reasoning_content` only.
  const msg = parsed.choices[0]!.message;
  const content = msg.content ?? msg.reasoning_content ?? null;
  if (content == null) {
    throw new ExternalApiError("Sarvam returned null content — increase token budget", "sarvam");
  }
  return { content, model: parsed.model };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const attempt = () => doChat(opts);

  if (opts.schema == null) {
    return withRetry(attempt, { maxAttempts: 3, baseDelayMs: 500, provider: "sarvam" });
  }

  // JSON + schema mode: retry once on parse/validation failure
  let result: ChatResult;
  try {
    result = await withRetry(attempt, { maxAttempts: 2, baseDelayMs: 500, provider: "sarvam" });
  } catch (err) {
    throw err;
  }

  const raw = stripFences(result.content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Second attempt with an explicit reminder
    const retryOpts: ChatOptions = {
      ...opts,
      messages: [
        ...opts.messages,
        { role: "assistant", content: result.content },
        {
          role: "user",
          content: "Your previous response was not valid JSON. Respond with only valid JSON, no markdown.",
        },
      ],
    };
    const retry = await doChat(retryOpts);
    try {
      parsed = JSON.parse(stripFences(retry.content));
    } catch {
      throw new ValidationError("Sarvam returned invalid JSON after retry", { raw: retry.content });
    }
    result = retry;
  }

  const validated = opts.schema.safeParse(parsed);
  if (!validated.success) {
    // Retry once with explicit schema error feedback
    const issues = validated.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    const schemaRetryOpts: ChatOptions = {
      ...opts,
      messages: [
        ...opts.messages,
        { role: "assistant", content: result.content },
        {
          role: "user",
          content: `Your JSON did not match the required schema. Errors: ${issues}. Respond ONLY with valid JSON that fixes these errors. No markdown, no explanation.`,
        },
      ],
    };
    const schemaRetry = await doChat(schemaRetryOpts);
    const rawRetry = stripFences(schemaRetry.content);
    let parsedRetry: unknown;
    try {
      parsedRetry = JSON.parse(rawRetry);
    } catch {
      throw new ValidationError("Sarvam returned invalid JSON after schema retry", { raw: rawRetry });
    }
    const validatedRetry = opts.schema.safeParse(parsedRetry);
    if (!validatedRetry.success) {
      throw new ValidationError("Sarvam JSON response failed schema validation", validatedRetry.error.issues);
    }
    return { content: JSON.stringify(validatedRetry.data), model: schemaRetry.model };
  }

  return { content: JSON.stringify(validated.data), model: result.model };
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

// ---------- TTS (Bulbul v3) ----------

export interface TtsOptions {
  text: string;
  languageCode?: string;
  speaker?: string;
  pace?: number;
  sampleRate?: 8000 | 16000 | 22050 | 24000;
}

export async function tts(opts: TtsOptions): Promise<Buffer> {
  const key = apiKey();

  const body = {
    inputs: [opts.text],
    target_language_code: opts.languageCode ?? "en-IN",
    speaker: opts.speaker ?? "kavya",
    model: "bulbul:v3",
    pace: opts.pace ?? 1.0,
    speech_sample_rate: opts.sampleRate ?? 22050,
  };

  const res = await withRetry(
    async () => {
      const r = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": key,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new ExternalApiError(
          `Sarvam TTS ${r.status}: ${text.slice(0, 200)}`,
          "sarvam",
          r.status,
        );
      }
      return r;
    },
    { maxAttempts: 3, baseDelayMs: 500, provider: "sarvam" },
  );

  const json = await res.json() as { audios?: string[] };
  const b64 = json.audios?.[0];
  if (!b64) throw new ExternalApiError("Sarvam TTS returned no audio", "sarvam");

  return Buffer.from(b64, "base64");
}

/**
 * Voice text fallback — wraps tts() and returns null instead of throwing.
 * Callers should print the text when null is returned.
 */
export async function ttsSafe(opts: TtsOptions): Promise<Buffer | null> {
  try {
    return await tts(opts);
  } catch {
    return null;
  }
}

// ---------- STT (Saaras v3) ----------

export interface SttOptions {
  audio: Buffer;
  filename?: string;
  languageCode?: string;
}

export interface SttResult {
  transcript: string;
  languageCode: string;
}

export async function stt(opts: SttOptions): Promise<SttResult> {
  const key = apiKey();

  const form = new FormData();
  const blob = new Blob([new Uint8Array(opts.audio)], { type: "audio/wav" });
  form.append("file", blob, opts.filename ?? "audio.wav");
  form.append("model", "saaras:v3");
  if (opts.languageCode) form.append("language_code", opts.languageCode);

  const result = await withRetry(
    async () => {
      const r = await fetch(STT_URL, {
        method: "POST",
        headers: { "api-subscription-key": key },
        body: form,
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new ExternalApiError(
          `Sarvam STT ${r.status}: ${text.slice(0, 200)}`,
          "sarvam",
          r.status,
        );
      }
      return r.json() as Promise<{ transcript?: string; language_code?: string }>;
    },
    { maxAttempts: 3, baseDelayMs: 500, provider: "sarvam" },
  );

  if (!result.transcript) {
    throw new ExternalApiError("Sarvam STT returned no transcript", "sarvam");
  }

  return {
    transcript: result.transcript,
    languageCode: result.language_code ?? (opts.languageCode ?? "unknown"),
  };
}
