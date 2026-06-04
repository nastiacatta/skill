export interface ForecasterData {
  name: string;
  type: string;
  description: string;
  strengths: string;
  weaknesses: string;
}

export const FORECASTERS: ForecasterData[] = [
  {
    name: 'Naive (last value)',
    type: 'Baseline',
    description:
      'Uses the most recent observed value as the forecast.',
    strengths: 'Performs well when the series is a random walk or highly autocorrelated.',
    weaknesses: 'Cannot capture trends, seasonality, or any temporal structure.',
  },
  {
    name: 'EWMA (5)',
    type: 'Statistical',
    description:
      'Exponentially weighted moving average with span=5.',
    strengths: 'Responsive to recent changes while smoothing noise.',
    weaknesses: 'Lags behind sudden level shifts.',
  },
  {
    name: 'ARIMA(2, 1, 1)',
    type: 'Statistical',
    description:
      'Autoregressive integrated moving average. Captures linear temporal dependencies.',
    strengths: 'Classical model with well-understood theory.',
    weaknesses: 'Assumes linearity, cannot model complex non-linear dynamics.',
  },
  {
    name: 'XGBoost',
    type: 'Machine Learning',
    description:
      'Gradient-boosted decision tree ensemble with lag features.',
    strengths: 'Captures non-linear patterns and feature interactions.',
    weaknesses: 'Prone to overfitting on small datasets.',
  },
  {
    name: 'Neural Net (MLP)',
    type: 'Machine Learning',
    description:
      'Multi-layer perceptron with lag inputs.',
    strengths: 'Most flexible model in the panel.',
    weaknesses: 'Data-hungry, requires more training data to generalise.',
  },
  {
    name: 'Theta',
    type: 'Statistical',
    description:
      'Theta method — decomposes the series into trend components.',
    strengths: 'Strong performance on M3 competition data.',
    weaknesses: 'Limited theoretical justification, struggles with complex seasonality.',
  },
  {
    name: 'Ensemble (Naive+EWMA)',
    type: 'Ensemble',
    description:
      'Simple average of Naive and EWMA(5) forecasts.',
    strengths: 'Diversification benefit from combining two fast-adapting models.',
    weaknesses: 'Limited diversity, both components are reactive baselines.',
  },
];
