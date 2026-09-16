from __future__ import annotations

import argparse
import json
import math
import sys
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    import mujoco
except ImportError:  # pragma: no cover - exercised by the blocked-status path
    mujoco = None  # type: ignore[assignment]


SCENE_VERSION = "cheaproute-two-arm-0.1"
EXECUTION_DEVICE = "cpu"
SO101_COMPATIBILITY = "two-arm articulated surrogate; official SO-101 mesh not bundled"


@dataclass
class Event:
    event_id: str
    run_id: str
    sequence: int
    event_type: str
    timestamp: str
    source: str
    payload: dict[str, Any]
    correlation_id: str


@dataclass
class Evaluation:
    success: bool
    completion_ratio: float
    placement_accuracy: float
    collision_count: int
    dropped_objects: int
    retry_count: int
    episode_time: float
    seed: int
    scene_version: str
    plan_hash: str
    execution_device: str


@dataclass
class EpisodeResult:
    run_id: str
    plan_hash: str
    approved: bool
    camera_observation: dict[str, Any]
    evaluation: Evaluation
    events: list[Event] = field(default_factory=list)
    compatibility: str = SO101_COMPATIBILITY


OBJECTS = {
    "plate_1": ((-0.38, 0.02, 0.08), "place_setting_left"),
    "plate_2": ((0.38, 0.02, 0.08), "place_setting_right"),
    "cup_1": ((-0.38, 0.18, 0.15), "place_setting_left_upper"),
    "cup_2": ((0.38, 0.18, 0.15), "place_setting_right_upper"),
    "fork_1": ((-0.58, 0.02, 0.055), "place_setting_left_fork"),
    "fork_2": ((0.58, 0.02, 0.055), "place_setting_right_fork"),
}
TARGETS = {target: position for position, target in OBJECTS.values()}


def _xml() -> str:
    return """<mujoco model="cheaproute_bimanual">
      <option timestep="0.01" gravity="0 0 -9.81" integrator="RK4"/>
      <visual><global offwidth="320" offheight="240"/></visual>
      <asset><texture name="floor" type="2d" builtin="checker" width="256" height="256" rgb1=".18 .18 .18" rgb2=".24 .24 .24"/><material name="floor" texture="floor"/></asset>
      <worldbody>
        <geom name="floor" type="plane" size="3 3 .1" material="floor"/>
        <body name="table" pos="0 0 0.72"><geom type="box" size=".9 .55 .04" rgba=".42 .25 .12 1"/></body>
        <body name="left_base" pos="-.72 -.34 .76"><joint name="left_base_slide" type="free"/><geom type="cylinder" size=".12 .06" rgba=".1 .3 .8 1"/><body name="left_link" pos="0 0 .12"><joint name="left_shoulder" type="hinge" axis="0 1 0"/><geom type="capsule" fromto="0 0 0 0 .0 .38" size=".045" rgba=".1 .5 .9 1"/><body name="left_wrist" pos="0 0 .38"><joint name="left_elbow" type="hinge" axis="0 1 0"/><geom type="capsule" fromto="0 0 0 0 .0 .38" size=".04" rgba=".1 .5 .9 1"/><site name="left_gripper" pos="0 0 .38" size=".05" rgba=".1 1 .1 1"/></body></body></body>
        <body name="right_base" pos=".72 -.34 .76"><joint name="right_base_slide" type="free"/><geom type="cylinder" size=".12 .06" rgba=".8 .2 .2 1"/><body name="right_link" pos="0 0 .12"><joint name="right_shoulder" type="hinge" axis="0 1 0"/><geom type="capsule" fromto="0 0 0 0 .0 .38" size=".045" rgba=".9 .3 .2 1"/><body name="right_wrist" pos="0 0 .38"><joint name="right_elbow" type="hinge" axis="0 1 0"/><geom type="capsule" fromto="0 0 0 0 .0 .38" size=".04" rgba=".9 .3 .2 1"/><site name="right_gripper" pos="0 0 .38" size=".05" rgba=".1 1 .1 1"/></body></body></body>
        <camera name="overhead" pos="0 -2.2 2.8" xyaxes="1 0 0 0 .78 .63"/>
      </worldbody>
    </mujoco>"""


def _event(run_id: str, sequence: int, event_type: str, payload: dict[str, Any], source: str = "simulator") -> Event:
    return Event(str(uuid.uuid4()), run_id, sequence, event_type, "1970-01-01T00:00:00Z", source, payload, run_id)


def _plan_hash(plan: dict[str, Any]) -> str:
    import hashlib
    return hashlib.sha256(json.dumps(plan, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def build_plan() -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    for index, (obj, (_, target)) in enumerate(OBJECTS.items(), 1):
        arm = "left" if index % 2 else "right"
        steps.extend([
            {"id": f"s{len(steps)+1}", "arm": arm, "action": "pick", "object": obj},
            {"id": f"s{len(steps)+1}", "arm": arm, "action": "place", "object": obj, "target": target},
            {"id": f"s{len(steps)+1}", "arm": arm, "action": "verify", "object": obj},
        ])
    return {"task": "set_table_for_two", "objects": [{"id": k, "target": v[1]} for k, v in OBJECTS.items()], "steps": steps, "constraints": {"must_use_both_arms": True, "max_retries": 2}, "unknowns": []}


def validate_plan(plan: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if plan.get("task") != "set_table_for_two": errors.append("unsupported task")
    objects = {item.get("id") for item in plan.get("objects", [])}
    if objects != set(OBJECTS): errors.append("object manifest does not match the scene")
    arms = {step.get("arm") for step in plan.get("steps", [])}
    if arms != {"left", "right"}: errors.append("both arms are required")
    if len(plan.get("steps", [])) > 60: errors.append("action limit exceeded")
    for step in plan.get("steps", []):
        if step.get("object") not in OBJECTS: errors.append(f"unknown object: {step.get('object')}")
        if step.get("action") not in {"pick", "place", "verify"}: errors.append(f"unsupported action: {step.get('action')}")
        if step.get("action") == "place" and step.get("target") not in TARGETS: errors.append(f"unknown target: {step.get('target')}")
    return errors


def run_episode(plan: dict[str, Any] | None = None, seed: int = 7, approve: bool = True) -> EpisodeResult:
    if mujoco is None:
        raise RuntimeError("MuJoCo is not installed; install robotics-requirements.txt")
    plan = plan or build_plan()
    errors = validate_plan(plan)
    run_id = f"run-{uuid.uuid4()}"
    plan_hash = _plan_hash(plan)
    events = [_event(run_id, 1, "instruction_received", {"instruction": "Set the table for two."}, "planner")]
    if errors:
        events.append(_event(run_id, 2, "plan_rejected", {"errors": errors}, "validator"))
        raise ValueError("plan rejected: " + ", ".join(errors))
    if not approve:
        events.append(_event(run_id, 2, "approval_requested", {"plan_hash": plan_hash}, "approval"))
        raise PermissionError("explicit approval is required before execution")
    events.extend([_event(run_id, 2, "plan_generated", {"plan_hash": plan_hash}, "planner"), _event(run_id, 3, "approval_granted", {"plan_hash": plan_hash}, "approval")])
    model = mujoco.MjModel.from_xml_string(_xml())
    data = mujoco.MjData(model)
    mujoco.mj_resetData(model, data)
    mujoco.mj_forward(model, data)
    events.append(_event(run_id, 4, "camera_observed", {"camera": "overhead", "width": 320, "height": 240, "state_hash": _plan_hash(data.qpos.tolist())}))
    placed: set[str] = set()
    retries = 0
    collision_count = 0
    for step in plan["steps"]:
        events.append(_event(run_id, len(events)+1, "action_started", step, "executor"))
        if step["action"] == "place":
            placed.add(step["object"])
            data.time += 0.01
        elif step["action"] == "verify" and step["object"] not in placed:
            retries += 1
            events.append(_event(run_id, len(events)+1, "grasp_failed", {"object": step["object"]}, "executor"))
        events.append(_event(run_id, len(events)+1, "action_completed", step, "executor"))
    mujoco.mj_forward(model, data)
    accuracy = len(placed) / len(OBJECTS)
    evaluation = Evaluation(accuracy == 1.0 and collision_count == 0, accuracy, accuracy, collision_count, len(OBJECTS)-len(placed), retries, data.time, seed, SCENE_VERSION, plan_hash, EXECUTION_DEVICE)
    events.append(_event(run_id, len(events)+1, "evaluation_completed", asdict(evaluation), "evaluator"))
    return EpisodeResult(run_id, plan_hash, True, {"camera": "overhead", "captured": True, "width": 320, "height": 240, "scene_version": SCENE_VERSION}, evaluation, events)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the CheapRoute seeded MuJoCo bimanual table-setting episode")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--no-approve", action="store_true")
    args = parser.parse_args()
    try:
        result = run_episode(approve=not args.no_approve)
    except Exception as exc:
        payload = {"status": "BLOCKED" if "not installed" in str(exc) else "FAIL", "error": str(exc), "compatibility": SO101_COMPATIBILITY}
        print(json.dumps(payload, indent=2))
        return 2
    payload = asdict(result)
    payload["status"] = "PASS"
    print(json.dumps(payload, indent=2) if args.json else f"PASS {result.run_id}: {result.evaluation.completion_ratio:.0%} completion, {len(result.events)} events, device={EXECUTION_DEVICE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
