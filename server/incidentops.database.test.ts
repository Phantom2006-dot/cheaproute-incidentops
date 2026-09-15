import { afterEach, describe, expect, it } from "vitest";
import { Client } from "pg";

let client: Client | undefined;

afterEach(async () => {
  if (client) {
    await client.end().catch(() => undefined);
    client = undefined;
  }
});

describe("IncidentOps Neon database", () => {
  it("connects and can execute a read-only SELECT 1", async () => {
    const connectionString = process.env.INCIDENTOPS_DATABASE_URL ?? "";
    expect(connectionString, "INCIDENTOPS_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);
    client = new Client({
      connectionString,
      connectionTimeoutMillis: 15_000,
      ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    const result = await client.query<{ value: number }>("SELECT 1 AS value");
    expect(result.rows[0]?.value).toBe(1);
  }, 20_000);
});
