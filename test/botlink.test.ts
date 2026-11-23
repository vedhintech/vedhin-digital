import { describe, it, expect } from "vitest";
import { botChatLink } from "../src/lib/wa";
import type { Env } from "../src/types";

describe("botChatLink", () => {
  const e = (n?: string) => ({ WHATSAPP_BOT_NUMBER: n }) as unknown as Env;
  it("builds a wa.me link from digits", () => {
    expect(botChatLink(e("+91 98765-43210"), "Hi")).toBe("https://wa.me/919876543210?text=Hi");
  });
  it("returns null when unset or invalid", () => {
    expect(botChatLink(e(undefined))).toBeNull();
    expect(botChatLink(e("123"))).toBeNull();
  });
});
