import { ExternalApiError } from "@helix/shared";

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  provider: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof ExternalApiError && err.statusCode != null) {
        const s = err.statusCode;
        // Don't retry 4xx (except 429) — they are deterministic failures
        if (s >= 400 && s < 500 && s !== 429) throw err;
      }
      if (attempt < opts.maxAttempts) {
        const delay = opts.baseDelayMs * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new ExternalApiError(
    `${opts.provider} call failed after ${opts.maxAttempts} attempts`,
    opts.provider,
  );
}
