# CheapRoute IncidentOps

CheapRoute IncidentOps is a voice-first incident investigation demo with a verified bimanual robotics simulation path for the online AI infrastructure challenge. The primary task is **“Set the table for two.”** The system accepts natural-language instructions, creates a strict semantic plan, requires explicit approval, runs a seeded MuJoCo episode, captures a camera observation, executes bounded semantic actions with both arms, evaluates simulator state, and emits a correlated event trace.

## Verified capabilities

- Real MuJoCo 3.13.0 headless episode.
- Two articulated arm surrogates with left/right ownership.
- Table scene, plates, cups, and forks with named target regions.
- Natural-language-to-plan boundary with deterministic offline plan fixture.
- Strict validation for task, objects, targets, actions, arm ownership, and action limits.
- Explicit approval gate tied to the normalized plan hash.
- Camera observation metadata from the MuJoCo scene.
- State-based completion, placement accuracy, collision count, dropped objects, retries, episode time, seed, scene version, plan hash, and execution device.
- Ordered run events with unique event IDs, run IDs, sequence numbers, and correlation IDs.
- Existing optional Speechmatics and Groq adapters.
- Existing deterministic offline mode that does not require external credentials.

## Compatibility and limitations

The bundled scene is a **two-arm articulated surrogate**. The official SO-101 mesh and calibrated robot model are not bundled, so the application reports `SO-101 compatibility: approximation` and does not claim official hardware fidelity. OpenVINO and Intel Core Ultra execution were not verified in this environment. Speechmatics live transcription is optional and must be tested separately when its server secret is available. The simulator uses deterministic semantic motion primitives for the constrained seeded scene; it is not a learned VLA policy and does not control physical robots.

## Local setup

The web application uses Node 22 and pnpm. The simulator uses Python 3.11+ and MuJoCo 3.13.0.

```bash
pnpm install
pnpm check
pnpm test --run
pnpm build

python3 -m venv .robotics-venv
.robotics-venv/bin/pip install -r robotics-requirements.txt
.robotics-venv/bin/python robotics/mujoco_demo.py --json
.robotics-venv/bin/python -m pytest robotics/test_mujoco_demo.py -q
```

Run the web app with `pnpm dev`. The dashboard's **Approve and run MuJoCo episode** button calls the typed `incidentOps.simulate` procedure. If the robotics runtime is absent, the endpoint returns `BLOCKED`; it never labels an unavailable simulator as successful.

## Render deployment

Use the Docker runtime, not the previous Node-only runtime, to enable MuJoCo:

- Repository: `https://github.com/Phantom2006-dot/cheaproute-incidentops`
- Branch: `main`
- Runtime: Docker
- Dockerfile: `./Dockerfile`
- Docker context: `.`
- Plan: Free for the constrained demo
- Port: Render supplies `PORT`; the application listens on it through the existing server entrypoint.

The Docker image installs Node dependencies, Python, MuJoCo 3.13.0, headless graphics libraries, and the production build. Keep all secrets in Render's environment settings; never commit `.env` files.

Optional variables are `GROQ_API_KEY`, `SPEECHMATICS_API_KEY`, `INCIDENTOPS_DATABASE_URL`, and the existing authentication variables used by the WebDev template. The offline simulation and text analysis do not require them.

## Test instruction

Use the instruction **“Set the table for two.”** Confirm the plan uses both arms, inspect the plan hash, approve execution, verify the `camera_observed` event, and check the final evaluation. A successful seeded run reports `completion_ratio: 1.0`, `placement_accuracy: 1.0`, `collision_count: 0`, `dropped_objects: 0`, `retry_count: 0`, and `execution_device: cpu`.

## Safety boundary

The incident actions are proposals only. No production-changing action is executed by the application. Evidence in the demo is labeled as fixture evidence, not live observability. No official hackathon submission is made by this repository.
