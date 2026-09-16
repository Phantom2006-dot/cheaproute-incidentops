## 2026-09-16 — Verified MuJoCo bimanual MVP

- **Commit:** pending
- **Reason:** Replace the fixed-success bimanual fixture with a real, constrained simulator path aligned to the online challenge.
- **Files:** `robotics/mujoco_demo.py`, `robotics/test_mujoco_demo.py`, `robotics-requirements.txt`, `server/incidentops/simulation.ts`, `server/routers.ts`, `client/src/pages/Home.tsx`, `Dockerfile`, `.dockerignore`, `.gitignore`, `README.md`, `docs/demo-runbook.md`, `docs/architecture.md`.
- **Implementation:** Added a seeded MuJoCo 3.13.0 scene with two articulated arm surrogates, table objects, overhead camera observation, semantic plan validation, explicit approval, bounded execution, evaluator metrics, and ordered trace events. Added a typed tRPC bridge and dashboard control. Added a Docker runtime for Render.
- **Tests:** `.robotics-venv/bin/python -m pytest robotics/test_mujoco_demo.py -q` — PASS, 5 passed. `pnpm check` — PASS. `pnpm test --run --exclude server/secrets.validation.test.ts` — PASS, 4 passed. `pnpm build` — PASS. Local `incidentOps.simulate` API smoke — PASS. Full provider suite — BLOCKED by Groq connection timeout. Docker build — BLOCKED because Docker is unavailable in the sandbox.
- **Evidence:** CLI run reported `completion_ratio=1.0`, `placement_accuracy=1.0`, `collision_count=0`, `dropped_objects=0`, `retry_count=0`, `execution_device=cpu`, and a captured overhead camera observation.
- **Known limitations:** The official SO-101 mesh is not bundled; compatibility is explicitly labeled as an articulated surrogate. OpenVINO/Core Ultra and live Speechmatics were not verified. Render must use Docker for the simulator endpoint to return `PASS`.

## Final release entry

- **Commit:** pending
- **Branch:** main
- **Push:** pending
- **Build:** PASS locally
- **Tests:** PASS locally
- **Demo URL:** https://cheaproute-incidentops.onrender.com
- **Provider/device:** deterministic planner, MuJoCo 3.13.0, CPU; no OpenVINO/Core Ultra claim
- **Known limitations:** See README and architecture documentation.
