// ONE interface for all AI. Switching provider = config change (AI_PROVIDER), not code change.
import type { Env } from "../types";
import { GeminiProvider } from "./gemini";

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
    case "gemini":
      return env.GEMINI_API_KEY ? new GeminiProvider(env.GEMINI_API_KEY) : new StubAiProvider();
    // A "claude" provider (Haiku) plugs in here later with no other code change.
    default:
      return new StubAiProvider();
  }
}
