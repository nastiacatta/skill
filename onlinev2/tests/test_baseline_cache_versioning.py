"""Unit tests for the forecast-cache `pipeline_version` round-trip and
regeneration-on-mismatch behaviour.

Tests pipeline_version cache invalidation (properties 1.3 / 2.3).
"""
# Feature: model-training-testing-audit, Property 1: Bug Condition
from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
import run_baseline_comparison as rbc  # noqa: E402


def _write_legacy_cache(cache_path: Path, T: int = 300) -> None:
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    fake_y = np.linspace(0.1, 0.9, T).astype(np.float64)
    fake_q = np.tile(fake_y[None, :, None], (3, 1, len(taus)))
    np.savez_compressed(
        cache_path,
        y_norm=fake_y,
        q_reports=fake_q,
        names=np.array(["a", "b", "c"]),
        taus=taus,
        series_min=0.0,
        series_max=1.0,
        pipeline_version=np.array("legacy"),
    )


def _write_dummy_csv(csv_path: Path, T: int = 400, seed: int = 0) -> None:
    rng = np.random.default_rng(seed)
    raw = np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)
    np.savetxt(
        csv_path,
        np.column_stack([np.arange(T), raw]),
        delimiter=",",
        header="t,measured",
        comments="",
    )


def test_ensure_cache_regenerates_on_legacy_tag(tmp_path: Path):
    """ensure_cache must ignore caches with pipeline_version != current."""
    cache = tmp_path / "cache.npz"
    csv = tmp_path / "series.csv"
    _write_legacy_cache(cache)
    _write_dummy_csv(csv)
    mtime_before = cache.stat().st_mtime

    time.sleep(0.05)
    rbc.ensure_cache(
        str(cache), str(csv), np.array([0.1, 0.25, 0.5, 0.75, 0.9]),
        hourly=False, warmup=100,
    )

    data = np.load(cache, allow_pickle=True)
    assert "pipeline_version" in data.files
    assert str(data["pipeline_version"].item()) == rbc.PIPELINE_VERSION
    assert cache.stat().st_mtime > mtime_before


def test_ensure_cache_regenerates_on_missing_tag(tmp_path: Path):
    """Caches without a pipeline_version field are treated as legacy."""
    cache = tmp_path / "cache.npz"
    csv = tmp_path / "series.csv"
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    T = 300
    fake_y = np.linspace(0.1, 0.9, T).astype(np.float64)
    fake_q = np.tile(fake_y[None, :, None], (3, 1, len(taus)))
    np.savez_compressed(
        cache,
        y_norm=fake_y,
        q_reports=fake_q,
        names=np.array(["a", "b", "c"]),
        taus=taus,
        series_min=0.0,
        series_max=1.0,
        # no pipeline_version
    )
    _write_dummy_csv(csv)
    mtime_before = cache.stat().st_mtime

    time.sleep(0.05)
    rbc.ensure_cache(
        str(cache), str(csv), taus, hourly=False, warmup=100,
    )

    data = np.load(cache, allow_pickle=True)
    assert "pipeline_version" in data.files
    assert str(data["pipeline_version"].item()) == rbc.PIPELINE_VERSION
    assert cache.stat().st_mtime > mtime_before


def test_ensure_cache_reuses_on_version_match(tmp_path: Path):
    """When pipeline_version AND forecaster_config_hash AND normalize_mode
    all match, the cache is reused as-is."""
    cache = tmp_path / "cache.npz"
    csv = tmp_path / "series.csv"
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    T = 300
    fake_y = np.linspace(0.1, 0.9, T).astype(np.float64)
    fake_q = np.tile(fake_y[None, :, None], (3, 1, len(taus)))
    np.savez_compressed(
        cache,
        y_norm=fake_y,
        q_reports=fake_q,
        names=np.array(["a", "b", "c"]),
        taus=taus,
        series_min=0.0,
        series_max=1.0,
        pipeline_version=np.array(rbc.PIPELINE_VERSION),
        forecaster_config_hash=np.array(rbc.FORECASTER_CONFIG_HASH),
        normalize_mode=np.array("static"),
    )
    _write_dummy_csv(csv)
    mtime_before = cache.stat().st_mtime

    time.sleep(0.05)
    rbc.ensure_cache(
        str(cache), str(csv), taus, hourly=False, warmup=100,
        normalize_mode="static",
    )

    # Unchanged mtime — cache was not regenerated.
    assert cache.stat().st_mtime == mtime_before


def test_cache_config_hash_invalidates_on_mismatch(tmp_path: Path):
    """Post-audit #4: caches with a stale forecaster_config_hash are
    regenerated even when pipeline_version matches."""
    cache = tmp_path / "cache.npz"
    csv = tmp_path / "series.csv"
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    T = 300
    fake_y = np.linspace(0.1, 0.9, T).astype(np.float64)
    fake_q = np.tile(fake_y[None, :, None], (3, 1, len(taus)))
    np.savez_compressed(
        cache,
        y_norm=fake_y,
        q_reports=fake_q,
        names=np.array(["a", "b", "c"]),
        taus=taus,
        series_min=0.0,
        series_max=1.0,
        pipeline_version=np.array(rbc.PIPELINE_VERSION),
        forecaster_config_hash=np.array("deadbeef000000aa"),  # stale
    )
    _write_dummy_csv(csv)
    mtime_before = cache.stat().st_mtime

    time.sleep(0.05)
    rbc.ensure_cache(
        str(cache), str(csv), taus, hourly=False, warmup=100,
    )

    data = np.load(cache, allow_pickle=True)
    assert str(data["forecaster_config_hash"].item()) == rbc.FORECASTER_CONFIG_HASH
    assert cache.stat().st_mtime > mtime_before


def test_forecaster_config_hash_stable():
    """The hash is deterministic for the same forecaster configuration."""
    hash_a = rbc._forecaster_config_hash()
    hash_b = rbc._forecaster_config_hash()
    assert hash_a == hash_b
    assert len(hash_a) == 16  # 16-char hex


def test_cache_normalize_mode_invalidates_on_mismatch(tmp_path: Path):
    """Post-audit issue #1: caches carry a normalize_mode tag and are
    regenerated when the caller requests a different mode than the cache
    was built with."""
    cache = tmp_path / "cache.npz"
    csv = tmp_path / "series.csv"
    taus = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    T = 300
    fake_y = np.linspace(0.1, 0.9, T).astype(np.float64)
    fake_q = np.tile(fake_y[None, :, None], (3, 1, len(taus)))
    np.savez_compressed(
        cache,
        y_norm=fake_y,
        q_reports=fake_q,
        names=np.array(["a", "b", "c"]),
        taus=taus,
        series_min=0.0,
        series_max=1.0,
        pipeline_version=np.array(rbc.PIPELINE_VERSION),
        forecaster_config_hash=np.array(rbc.FORECASTER_CONFIG_HASH),
        normalize_mode=np.array("static"),
    )
    _write_dummy_csv(csv)
    mtime_before = cache.stat().st_mtime

    time.sleep(0.05)
    # Request expanding — must regenerate.
    rbc.ensure_cache(
        str(cache), str(csv), taus, hourly=False, warmup=100,
        normalize_mode="expanding",
    )

    data = np.load(cache, allow_pickle=True)
    assert "normalize_mode" in data.files
    assert str(data["normalize_mode"].item()) == "expanding"
    assert cache.stat().st_mtime > mtime_before


def test_forecaster_config_hash_taus_invalidate():
    """The hash changes when the τ-grid changes, so cache built on one
    grid is not silently reused when the caller requests another."""
    taus_5 = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    taus_9 = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    h5 = rbc._forecaster_config_hash(taus_5)
    h9 = rbc._forecaster_config_hash(taus_9)
    assert h5 != h9
