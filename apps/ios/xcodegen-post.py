#!/usr/bin/env python3
"""Bump XcodeGen output to Xcode 26.3 document format.

XcodeGen 2.46 still emits objectVersion 77 (UI: Xcode 16.0-compatible) even when
xcodeVersion is 26.3. Congress.Trade and Usage-Monitor run the same rewrite.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent
PBX = ROOT / "DealDex.xcodeproj" / "project.pbxproj"
SCHEME = ROOT / "DealDex.xcodeproj" / "xcshareddata" / "xcschemes" / "DealDex.xcscheme"


def main() -> None:
    t = PBX.read_text()
    t = t.replace("objectVersion = 77;", "objectVersion = 100;", 1)
    t = t.replace("preferredProjectObjectVersion = 77;", "preferredProjectObjectVersion = 100;", 1)
    for old in ("1430", "1600", "2600", "2610", "2620"):
        t = t.replace(f"LastUpgradeCheck = {old};", "LastUpgradeCheck = 2630;")
    PBX.write_text(t)
    if SCHEME.is_file():
        s = SCHEME.read_text()
        for old in ("1430", "1600", "2600", "2610", "2620"):
            s = s.replace(f'LastUpgradeVersion = "{old}"', 'LastUpgradeVersion = "2630"')
        SCHEME.write_text(s)


if __name__ == "__main__":
    main()
