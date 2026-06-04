"""Base experiment config with serialization."""
from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class ExperimentConfig:
    name: str = "experiment"
    output_dir: str = "outputs"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "ExperimentConfig":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})
