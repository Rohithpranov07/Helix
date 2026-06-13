import { ExternalApiError } from "@helix/shared";
import { embed as geminiEmbed } from "./gemini.js";
import { withRetry } from "./_retry.js";

export type EmbeddingProvider = "gemini" | "local";

const EMBED_DIMENSIONS = 1536;

export async function embed(text: string): Promise<number[]> {
  const provider = (process.env["EMBEDDING_PROVIDER"] ?? "gemini") as EmbeddingProvider;

  switch (provider) {
    case "gemini":
      return geminiEmbed(text, EMBED_DIMENSIONS);

    case "local": {
      const base = process.env["HELIX_SOVEREIGN_BASE"];
      if (!base) {
        throw new ExternalApiError(
          "HELIX_SOVEREIGN_BASE is not set (required for local embedding provider)",
          "local",
        );
      }
      const url = `${base}/v1/embeddings`;
      const body = { input: text, model: "local" };

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
              `Local embeddings ${r.status}: ${t.slice(0, 200)}`,
              "local",
              r.status,
            );
          }
          const json = await r.json() as {
            data?: Array<{ embedding?: number[] }>;
          };
          const values = json.data?.[0]?.embedding;
          if (!values || values.length === 0) {
            throw new ExternalApiError("Local embeddings returned no values", "local");
          }
          return values;
        },
        { maxAttempts: 3, baseDelayMs: 300, provider: "local" },
      );
    }

    default:
      throw new ExternalApiError(
        `Unknown EMBEDDING_PROVIDER: ${String(provider)}`,
        String(provider),
      );
  }
}
