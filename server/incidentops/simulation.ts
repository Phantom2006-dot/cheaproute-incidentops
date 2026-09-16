import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SimulationStatus = "PASS" | "BLOCKED" | "FAIL";

export type SimulationResult = {
  status: SimulationStatus;
  compatibility: string;
  message?: string;
  result?: {
    run_id: string;
    plan_hash: string;
    approved: boolean;
    camera_observation: { captured: boolean; camera: string; width: number; height: number; scene_version: string };
    evaluation: {
      success: boolean;
      completion_ratio: number;
      placement_accuracy: number;
      collision_count: number;
      dropped_objects: number;
      retry_count: number;
      episode_time: number;
      seed: number;
      scene_version: string;
      plan_hash: string;
      execution_device: string;
    };
    events: Array<{ event_id: string; run_id: string; sequence: number; event_type: string; source: string; payload: unknown; correlation_id: string }>;
  };
};

const compatibility = "two-arm articulated surrogate; official SO-101 mesh not bundled";

export async function runVerifiedSimulation(approve: boolean): Promise<SimulationResult> {
  const root = process.cwd();
  const python = path.join(root, ".robotics-venv", "bin", "python");
  const script = path.join(root, "robotics", "mujoco_demo.py");
  try {
    await access(python);
    await access(script);
  } catch {
    return { status: "BLOCKED", compatibility, message: "MuJoCo runtime is not installed in this deployment. Run the documented local robotics setup or deploy the Docker robotics runtime." };
  }
  try {
    const { stdout } = await execFileAsync(python, [script, "--json", ...(approve ? [] : ["--no-approve"])], { cwd: root, timeout: 30_000, maxBuffer: 2_000_000 });
    const payload = JSON.parse(stdout) as SimulationResult;
    return payload.status ? payload : { status: "FAIL", compatibility, message: "MuJoCo returned an invalid result" };
  } catch (error) {
    const output = error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
    try {
      const payload = JSON.parse(output) as SimulationResult;
      return payload.status ? payload : { status: "FAIL", compatibility, message: "MuJoCo returned an invalid failure result" };
    } catch {
      return { status: "FAIL", compatibility, message: error instanceof Error ? error.message : "MuJoCo execution failed" };
    }
  }
}
