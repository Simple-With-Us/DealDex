#!/usr/bin/env python3
"""Assert Effort Issues Sync uses the 600-minute GitHub-delay margin.

Run: python3 scripts/sentry-ci-report-margins_test.py
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

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
        "iOS TestFlight ship (GitHub-hosted macOS)": 100,
        "Effort Issues Sync": 600,
    }
    assert overrides == expected, overrides
    assert schedules.get("Effort Issues Sync") == "18 6 * * *", schedules
    assert schedules.get("iOS TestFlight ship (GitHub-hosted macOS)") == "22 * * * *", schedules
    print("MARGIN_PARSE_OK", overrides)
    print("EFFORT_SYNC_CRON_OK", schedules["Effort Issues Sync"])
    print("IOS_SHIP_CRON_OK", schedules["iOS TestFlight ship (GitHub-hosted macOS)"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
