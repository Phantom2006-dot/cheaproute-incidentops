# CheapRoute IncidentOps Demo Runbook

## Fast local judge path

From the repository root, install the web and robotics dependencies, then run the simulator CLI:

```bash
pnpm install
python3 -m venv .robotics-venv
.robotics-venv/bin/pip install -r robotics-requirements.txt
.robotics-venv/bin/python robotics/mujoco_demo.py --json
```

Expected status is `PASS`. The JSON must show `approved: true`, a captured `overhead` camera observation, both left and right arm assignments, `completion_ratio: 1.0`, `placement_accuracy: 1.0`, zero collisions, zero dropped objects, zero retries, and `execution_device: cpu`.

## Approval demonstration

Run:

```bash
.robotics-venv/bin/python robotics/mujoco_demo.py --json --no-approve
```

Expected status is `FAIL` with an explicit approval-required error. The service does not execute an unapproved plan.

## Web demonstration

1. Open the deployed dashboard.
2. Leave or enter: `Set the table for two.`
3. Run the evidence-grounded investigation.
4. Confirm the evidence IDs, severity, safe action proposals, and simulation plan.
5. Press **Approve and run MuJoCo episode**.
6. Show the run ID, event count, camera name, compatibility disclosure, and evaluation result.

If the deployment uses the Node-only Render service, the simulator panel must say `BLOCKED` because Python/MuJoCo is unavailable. Switch Render to the repository Dockerfile before presenting the simulator as live.

## Recovery

If the simulator fails, first run the CLI directly and inspect the JSON. If the output says MuJoCo is missing, recreate `.robotics-venv` and install `robotics-requirements.txt`. If the browser endpoint says `BLOCKED`, inspect the Render runtime; it must be Docker with the repository `Dockerfile`. If a plan is rejected, inspect the plan manifest and target names; all six objects and both arm names are required.
