import { describe, it, expect } from "vitest";
import { ScanRunReqSchema, ScanRunResSchema } from "./contracts.js";

describe("scan.run contracts", () => {
  it("accepts a valid request", () => {
    const result = ScanRunReqSchema.safeParse({ targetUrl: "http://localhost:3001" });
    expect(result.success).toBe(true);
  });

  it("rejects a request missing targetUrl", () => {
    const result = ScanRunReqSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a request with a non-URL string", () => {
    const result = ScanRunReqSchema.safeParse({ targetUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid response with findings", () => {
    const result = ScanRunResSchema.safeParse({
      findings: [
        {
          class: "SQLi",
          endpoint: "/api/search",
          evidence: "error in SQL syntax",
          reAttack: { before: "open", after: "open" },
          status: "open",
          detectedAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response with an invalid VulnClass", () => {
    const result = ScanRunResSchema.safeParse({
      findings: [
        {
          class: "BufferOverflow",
          endpoint: "/api/search",
          evidence: "test",
          reAttack: { before: "open", after: "open" },
          status: "open",
          detectedAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
