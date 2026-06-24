import { z } from "zod";
import { ExternalApiError, ValidationError } from "@helix/shared";
import { withRetry } from "./_retry.js";

// Qwen3.6-27B is served via Groq's OpenAI-compatible Chat Completions API.
// Base URL and model are overridable via env so a different OpenAI-compatible
// host (or model id) can be swapped in without code changes.
function baseUrl(): string {
  return (process.env["GROQ_BASE_URL"] ?? "https://api.groq.com/openai/v1").replace(/\/$/, "");
}

function chatUrl(): string {
  return `${baseUrl()}/chat/completions`;
}

function apiKey(): string {
  // Accept GROQ_API_KEY or the lowercase `groq_api` name used in .env.
  const key = process.env["GROQ_API_KEY"] ?? process.env["groq_api"];
  if (!key) throw new ExternalApiError("GROQ_API_KEY (or groq_api) is not set", "groq");
  return key;
}

function defaultModel(): string {
  return process.env["GROQ_MODEL"] ?? "qwen/qwen3.6-27b";
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
        reasoning: z.string().nullable().optional(),
        reasoning_content: z.string().nullable().optional(),
      }),
    }),
  ).min(1),
  model: z.string(),
});

// ── Rate-limit handling ─────────────────────────────────────────────────────────
// Groq's free tier caps tokens-per-minute (e.g. 8000 TPM) and returns HTTP 429
// with a precise Retry-After. Two defenses:
//   1. Serialize every request through a chain with a minimum spacing.
//   2. On 429, wait the server's Retry-After (or exponential backoff) and retry.
const MIN_REQUEST_SPACING_MS = Number(process.env["GROQ_MIN_SPACING_MS"] ?? 800);
const MAX_429_RETRIES = Number(process.env["GROQ_MAX_429_RETRIES"] ?? 6);

// Groq counts prompt tokens + max_tokens against the tokens-per-minute (TPM)
// budget (free tier ~8000). A large max_tokens reservation alone can exceed it
// (HTTP 413 "Request too large"). Default modestly and shrink on 413. Outputs
// here (a JSON strand, a mismatch list, a single-file patch) are small.
const DEFAULT_MAX_TOKENS = Number(process.env["GROQ_MAX_TOKENS"] ?? 4096);
const MIN_MAX_TOKENS = 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestStart = 0;

/** Serialize tasks with a minimum gap between request starts. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const wait = MIN_REQUEST_SPACING_MS - (Date.now() - lastRequestStart);
    if (wait > 0) await sleep(wait);
    lastRequestStart = Date.now();
    return task();
  });
  requestChain = run.then(() => undefined, () => undefined);
  return run;
}

/** POST the chat body, throttled and 429-aware. Resolves to the final Response. */
async function postChat(body: unknown): Promise<Response> {
  return schedule(async () => {
    const send = () => fetch(chatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    let res = await send();
    for (let attempt = 0; res.status === 429 && attempt < MAX_429_RETRIES; attempt++) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000 + 250
        : Math.min(2000 * 2 ** attempt, 30_000);
      await sleep(backoff);
      res = await send();
    }
    return res;
  });
}

async function doChat(opts: ChatOptions, maxTokens: number = DEFAULT_MAX_TOKENS): Promise<ChatResult> {
  const useJson = opts.json === true || opts.schema != null;

  const messages = [...opts.messages];
  if (useJson) {
    const sysIdx = messages.findIndex((m) => m.role === "system");
    const instruction =
      "Respond with a single valid JSON value only. No markdown code fences, no comments, " +
      "no reasoning, no prose before or after the JSON.";
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
    temperature: opts.temperature ?? (useJson ? 0.1 : 0.3),
    max_tokens: maxTokens,
    // Qwen3 on Groq is a reasoning model. Disable thinking — these are fast
    // structured-output tasks, and reasoning both slows the call and burns the
    // tokens-per-minute budget (and can starve the JSON, causing 400s).
    reasoning_effort: "none",
  };
  if (useJson) body["response_format"] = { type: "json_object" };

  const res = await postChat(body);

  // 413 = prompt + max_tokens exceeds the TPM budget. Shrink the output
  // reservation and retry before giving up — the prompt is usually the small part.
  if (res.status === 413 && maxTokens > MIN_MAX_TOKENS) {
    return doChat(opts, Math.max(MIN_MAX_TOKENS, Math.floor(maxTokens / 2)));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ExternalApiError(
      `Groq chat ${res.status}: ${text.slice(0, 200)}`,
      "groq",
      res.status,
    );
  }

  const raw = await res.json();
  const parsed = ChatApiResponseSchema.parse(raw);
  const msg = parsed.choices[0]!.message;
  const content = msg.content ?? msg.reasoning ?? msg.reasoning_content ?? null;
  if (content == null) {
    throw new ExternalApiError("Groq returned null content — increase token budget", "groq");
  }
  return { content, model: parsed.model };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const attempt = () => doChat(opts);

  if (opts.schema == null && opts.json !== true) {
    return withRetry(attempt, { maxAttempts: 3, baseDelayMs: 500, provider: "groq" });
  }

  // JSON mode: get a transport-level success, then parse + (optionally) validate
  // with up to two self-repair rounds. Recovers a model that wraps JSON in fences,
  // adds prose, or returns a near-miss schema instead of dropping work.
  let result = await withRetry(attempt, { maxAttempts: 3, baseDelayMs: 500, provider: "groq" });

  let parsed = tryParseJson(result.content);
  if (parsed === undefined) {
    const retry = await doChat(repairMessages(opts, result.content,
      "Your previous response was not valid JSON. Reply with ONLY the JSON value — no markdown, no prose."));
    parsed = tryParseJson(retry.content);
    if (parsed === undefined) {
      throw new ValidationError("Groq returned invalid JSON after retry", { raw: retry.content });
    }
    result = retry;
  }

  if (opts.schema == null) {
    return { content: JSON.stringify(parsed), model: result.model };
  }

  let validated = opts.schema.safeParse(parsed);
  if (!validated.success) {
    const issues = validated.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    const schemaRetry = await doChat(repairMessages(opts, result.content,
      `Your JSON did not match the required schema. Errors: ${issues}. ` +
      `Reply with ONLY corrected JSON that satisfies the schema. No markdown, no prose.`));
    const parsedRetry = tryParseJson(schemaRetry.content);
    if (parsedRetry === undefined) {
      throw new ValidationError("Groq returned invalid JSON after schema retry", { raw: schemaRetry.content });
    }
    validated = opts.schema.safeParse(parsedRetry);
    if (!validated.success) {
      throw new ValidationError("Groq JSON response failed schema validation", validated.error.issues);
    }
    return { content: JSON.stringify(validated.data), model: schemaRetry.model };
  }

  return { content: JSON.stringify(validated.data), model: result.model };
}

function repairMessages(opts: ChatOptions, previous: string, instruction: string): ChatOptions {
  return {
    ...opts,
    messages: [
      ...opts.messages,
      { role: "assistant", content: previous },
      { role: "user", content: instruction },
    ],
  };
}

/**
 * Best-effort JSON parse that survives the common ways a chat model mangles JSON:
 * markdown fences, a leading reasoning preamble, or trailing prose. Returns the
 * parsed value, or `undefined` when nothing parseable is found.
 */
function tryParseJson(text: string): unknown {
  const stripped = stripFences(text);
  const direct = parseOrUndefined(stripped);
  if (direct !== undefined) return direct;

  const candidate = extractJsonSpan(stripped);
  if (candidate != null) {
    const fromSpan = parseOrUndefined(candidate);
    if (fromSpan !== undefined) return fromSpan;
  }
  return undefined;
}

function parseOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractJsonSpan(text: string): string | null {
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start = -1;
  let close = "}";
  if (firstObj === -1 && firstArr === -1) return null;
  if (firstArr === -1 || (firstObj !== -1 && firstObj < firstArr)) {
    start = firstObj; close = "}";
  } else {
    start = firstArr; close = "]";
  }
  const lastClose = text.lastIndexOf(close);
  if (lastClose <= start) return null;
  return text.slice(start, lastClose + 1);
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}
