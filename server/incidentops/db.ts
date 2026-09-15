import { Pool } from "pg";
import type { AnalysisResult } from "./core";

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;

function getPool() {
  if (!process.env.INCIDENTOPS_DATABASE_URL) return undefined;
  pool ??= new Pool({
    connectionString: process.env.INCIDENTOPS_DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 15_000,
    ssl: process.env.INCIDENTOPS_DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  });
  return pool;
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const database = getPool();
  if (!database) return;
  schemaReady = database.query(`
    CREATE TABLE IF NOT EXISTS incident_cases (
      id TEXT PRIMARY KEY,
      principal_id TEXT NOT NULL,
      service TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      transcript TEXT NOT NULL,
      source TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_incident_cases_principal_created ON incident_cases(principal_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS incident_runs (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL REFERENCES incident_cases(id) ON DELETE CASCADE,
      principal_id TEXT NOT NULL,
      route_provider TEXT NOT NULL,
      route_model TEXT NOT NULL,
      route_tier TEXT NOT NULL,
      route_reason TEXT NOT NULL,
      estimated_cost_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
      latency_ms NUMERIC(12,3),
      confidence NUMERIC(5,4),
      diagnosis JSONB NOT NULL DEFAULT '{}'::jsonb,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS incident_actions (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL REFERENCES incident_cases(id) ON DELETE CASCADE,
      principal_id TEXT NOT NULL,
      action_key TEXT NOT NULL,
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      risk TEXT NOT NULL,
      rollback_plan TEXT NOT NULL,
      approval_required BOOLEAN NOT NULL DEFAULT TRUE,
      state TEXT NOT NULL DEFAULT 'proposed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS incident_simulations (
      id TEXT PRIMARY KEY,
      incident_id TEXT REFERENCES incident_cases(id) ON DELETE SET NULL,
      principal_id TEXT NOT NULL,
      task TEXT NOT NULL,
      plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      placed_objects JSONB NOT NULL DEFAULT '[]'::jsonb,
      success BOOLEAN NOT NULL,
      uncertainty JSONB NOT NULL DEFAULT '[]'::jsonb,
      engine TEXT NOT NULL DEFAULT 'deterministic-demo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS incident_events (
      id BIGSERIAL PRIMARY KEY,
      incident_id TEXT,
      principal_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `).then(() => undefined);
  try {
    await schemaReady;
  } catch (error) {
    schemaReady = undefined;
    throw error;
  }
}

export async function persistAnalysis(principalId: string, result: AnalysisResult) {
  const database = getPool();
  if (!database) return { persisted: false, mode: "local_demo" as const };
  await ensureSchema();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO incident_cases (id, principal_id, service, title, severity, status, transcript, source, trace_id)
       VALUES ($1,$2,$3,$4,$5,'investigating',$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET transcript = EXCLUDED.transcript, severity = EXCLUDED.severity`,
      [result.incident.incidentId, principalId, result.incident.service, result.incident.title, result.incident.severity, result.incident.transcript, result.incident.source, result.traceId],
    );
    await client.query(
      `INSERT INTO incident_runs (id, incident_id, principal_id, route_provider, route_model, route_tier, route_reason, estimated_cost_usd, latency_ms, confidence, diagnosis, warnings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [`run-${result.traceId}`, result.incident.incidentId, principalId, result.route.provider, result.route.model, result.route.tier, result.route.reason, result.route.estimatedCostUsd, result.telemetry.latencyMs, result.diagnosis.confidence, JSON.stringify(result.diagnosis), JSON.stringify(result.warnings)],
    );
    for (const action of result.actions) {
      await client.query(
        `INSERT INTO incident_actions (id, incident_id, principal_id, action_key, title, rationale, risk, rollback_plan, approval_required)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [action.actionId, result.incident.incidentId, principalId, action.actionId, action.title, action.rationale, action.risk, action.rollback, action.approvalRequired],
      );
    }
    await client.query(
      `INSERT INTO incident_simulations (id, incident_id, principal_id, task, plan, placed_objects, success, uncertainty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [`sim-${result.traceId}`, result.incident.incidentId, principalId, result.simulation.task, JSON.stringify({ steps: result.simulation.steps, leftArm: result.simulation.leftArm, rightArm: result.simulation.rightArm }), JSON.stringify(result.simulation.placedObjects), result.simulation.success, JSON.stringify(result.simulation.uncertainty)],
    );
    await client.query(
      `INSERT INTO incident_events (incident_id, principal_id, event_type, event_data) VALUES ($1,$2,$3,$4)`,
      [result.incident.incidentId, principalId, "analysis_completed", JSON.stringify({ traceId: result.traceId, evidenceCount: result.evidence.length, liveModel: result.telemetry.liveModel })],
    );
    await client.query("COMMIT");
    return { persisted: true, mode: "neon" as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeIncidentDb() {
  await pool?.end();
  pool = undefined;
  schemaReady = undefined;
}
