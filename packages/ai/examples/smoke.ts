/**
 * Run: SARVAM_API_KEY=<key> npx tsx examples/smoke.ts
 * Each test is gated; set SKIP_TTS=1 / SKIP_STT=1 / SKIP_EMBED=1 to bypass.
 */

import { z } from "zod";
import { sarvam, embed, reason } from "../src/index.js";

async function testChat() {
  console.log("\n--- sarvam.chat (plain) ---");
  const res = await sarvam.chat({
    messages: [
      { role: "system", content: "You are a helpful assistant. Keep answers to one sentence." },
      { role: "user", content: "What is HELIX in the context of autonomous software?" },
    ],
  });
  console.log("model:", res.model);
  console.log("response:", res.content);
}

async function testChatJson() {
  console.log("\n--- sarvam.chat (json + schema) ---");
  const schema = z.object({ answer: z.string(), confidence: z.number().min(0).max(1) });
  const res = await sarvam.chat({
    messages: [
      {
        role: "user",
        content: 'Return a JSON with keys "answer" (string) and "confidence" (number 0-1). Question: what color is the sky?',
      },
    ],
    json: true,
    schema,
  });
  console.log("parsed:", res.content);
}

async function testTts() {
  if (process.env["SKIP_TTS"] === "1") {
    console.log("\n--- TTS skipped (SKIP_TTS=1) ---");
    return;
  }
  console.log("\n--- sarvam.tts ---");
  const buf = await sarvam.tts({ text: "HELIX is alive.", languageCode: "en-IN" });
  console.log(`received ${buf.length} bytes of WAV audio`);
}

async function testEmbed() {
  if (process.env["SKIP_EMBED"] === "1") {
    console.log("\n--- embed skipped (SKIP_EMBED=1) ---");
    return;
  }
  console.log("\n--- embed() ---");
  const vec = await embed("SQL injection in login endpoint");
  console.log(`embedding dims: ${vec.length}, first 4: [${vec.slice(0, 4).map((v) => v.toFixed(4)).join(", ")}]`);
}

async function testReason() {
  console.log("\n--- reason() ---");
  const res = await reason({
    messages: [
      { role: "user", content: "Say 'reason() works' and nothing else." },
    ],
  });
  console.log("response:", res.content);
}

async function main() {
  try {
    await testChat();
    await testChatJson();
    await testTts();
    await testEmbed();
    await testReason();
    console.log("\n✓ all smoke tests passed");
  } catch (err) {
    console.error("\n✗ smoke test failed:", err);
    process.exit(1);
  }
}

void main();
