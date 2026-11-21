// ONE interface for all AI. Switching provider = config change (AI_PROVIDER), not code change.
import type { Env } from "../types";

export interface ProductDraft {
  name: string;
  description: string;
  category: string;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  readonly name: string;
  draftProductFromPhoto(image: { mime: string; base64: string }): Promise<{ draft: ProductDraft; usage: UsageInfo }>;
  classifyIntent(text: string): Promise<{ intent: string; usage: UsageInfo }>;
}

export class StubAiProvider implements AiProvider {
  readonly name = "stub";
  async draftProductFromPhoto() {
    return {
      draft: { name: "Naya product", description: "Description yahan aayegi.", category: "other" },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
  async classifyIntent(text: string) {
    return { intent: text.trim() ? "unknown" : "empty", usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

export function getAiProvider(env: Env): AiProvider {
  switch (env.AI_PROVIDER) {
    case "stub":
      return new StubAiProvider();
    // "gemini" and "claude" providers are added in M6 behind this same interface.
    default:
      return new StubAiProvider();
  }
}
