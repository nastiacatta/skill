#!/usr/bin/env python3
"""Post-regen sanity check — prints key numbers for writing/thesis reconciliation.

Run after scripts/run_real_data_with_skill.py finishes. Compares the
expanding-mode γ=16/ρ=0.5 regenerated JSON with the abstract / Claim 9
text numbers.
"""
import json
from pathlib import Path

def summarise(path):
    if not Path(path).exists():
        print(f"MISSING: {path}")
        return
    d = json.load(open(path))
    c = d.get('config', {})
    print(f"\n=== {path} ===")
    print(f"  T={c.get('T')}  warmup={c.get('warmup')}  "
          f"T_eval={c.get('T',0)-c.get('warmup',0) if c.get('T') and c.get('warmup') else '?'}")
    print(f"  gamma={c.get('gamma')}  rho={c.get('rho')}  lam={c.get('lam')}  "
          f"normalize_mode={c.get('normalize_mode')}")
    if 'dm_test' in d and d['dm_test']:
        dm = d['dm_test']
        print(f"  DM (mech vs uniform): t={dm.get('statistic'):.4f}  "
              f"p={dm.get('p_value')}  sig001={dm.get('significant_at_001')}")
    if 'dm_test_skill' in d and d['dm_test_skill']:
        dms = d['dm_test_skill']
        print(f"  DM (skill vs uniform): t={dms.get('statistic'):.4f}  "
              f"p={dms.get('p_value')}")
    rows = d.get('rows', [])
    base = next((r['mean_crps'] for r in rows if r['method'] == 'uniform'), 0)
    print(f"  Method comparison (base uniform={base:.5f}):")
    for method in ['uniform', 'skill', 'mechanism', 'inverse_variance',
                   'trimmed_mean', 'median', 'best_single', 'oracle',
                   'per_round_inv_crps_hindsight',
                   'michael_ogd_centered_median_fan']:
        m = next((r for r in rows if r['method'] == method), None)
        if m is None:
            continue
        crps = m['mean_crps']
        pct = (crps - base) / base * 100 if base else 0
        print(f"    {method:35s}  {crps:.5f}  ({pct:+.2f}%)")


if __name__ == "__main__":
    for p in [
        'dashboard/public/data/real_data/elia_wind/data/comparison.json',
        'dashboard/public/data/real_data/elia_electricity/data/comparison.json',
    ]:
        summarise(p)
