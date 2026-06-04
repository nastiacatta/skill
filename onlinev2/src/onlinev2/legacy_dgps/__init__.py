"""Legacy function-based data generators for mvp and experiments."""
from .baseline import (
    generate_client_quantile_report,
    generate_client_report,
    generate_truth_and_quantile_reports,
    generate_truth_and_reports,
)
from .latent_fixed import (
    generate_truth_and_quantile_reports_latent,
    generate_truth_and_reports_latent,
)
from .simulation_inputs import generate_cash_deposits, generate_missingness

__all__ = [
    "generate_truth_and_reports",
    "generate_truth_and_quantile_reports",
    "generate_client_report",
    "generate_client_quantile_report",
    "generate_missingness",
    "generate_cash_deposits",
    "generate_truth_and_reports_latent",
    "generate_truth_and_quantile_reports_latent",
]
