#!/usr/bin/env python3
"""Assert Effort Issues Sync uses the 600-minute GitHub-delay margin, the
15-minute auto-merge sweep sends no Crons check-in, and the hourly monitors
need three misses in a row before they turn red (AFC-626).

Run: python3 scripts/sentry-ci-report-margins_test.py
"""

from __future__ import annotations

import ast
import importlib.util
import os
import sys
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).with_name("sentry-ci-report.py")


def _assign_value(tree: ast.AST, name: str):
    for node in tree.body:
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if name in targets:
                return ast.literal_eval(node.value)
    raise AssertionError(f"{name} not found in {SCRIPT.name}")


def main() -> int:
    tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
    default = _assign_value(tree, "DEFAULT_CHECKIN_MARGIN_MINUTES")
    overrides = _assign_value(tree, "CRON_CHECKIN_MARGIN_MINUTES")
    schedules = _assign_value(tree, "CRON_SCHEDULES")

    assert default == 15, default
    expected = {
        "Vercel production catch-up": 75,
        "iOS TestFlight ship (GitHub-hosted macOS)": 100,
        "Effort Issues Sync": 600,
    }
    assert overrides == expected, overrides
    assert schedules.get("Vercel production catch-up") == "41 * * * *", schedules
    assert schedules.get("Effort Issues Sync") == "18 6 * * *", schedules
    assert schedules.get("iOS TestFlight ship (GitHub-hosted macOS)") == "22 * * * *", schedules
    print("MARGIN_PARSE_OK", overrides)
    print("EFFORT_SYNC_CRON_OK", schedules["Effort Issues Sync"])
    print("IOS_SHIP_CRON_OK", schedules["iOS TestFlight ship (GitHub-hosted macOS)"])

    # AFC-626: the 15-minute auto-merge sweep is deliberately unmonitored.
    assert "Auto-merge PRs" not in schedules, schedules
    thresholds = _assign_value(tree, "CRON_FAILURE_ISSUE_THRESHOLDS")
    assert thresholds == {
        "Vercel production catch-up": 3,
        "iOS TestFlight ship (GitHub-hosted macOS)": 3,
    }, thresholds
    _check_runtime_behaviour()
    print("AFC_626_OK", thresholds)
    return 0


def _load_reporter():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("sentry_ci_report", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_schedule(
    reporter, workflow_name: str, conclusion: str, event: str = "schedule", workflow_names=None
) -> list:
    """Run main() with send_envelope recorded.

    The stale-key drift guard is stubbed to report nothing, so these assertions
    do not depend on the live checkout's workflow names, unless workflow_names
    is given: then discover_workflow_names() returns it and the real drift
    guard runs against it.
    """
    sent = []
    env = {
        "SENTRY_FLEET_DSN": "https://abc123@o1.ingest.example.test/42",
        "WORKFLOW_NAME": workflow_name,
        "WORKFLOW_CONCLUSION": conclusion,
        "WORKFLOW_EVENT": event,
        "WORKFLOW_BRANCH": "main",
        "WORKFLOW_ACTOR": "agent",
        "WORKFLOW_RUN_URL": "https://example.test/run/1",
        "WORKFLOW_RUN_ID": "1",
    }
    if workflow_names is None:
        drift_patch = mock.patch.object(reporter, "find_cron_schedule_drift", return_value=[])
    else:
        drift_patch = mock.patch.object(
            reporter, "discover_workflow_names", return_value=set(workflow_names))
    with mock.patch.object(
        reporter, "send_envelope", lambda url, auth, item_type, payload: sent.append((item_type, payload))
    ), mock.patch.dict(os.environ, env, clear=False), drift_patch:
        assert reporter.main() == 0
    return sent


def _check_runtime_behaviour() -> None:
    reporter = _load_reporter()
    assert "Auto-merge PRs" in reporter.UNMONITORED_SCHEDULES

    # A scheduled sweep sends nothing: no check-in and no unmapped-schedule drift.
    sent = _run_schedule(reporter, "Auto-merge PRs", "success")
    assert sent == [], sent
    # A failed sweep still raises its conclusion-based error event, and only that.
    sent = _run_schedule(reporter, "Auto-merge PRs", "failure")
    assert [item_type for item_type, _ in sent] == ["event"], sent
    assert sent[0][1]["fingerprint"] == ["ci-failure", "dealdex", "Auto-merge PRs"], sent
    # An unlisted, unmapped schedule is still reported as config drift.
    sent = _run_schedule(reporter, "Some new scheduled job", "success")
    assert len(sent) == 1 and "unmapped-schedule" in sent[0][1]["fingerprint"], sent

    ship = reporter.monitor_config_for("iOS TestFlight ship (GitHub-hosted macOS)", "22 * * * *")
    assert ship["failure_issue_threshold"] == 3 and ship["recovery_threshold"] == 1, ship
    assert ship["checkin_margin"] == 100 and ship["max_runtime"] == 120, ship
    _, catch_up = reporter.build_cron_checkin_payload("Vercel production catch-up", "in_progress")
    assert catch_up["monitor_config"]["failure_issue_threshold"] == 3, catch_up
    assert catch_up["monitor_config"]["checkin_margin"] == 75, catch_up
    daily = reporter.monitor_config_for("Effort Issues Sync", "18 6 * * *")
    assert "failure_issue_threshold" not in daily and "recovery_threshold" not in daily, daily
    assert daily["checkin_margin"] == 600, daily
    # A configured threshold of 0 is sent, not dropped by a truthiness check.
    with mock.patch.dict(reporter._CRON_FAILURE_THRESHOLD_FOLDED, {"effort issues sync": 0}):
        zero = reporter.monitor_config_for("Effort Issues Sync", "18 6 * * *")
    assert zero["failure_issue_threshold"] == 0 and zero["recovery_threshold"] == 1, zero

    # An unmonitored name never builds a check-in, even if it is also mapped.
    with mock.patch.dict(reporter._CRON_SCHEDULES_FOLDED, {"auto-merge prs": "*/15 * * * *"}):
        assert reporter.build_cron_checkin_payload("Auto-merge PRs", "ok") is None
        sent = _run_schedule(reporter, "Auto-merge PRs", "success")
        assert sent == [], sent

    # A stale UNMONITORED_SCHEDULES entry is drift, like a stale CRON_SCHEDULES key,
    # matched case-insensitively.
    unmonitored = sorted(reporter.UNMONITORED_SCHEDULES)
    assert reporter.find_cron_schedule_drift(set(reporter.CRON_SCHEDULES)) == unmonitored
    live_folded = {name.casefold() for name in set(reporter.CRON_SCHEDULES) | set(unmonitored)}
    assert reporter.find_cron_schedule_drift(live_folded) == []
    assert reporter.find_cron_schedule_drift(reporter.discover_workflow_names()) == []
    sent = _run_schedule(
        reporter, "CI", "success", event="push", workflow_names=set(reporter.CRON_SCHEDULES)
    )
    assert [item_type for item_type, _ in sent] == ["event"], sent
    assert sent[0][1]["fingerprint"] == ["ci-report-config-drift", "dealdex", "stale-cron-key"], sent
    assert sent[0][1]["extra"]["stale_keys"] == unmonitored, sent

    # The --park-ios-ship heartbeat upserts the same config as a real ship run.
    sent = []
    with mock.patch.object(
        reporter, "send_envelope", lambda url, auth, item_type, payload: sent.append((item_type, payload))
    ), mock.patch.dict(os.environ, {"SENTRY_FLEET_DSN": "https://abc123@o1.ingest.example.test/42"}):
        assert reporter.send_parked_ios_ship_checkin() == 0
    assert sent[0][1]["monitor_config"] == ship, sent


if __name__ == "__main__":
    sys.exit(main())
