"""Confine ``onlinev2.mechanism.michael_port`` to its intended consumers.

The general mechanism code must not import ``michael_port``; it is a
self-contained reimplementation of the Vitali & Pinson (2025) OGD
aggregator (arXiv:2510.13385) used only as an external reference
baseline.

This test walks ``onlinev2/src/onlinev2/`` excluding the port itself
and asserts no ``.py`` file imports ``michael_port`` in any form
except the explicitly whitelisted consumers below.
"""
from __future__ import annotations

import os
import re

import pytest

pytestmark = [pytest.mark.audit]

# --- Locate the package source root ---------------------------------------

_THIS_FILE = os.path.abspath(__file__)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(_THIS_FILE), "..", "..", ".."))
_SRC_ROOT = os.path.join(
    _REPO_ROOT, "onlinev2", "src", "onlinev2"
)

# We allow michael_port.py itself to reference its own module name, and
# the real-data runner's michael_ogd baseline row — this is the single
# legitimate consumer of the port, explicitly whitelisted here so the
# confinement is visible to anyone reading the test.
_ALLOWED_FILES = {
    os.path.join(_SRC_ROOT, "mechanism", "michael_port.py"),
    os.path.join(_SRC_ROOT, "real_data", "runner.py"),
}

# Any syntactic import of michael_port, independent of indentation or
# whitespace, is flagged.
_IMPORT_REGEX = re.compile(
    r"^\s*(?:"
    r"import\s+onlinev2\.mechanism\.michael_port"
    r"|"
    r"from\s+onlinev2\.mechanism\.michael_port\s+import"
    r"|"
    r"from\s+onlinev2\.mechanism\s+import\s+[^#\n]*\bmichael_port\b"
    r")",
    re.MULTILINE,
)


def _walk_py_files(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip the usual compile caches.
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for name in filenames:
            if name.endswith(".py"):
                yield os.path.join(dirpath, name)


def test_michael_port_not_imported_from_production_code():
    """Assert that no production file imports ``michael_port``."""
    assert os.path.isdir(_SRC_ROOT), f"source root not found: {_SRC_ROOT}"

    offenders = []
    for py in _walk_py_files(_SRC_ROOT):
        if os.path.abspath(py) in _ALLOWED_FILES:
            continue
        try:
            with open(py, "r", encoding="utf-8") as f:
                source = f.read()
        except OSError:
            continue
        matches = _IMPORT_REGEX.findall(source)
        if matches:
            offenders.append((py, matches))

    assert not offenders, (
        "michael_port is imported from production code "
        f"(should be audit-only): {offenders}"
    )
