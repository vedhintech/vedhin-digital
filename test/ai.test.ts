import { describe, it, expect, vi, afterEach } from "vitest";
import { GeminiProvider } from "../src/ai/gemini";
import { getAiProvider } from "../src/ai/provider";
import type { Env } from "../src/types";

afterEach(() => vi.restoreAllMocks());

describe("AiProvider", () => {
  it("defaults to the stub; gemini only with a key (config change, not code change)", () => {
    expect(getAiProvider({ AI_PROVIDER: "stub" } as Env).name).toBe("stub");
    expect(getAiProvider({ AI_PROVIDER: "gemini" } as Env).name).toBe("stub");
    expect(getAiProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" } as Env).name).toBe("gemini");
  });
  it("gemini parses a draft, sends only the photo + fixed prompt, and survives bad JSON", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"Bandhej Suit","description":"Pink bandhej suit","category":"Suits"}' }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40 } })));
    vi.stubGlobal("fetch", f);
    const p = new GeminiProvider("key");
    const r = await p.draftProductFromPhoto({ mime: "image/jpeg", base64: "AAAA" });
    expect(r.draft).toMatchObject({ name: "Bandhej Suit", category: "Suits" });
    expect(r.usage).toEqual({ inputTokens: 300, outputTokens: 40 });
    const sent = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(JSON.stringify(sent)).not.toMatch(/phone|address|pincode/i);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }))));
    expect((await p.draftProductFromPhoto({ mime: "image/jpeg", base64: "A" })).draft.name).toBe("Naya product");
  });
  it("propagates provider errors so the caller can reply gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 429 })));
    await expect(new GeminiProvider("k").classifyIntent("hi")).rejects.toThrow("gemini 429");
  });
});
