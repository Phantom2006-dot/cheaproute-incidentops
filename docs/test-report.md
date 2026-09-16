# Test Report

| Area | Command or check | Result | Evidence |
|---|---|---|---|
| TypeScript | `pnpm check` | PASS | No TypeScript errors |
| Existing web tests | `pnpm test --run --exclude server/secrets.validation.test.ts` | PASS | 3 files, 4 tests passed |
| MuJoCo tests | `.robotics-venv/bin/python -m pytest robotics/test_mujoco_demo.py -q` | PASS | 5 tests passed |
| Production build | `pnpm build` | PASS | Vite and esbuild completed |
| Local simulation API | POST `incidentOps.simulate` | PASS | Returned `status: PASS` |
| CLI episode | `.robotics-venv/bin/python robotics/mujoco_demo.py --json` | PASS | 100% completion, camera captured, zero collisions |
| Live provider validation | `server/secrets.validation.test.ts` | BLOCKED | Groq endpoint connection timed out; Speechmatics test passed |
| Docker image | `docker build -t cheaproute-incidentops:test .` | BLOCKED | Docker CLI is unavailable in this sandbox |
| Intel/OpenVINO | Provider/device verification | NOT RUN | No Intel Core Ultra or OpenVINO runtime available |
| Live Speechmatics browser session | Browser microphone test | NOT RUN | Credential/browser session not available in this validation pass |

The offline path is the judging-safe path. The Dockerfile is present for Render, but its build must be verified by Render after switching the service runtime from Node to Docker.
