"""Golden-value snapshot helpers for preservation checks.

Each snapshot file lives under ``onlinev2/tests/audit/snapshots/`` and is
named ``{name}.{seed}.json``.  The name encodes the fully-qualified
source site (e.g. ``core.skill.loss_to_skill``) and the seed selects
one member of ``AUDIT_SEEDS``.

``capture(name, seed, fn, *args, **kwargs)`` runs the function on current
mainline code, serialises the numpy result, and writes the file — but
only if it does not already exist.  This guarantees the snapshot is
captured exactly once per (name, seed).

``assert_matches(name, seed, value, atol)`` loads the file and checks
bit-identity to ``atol`` (default ``1e-12``).

Task 1.5 provides these helpers and seeds ``MANIFEST.md``; it does NOT
capture snapshots.  Each fix task (2–6) captures snapshots for the
functions it is about to touch immediately before applying the fix.
"""
from __future__ import annotations

import json
import os
from typing import Any, Callable

import numpy as np

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_DIR = os.path.join(_THIS_DIR, "snapshots")


def _snapshot_path(name: str, seed: int) -> str:
    return os.path.join(SNAPSHOT_DIR, f"{name}.{int(seed)}.json")


def _to_json(value: Any) -> Any:
    """Serialise numpy arrays / scalars into JSON-compatible primitives."""
    if isinstance(value, np.ndarray):
        return {"__ndarray__": True, "shape": list(value.shape), "dtype": str(value.dtype), "data": value.ravel().tolist()}
    if isinstance(value, (np.floating, np.integer)):
        return float(value)
    if isinstance(value, dict):
        return {str(k): _to_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_json(v) for v in value]
    if isinstance(value, (bool, int, float, str)) or value is None:
        return value
    raise TypeError(f"Cannot serialise {type(value).__name__} for snapshot")


def _from_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        if obj.get("__ndarray__"):
            arr = np.asarray(obj["data"], dtype=obj.get("dtype", "float64"))
            return arr.reshape(obj["shape"])
        return {k: _from_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_from_json(v) for v in obj]
    return obj


def capture(name: str, seed: int, fn: Callable, *args: Any, **kwargs: Any) -> Any:
    """Run ``fn(*args, **kwargs)`` and write its serialised result to disk.

    If the snapshot already exists, returns the existing value (skipping
    re-capture).  Otherwise writes it and returns the freshly-computed
    value.
    """
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    path = _snapshot_path(name, seed)
    if os.path.exists(path):
        with open(path, "r") as f:
            return _from_json(json.load(f))
    value = fn(*args, **kwargs)
    with open(path, "w") as f:
        json.dump(_to_json(value), f, indent=2, sort_keys=True)
    return value


def load(name: str, seed: int) -> Any:
    """Load and deserialise a previously-captured snapshot."""
    path = _snapshot_path(name, seed)
    with open(path, "r") as f:
        return _from_json(json.load(f))


def assert_matches(name: str, seed: int, value: Any, atol: float = 1e-12) -> None:
    """Assert bit-identity between ``value`` and the on-disk snapshot."""
    expected = load(name, seed)
    _assert_close(expected, value, atol, path=f"{name}.{seed}")


def _assert_close(expected: Any, actual: Any, atol: float, path: str) -> None:
    if isinstance(expected, np.ndarray) or isinstance(actual, np.ndarray):
        np.testing.assert_allclose(
            np.asarray(actual, dtype=np.float64),
            np.asarray(expected, dtype=np.float64),
            atol=atol,
            rtol=0,
            err_msg=f"snapshot mismatch at {path}",
        )
        return
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"type mismatch at {path}"
        assert set(expected.keys()) == set(actual.keys()), f"key mismatch at {path}"
        for k in expected:
            _assert_close(expected[k], actual[k], atol, f"{path}.{k}")
        return
    if isinstance(expected, list):
        assert isinstance(actual, (list, tuple)), f"type mismatch at {path}"
        assert len(expected) == len(actual), f"length mismatch at {path}"
        for i, (e, a) in enumerate(zip(expected, actual)):
            _assert_close(e, a, atol, f"{path}[{i}]")
        return
    if isinstance(expected, float) or isinstance(actual, float):
        np.testing.assert_allclose(float(actual), float(expected), atol=atol, rtol=0,
                                   err_msg=f"snapshot mismatch at {path}")
        return
    assert expected == actual, f"snapshot mismatch at {path}: {expected} != {actual}"
