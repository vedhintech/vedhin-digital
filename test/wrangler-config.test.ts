import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const toml = readFileSync("wrangler.toml", "utf8");
const [prod, preview] = toml.split("[previews.vars]") as [string, string];

describe("wrangler.toml", () => {
  it("has a previews block that never uses the production database", () => {
    expect(toml).toContain("[previews.vars]");
    const prodId = prod.match(/database_id\s*=\s*"([^"]+)"/)![1];
    const prevId = preview.match(/database_id\s*=\s*"([^"]+)"/)![1];
    expect(prevId).not.toBe(prodId);
    expect(preview).toContain('database_name = "vedhin-db-preview"');
  });
  it("previews run as APP_ENV=preview and have no cron triggers or secrets", () => {
    expect(preview).toContain('APP_ENV = "preview"');
    expect(preview).not.toMatch(/crons|routes|SESSION_SECRET|ADMIN_PASSWORD|API_KEY|TOKEN/);
  });
  it("production keeps its own settings", () => {
    expect(prod).toContain('APP_ENV = "production"');
    expect(prod).toContain('crons = ["0 * * * *"]');
  });
});
