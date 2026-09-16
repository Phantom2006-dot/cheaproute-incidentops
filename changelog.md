## 2026-09-16 — Verified MuJoCo bimanual MVP

- **Commit:** `baaf595`
- **Reason:** Replace the fixed-success bimanual fixture with a real, constrained simulator path aligned to the online challenge.
- **Files:** `robotics/mujoco_demo.py`, `robotics/test_mujoco_demo.py`, `robotics-requirements.txt`, `server/incidentops/simulation.ts`, `server/routers.ts`, `client/src/pages/Home.tsx`, `Dockerfile`, `.dockerignore`, `.gitignore`, `README.md`, `docs/demo-runbook.md`, `docs/architecture.md`.
- **Implementation:** Added a seeded MuJoCo 3.13.0 scene with two articulated arm surrogates, table objects, overhead camera observation, semantic plan validation, explicit approval, bounded execution, evaluator metrics, and ordered trace events. Added a typed tRPC bridge and dashboard control. Added a Docker runtime for Render.
- **Tests:** `.robotics-venv/bin/python -m pytest robotics/test_mujoco_demo.py -q` — PASS, 5 passed. `pnpm check` — PASS. `pnpm test --run --exclude server/secrets.validation.test.ts` — PASS, 4 passed. `pnpm build` — PASS. Local `incidentOps.simulate` API smoke — PASS. Full provider suite — BLOCKED by Groq connection timeout. Docker build — BLOCKED because Docker is unavailable in the sandbox.
- **Evidence:** CLI run reported `completion_ratio=1.0`, `placement_accuracy=1.0`, `collision_count=0`, `dropped_objects=0`, `retry_count=0`, `execution_device=cpu`, and a captured overhead camera observation.
- **Known limitations:** The official SO-101 mesh is not bundled; compatibility is explicitly labeled as an articulated surrogate. OpenVINO/Core Ultra and live Speechmatics were not verified. Render must use Docker for the simulator endpoint to return `PASS`.

## Final release entry

- **Commit:** `20b7617`
- **Branch:** main
- **Push:** PASS — `github/main` verified at `20b7617`
- **Build:** PASS locally
- **Tests:** PASS locally
- **Demo URL:** https://cheaproute-incidentops.onrender.com
- **Provider/device:** deterministic planner, MuJoCo 3.13.0, CPU; no OpenVINO/Core Ultra claim
- **Known limitations:** Current Render service is Node-only, so the live simulator endpoint returns `BLOCKED` until the service runtime is switched to Docker. See README and architecture documentation.

## 2026-09-16 — Repair Speechmatics browser capture

- **Commit:** pending
- **Reason:** Browser voice did not reliably produce audio/transcripts.
- **Files:** `client/src/pages/Home.tsx`, `package.json`, `pnpm-lock.yaml`.
- **Implementation:** Replaced deprecated `ScriptProcessorNode` capture with Speechmatics' official `PCMRecorder` and AudioWorklet package, used the browser's actual `AudioContext.sampleRate`, selected the documented enhanced model, and surfaced realtime server errors in the UI.
- **Tests:** `pnpm check` — PASS. `pnpm test --run --exclude server/secrets.validation.test.ts` — PASS, 4 passed. `pnpm build` — PASS. Live Render status — BLOCKED because `speechmaticsConfigured` is currently false.
- **Known limitations:** A `SPEECHMATICS_API_KEY` must still be configured in the Render service environment before live microphone testing can succeed.
