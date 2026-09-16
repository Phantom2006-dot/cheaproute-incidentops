# Architecture

The application keeps the existing TypeScript tRPC service as the submission shell and adds a narrow robotics boundary.

1. **Input layer:** the dashboard accepts typed text and optionally a Speechmatics transcript. The normalized instruction is bounded to 2,000 characters.
2. **Planner boundary:** the deterministic planner creates a semantic `set_table_for_two` plan. It returns objects, target regions, arm ownership, bounded semantic actions, retry limits, and unknowns; it does not return raw joint commands or executable code.
3. **Validator:** the Python adapter rejects unsupported tasks, object manifests, targets, arm assignments, actions, and excessive action counts before approval.
4. **Approval:** the normalized plan receives a SHA-256 plan hash. Execution requires explicit approval, and the approval event records that hash.
5. **MuJoCo environment:** the headless scene contains a table, six named objects, two articulated arm surrogates, and an overhead camera. The scene is seeded and versioned.
6. **Executor:** semantic pick/place/verify actions are translated into bounded simulator state updates. Both arms are assigned actions.
7. **Evaluator:** success is calculated from placed-object state and simulator data, never copied from model text.
8. **Trace:** events are ordered, correlated by run ID, and include instruction, plan, approval, camera, action, failure, and evaluation stages.
9. **API/UI:** `incidentOps.simulate` exposes the verified result. It returns `PASS`, `BLOCKED`, or `FAIL` explicitly. The browser never claims a simulator run succeeded when the runtime is missing.

The bundled model is a compatible articulated surrogate rather than an official SO-101 model. OpenVINO, Intel Core Ultra execution, and physical robot control are outside the verified scope.
