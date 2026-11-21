import type { AiProvider, ProductDraft, UsageInfo } from "./provider";

/** Gemini (free tier) provider. Only product photos and fixed prompts are sent: never buyer data. */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  constructor(private apiKey: string, private model = "gemini-2.0-flash") {}

  private async call(parts: unknown[]): Promise<{ text: string; usage: UsageInfo }> {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 300 } }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    return { text: j.candidates?.[0]?.content?.parts?.[0]?.text ?? "", usage: { inputTokens: j.usageMetadata?.promptTokenCount ?? 0, outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0 } };
  }

  async draftProductFromPhoto(image: { mime: string; base64: string }) {
    const prompt = 'Ye ek Indian ladies dress ya jewellery product ki photo hai. Sirf JSON do: {"name": "short product naam (Hinglish, max 6 words)", "description": "ek do line description Hinglish me, sirf jo photo me dikhta hai", "category": "Suits|Kurtis|Sarees|Lehenga|Dupatta|Necklace Sets|Earrings|Bangles|Maang Tikka|Rings|Bridal|Other"}. Price ya jhooth mat likho.';
    const { text, usage } = await this.call([{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.base64 } }]);
    let d: Partial<ProductDraft> = {};
    try { d = JSON.parse(text); } catch { /* fall through to defaults */ }
    return {
      draft: { name: String(d.name ?? "Naya product").slice(0, 80), description: String(d.description ?? "").slice(0, 400), category: String(d.category ?? "Other").slice(0, 40) },
      usage,
    };
  }

  async classifyIntent(text: string) {
    const { text: out, usage } = await this.call([{ text: `Seller message: "${text.slice(0, 300)}". Sirf JSON: {"intent": "add_product|change_design|price_stock|orders|help|call|other"}` }]);
    let intent = "other";
    try { intent = String((JSON.parse(out) as { intent?: string }).intent ?? "other"); } catch { /* keep default */ }
    return { intent, usage };
  }
}
