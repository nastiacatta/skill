# Dashboard data directory

The dashboard loads experiment data from this directory.

## What belongs here

| Item | In repo? | Description |
|------|----------|-------------|
| `index.json` | Yes | List of experiments and metadata. The dashboard uses this to know which experiments exist and where their data files live. |
| `core/` | No (symlink or copy) | Outputs for **core** experiments. Expected layout: `core/experiments/<experiment_name>/` containing e.g. `data/series.csv`, `summary.json`. |
| `behaviour/` | No (symlink or copy) | Outputs for **behaviour** experiments. Expected layout: `behaviour/experiments/<experiment_name>/` containing e.g. `data/behaviour_matrix.csv`, `summary.json`. |
| `experiments/` | No (symlink or copy) | Some experiments in `index.json` use `block: "experiments"`. Their outputs may live under `onlinev2/outputs/core/experiments/` or a separate experiments tree; link or copy so that `experiments/experiments/<name>/` exists here if you use those entries. |

## Portable setup (no absolute paths)

Do **not** use absolute symlinks (e.g. `/Users/.../outputs/...`). They break for anyone else who clones the repo.

**Option A – Relative symlinks (recommended)**  
From the **repository root**:

```bash
./scripts/link-dashboard-data.sh
```

Or by hand from this directory (`dashboard/public/data/`):

```bash
ln -sfn ../../onlinev2/outputs/core core
ln -sfn ../../onlinev2/outputs/behaviour behaviour
```

Use the same `onlinev2/outputs` path you pass to the Python CLI as `--outdir`. If your outputs live elsewhere, change the target path in the script or in the `ln` commands.

**Option B – Copy**  
Copy the contents of `onlinev2/outputs/core` into `core/` and `onlinev2/outputs/behaviour` into `behaviour/` so that no symlinks are needed. Good for a fixed snapshot or for CI.

## When data is missing

If `index.json` is present but `core/` or `behaviour/` are missing or empty, the dashboard still runs and uses **mock data** for development. Real experiment panels will show empty or fallback content until the corresponding outputs are available under this directory.
