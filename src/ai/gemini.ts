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
    const prompt = 'This is a photo of an Indian ladies dress or jewellery product. Respond only as JSON: {"name": "short product name, max 6 words", "description": "one or two lines describing only what is visible in the photo", "category": "Suits|Kurtis|Sarees|Lehenga|Dupatta|Necklace Sets|Earrings|Bangles|Maang Tikka|Rings|Bridal|Other"}. Do not invent a price or any claim not visible.';
    const { text, usage } = await this.call([{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.base64 } }]);
    let d: Partial<ProductDraft> = {};
    try { d = JSON.parse(text); } catch { /* fall through to defaults */ }
    return {
      draft: { name: String(d.name ?? "New product").slice(0, 80), description: String(d.description ?? "").slice(0, 400), category: String(d.category ?? "Other").slice(0, 40) },
      usage,
    };
  }

  async classifyIntent(text: string) {
    const { text: out, usage } = await this.call([{ text: `Seller message (any Indian language): "${text.slice(0, 300)}". Respond only as JSON: {"intent": "add_product|change_design|price_stock|orders|help|call|other"}` }]);
    let intent = "other";
    try { intent = String((JSON.parse(out) as { intent?: string }).intent ?? "other"); } catch { /* keep default */ }
    return { intent, usage };
  }

  /** Only the seller's own voice note is sent: never buyer data. */
  async transcribe(audio: { mime: string; base64: string }) {
    const { text: out, usage } = await this.call([
      { text: 'Transcribe this short voice note exactly as spoken. The speaker may use Hindi, English, Hinglish or another Indian language. Keep numbers as digits. Respond only as JSON: {"text": "<transcript>"}' },
      { inline_data: { mime_type: audio.mime.split(";")[0], data: audio.base64 } },
    ]);
    let t: string | null = null;
    try { t = String((JSON.parse(out) as { text?: string }).text ?? "").trim() || null; } catch { /* no transcript */ }
    return { text: t, usage };
  }

  /** Only fixed bot sentences or the seller's own message text are sent: never buyer data. */
  async translate(text: string, target: string) {
    const { text: out, usage } = await this.call([{ text: `Translate into ${target}. Keep numbers, links, ₹ amounts, bullet points and line breaks unchanged. Respond only as JSON: {"text": "<translation>"}\n\n${text.slice(0, 1500)}` }]);
    let t: string | null = null;
    try { t = String((JSON.parse(out) as { text?: string }).text ?? "") || null; } catch { /* fall back to English */ }
    return { text: t, usage };
  }
}
