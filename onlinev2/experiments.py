"""
Thin entry point for running experiments.

Delegates to the package CLI. Run from onlinev2/ with package installed:
  python experiments.py --exp <name>
  python -m onlinev2.experiments.cli --exp <name>
  run-onlinev2-experiments --exp <name>
No PYTHONPATH or sys.path manipulation required.
"""

from onlinev2.experiments.cli import main

if __name__ == "__main__":
    main()
