import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MOD = ROOT / "robotics" / "mujoco_demo.py"

sys.path.insert(0, str(ROOT))
from robotics.mujoco_demo import build_plan, run_episode, validate_plan  # noqa: E402


def test_plan_uses_both_arms_and_validates():
    plan = build_plan()
    assert validate_plan(plan) == []
    assert {step["arm"] for step in plan["steps"]} == {"left", "right"}


def test_invalid_object_is_rejected():
    plan = build_plan()
    plan["objects"][0]["id"] = "unknown"
    assert any("object manifest" in error for error in validate_plan(plan))


def test_approval_is_required():
    pytest.importorskip("mujoco")
    with pytest.raises(PermissionError):
        run_episode(approve=False)


def test_real_episode_has_camera_and_state_evaluation():
    pytest.importorskip("mujoco")
    result = run_episode(seed=7, approve=True)
    assert result.evaluation.success is True
    assert result.evaluation.completion_ratio == 1.0
    assert result.camera_observation["captured"] is True
    assert result.evaluation.execution_device == "cpu"
    assert {event.event_type for event in result.events} >= {
        "instruction_received", "plan_generated", "approval_granted",
        "camera_observed", "action_started", "action_completed", "evaluation_completed",
    }


def test_cli_json_smoke():
    env = os.environ.copy()
    result = subprocess.run([sys.executable, str(MOD), "--json"], cwd=ROOT, capture_output=True, text=True, env=env)
    assert result.returncode == 0, result.stdout + result.stderr
    payload = json.loads(result.stdout)
    assert payload["status"] == "PASS"
    assert payload["evaluation"]["success"] is True
