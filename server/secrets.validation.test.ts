import { describe, expect, it } from "vitest";

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

describe("project secrets", () => {
  it("has a valid encryption key format", () => {
    const key = process.env.ENCRYPTION_KEY ?? "";
    expect(key, "ENCRYPTION_KEY must be configured").toMatch(/^[0-9a-fA-F]{64}$/);
  });

  it("authenticates the Groq key with the models endpoint", async () => {
    const key = process.env.GROQ_API_KEY ?? "";
    expect(key, "GROQ_API_KEY must be configured").not.toBe("");
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await readJson(response);
    expect(response.ok, `Groq authentication failed: ${JSON.stringify(body)}`).toBe(true);
  }, 20_000);

  it("authenticates Speechmatics by creating a short-lived realtime key", async () => {
    const key = process.env.SPEECHMATICS_API_KEY ?? "";
    expect(key, "SPEECHMATICS_API_KEY must be configured").not.toBe("");
    const response = await fetch("https://mp.speechmatics.com/v1/api_keys?type=rt", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 60 }),
    });
    const body = (await readJson(response)) as { key_value?: unknown };
    expect(response.ok, `Speechmatics authentication failed: ${JSON.stringify(body)}`).toBe(true);
    expect(typeof body.key_value).toBe("string");
  }, 20_000);
});
