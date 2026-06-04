"""Top-level pytest conftest for the onlinev2 test suite.

Set OpenMP environment variables BEFORE any numerical library is
imported. XGBoost and PyTorch each ship with their own OpenMP runtime
(libgomp and libomp respectively); loading both into the same process
on macOS triggers a `pthread_mutex_init` collision:

    OMP: Error #179: Function pthread_mutex_init failed
    OMP: System error #22: Invalid argument
    Segmentation fault

Pinning every OMP runtime to a single thread (and telling the Intel
OpenMP runtime to tolerate duplicates) avoids the collision without
otherwise affecting test semantics. These tests don't rely on
parallelism for their assertions.

This file MUST stay at the top of the tests/ tree and MUST set env
vars at module import time (before any `import numpy`, `import torch`,
`import xgboost`) so the values are visible when OMP is first loaded.
"""
from __future__ import annotations

import os

# Force single-threaded OMP across every backend. Setting them here —
# before any numerical library is imported — is the only reliable way
# to avoid the XGBoost/PyTorch OMP runtime collision on macOS.
for _var in (
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "OMP_THREAD_LIMIT",
):
    os.environ.setdefault(_var, "1")

# Intel OpenMP: tolerate multiple libomp copies in the process image.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
