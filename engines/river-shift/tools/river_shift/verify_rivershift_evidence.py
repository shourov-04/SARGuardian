#!/usr/bin/env python3
"""Verify a RiverShift reviewer evidence manifest without inferring accuracy."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from river_shift.verification import verify_evidence_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = verify_evidence_manifest(args.report, args.manifest)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print("RIVERSHIFT_EVIDENCE_VERIFICATION=PASS")
        print(f"RIVERSHIFT_EVIDENCE_REPORT={args.output}")
        return 0
    except Exception as exc:
        print(f"RIVERSHIFT_EVIDENCE_VERIFICATION=FAIL reason={type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
