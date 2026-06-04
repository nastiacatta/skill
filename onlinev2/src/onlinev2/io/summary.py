"""Standardised summary.json writer for experiment outputs."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_summary(path: str | Path, payload: dict[str, Any]) -> None:
    """Write a normalised summary.json for one experiment run."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")
