import type {
  RoundTrace,
  SimResult,
  MechanismConfig,
  SimParams,
} from './types';

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function normalSample(r: () => number, mu: number, sigma: number): number {
  const u = 1 - r();
  const v = r();
  return (
    mu +
    sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  );
}

export function runSimulation(
  config: MechanismConfig,
  params: SimParams
): SimResult {
  const r = rng(42);
  const { T, N, gamma, lambda, eta, f, U } = params;
  const W0 = 100;
  const b_max = 40;
  const sigma_min = 0.1;
  const c_min = 0.1;
  const c_max = 1.0;
  const beta_c = 2.0;

  const rounds: RoundTrace[] = [];
  const wealth = Array.from({ length: N }, () => W0);
  const cumLoss = Array.from({ length: N }, () => 0);

  for (let t = 0; t < T; t++) {
    const y_true = 0.3 + 0.5 * r();

    let active = Array.from({ length: N }, () => true);
    if (config.behaviour === 'Bursty')
      active = active.map(() => r() > 0.35);
    if (active.every((a) => !a)) active[0] = true;

    let sigma = Array.from({ length: N }, (_, i) => {
      if (config.skill === 'Fixed') return sigma_min + 0.3 * (i / N);
      if (config.skill === 'EWMA')
        return Math.max(sigma_min, 1 - 0.5 * (cumLoss[i] / Math.max(1, t)));
      if (config.skill === 'Slow adapt')
        return sigma_min + (1 - sigma_min) * Math.exp(-0.2 * cumLoss[i]);
      return sigma_min + (1 - sigma_min) * Math.exp(-gamma * cumLoss[i]);
    });

    if (config.behaviour === 'Insider')
      sigma = sigma.map((s) => (r() < 0.3 ? Math.min(1, s + 0.4) : s));

    const reports = Array.from({ length: N }, (_, i) => {
      if (!active[i]) return null;
      const skill = sigma[i];
      const noise =
        config.behaviour === 'Insider' && r() < 0.3
          ? 0.05
          : 0.05 + (1 - skill) * 0.3;
      const med = normalSample(r, y_true, noise);
      const halfW = Math.abs(
        normalSample(r, 0.1 + (1 - skill) * 0.25, 0.03)
      );
      return { q10: med - halfW, q50: med, q90: med + halfW };
    });

    const widths = reports.map((rp) => (rp ? rp.q90 - rp.q10 : null));

    const confidence = widths.map((w) => {
      if (w === null) return null;
      return Math.min(c_max, Math.max(c_min, Math.exp(-beta_c * w)));
    });

    const deposits = Array.from({ length: N }, (_, i) => {
      if (!active[i]) return 0;
      const W = wealth[i];
      if (config.deposit === 'Fixed unit') return Math.min(W, b_max);
      if (config.deposit === 'Random') return Math.min(W, W * f * r());
      if (config.deposit === 'Oracle-style')
        return (confidence[i] ?? 0) > 0.5
          ? Math.min(W, f * W, b_max)
          : 0.1;
      return Math.min(
        W,
        f * W * (confidence[i] ?? 0),
        b_max
      );
    });

    const wagers = Array.from({ length: N }, (_, i) => {
      if (!active[i]) return 0;
      const b = deposits[i];
      if (config.influence === 'Equal') return b;
      if (config.influence === 'Stake-only') return b * lambda;
      if (config.influence === 'Skill-only')
        return b * Math.pow(sigma[i], eta);
      const raw = b * (lambda + (1 - lambda) * Math.pow(sigma[i], eta));
      if (config.influence === 'Capped blend') return Math.min(raw, b_max * 0.5);
      return raw;
    });

    const totalWager = wagers.reduce((a, b) => a + b, 0) || 1;
    const weights = wagers.map((m) => m / totalWager);

    let aggMed = 0;
    let agg10 = 0;
    let agg90 = 0;
    if (config.aggregation === 'Equal pool') {
      const actReports = reports.filter((r): r is NonNullable<typeof r> => r !== null);
      const na = actReports.length || 1;
      aggMed = actReports.reduce((s, r) => s + r.q50, 0) / na;
      agg10 = actReports.reduce((s, r) => s + r.q10, 0) / na;
      agg90 = actReports.reduce((s, r) => s + r.q90, 0) / na;
    } else if (config.aggregation === 'Log pool') {
      const validI = reports
        .map((r, i) => (r ? i : -1))
        .filter((i) => i >= 0);
      aggMed = validI.length
        ? Math.exp(
            validI.reduce(
              (s, i) =>
                s +
                weights[i] * Math.log(Math.max(0.01, reports[i]!.q50)),
              0
            )
          )
        : 0.5;
      agg10 = validI.length
        ? Math.exp(
            validI.reduce(
              (s, i) =>
                s +
                weights[i] * Math.log(Math.max(0.01, reports[i]!.q10)),
              0
            )
          )
        : 0.3;
      agg90 = validI.length
        ? Math.exp(
            validI.reduce(
              (s, i) =>
                s +
                weights[i] * Math.log(Math.max(0.01, reports[i]!.q90)),
              0
            )
          )
        : 0.7;
    } else {
      aggMed = reports.reduce(
        (s, r, i) => s + (r ? weights[i] * r.q50 : 0),
        0
      );
      agg10 = reports.reduce(
        (s, r, i) => s + (r ? weights[i] * r.q10 : 0),
        0
      );
      agg90 = reports.reduce(
        (s, r, i) => s + (r ? weights[i] * r.q90 : 0),
        0
      );
    }

    const scores = reports.map((rp) => {
      if (!rp) return 0;
      const err = Math.abs(rp.q50 - y_true);
      const halfW = (rp.q90 - rp.q10) / 2;
      return -(err + halfW * 0.5);
    });

    const totalScorePos = scores.reduce(
      (a, b) => a + Math.max(0, b),
      0
    ) || 0.001;
    const scoreShares = scores.map((s) => Math.max(0, s) / totalScorePos);

    const refunds = Array.from(
      { length: N },
      (_, i) => (active[i] ? Math.max(0, deposits[i] - wagers[i]) : 0)
    );
    const payouts = Array.from({ length: N }, (_, i) => {
      if (!active[i]) return 0;
      if (config.settlement === 'Skill-only') return U * scoreShares[i];
      if (config.settlement === 'No-arbitrage')
        return deposits[i] + (totalWager > 0 ? U * weights[i] : 0);
      return refunds[i] + U * scoreShares[i];
    });
    const profits = payouts.map((p, i) => p - deposits[i]);

    profits.forEach((pi, i) => {
      wealth[i] = Math.max(1, wealth[i] + pi);
    });
    scores.forEach((s, i) => {
      if (active[i]) cumLoss[i] += Math.max(0, -s);
    });

    const hhiVal = weights.reduce((s, w) => s + w * w, 0);
    const nEff = 1 / hhiVal;

    rounds.push({
      t,
      y_true,
      active: [...active],
      reports: reports.map((rp) => (rp ? rp.q50 : null)),
      q10s: reports.map((rp) => (rp ? rp.q10 : null)),
      q90s: reports.map((rp) => (rp ? rp.q90 : null)),
      widths,
      confidence,
      sigma: [...sigma],
      deposits: [...deposits],
      wagers: [...wagers],
      weights: [...weights],
      aggregate: { q50: aggMed, q10: agg10, q90: agg90 },
      scores: [...scores],
      scoreShares: [...scoreShares],
      refunds: [...refunds],
      payouts: [...payouts],
      profits: [...profits],
      wealth: [...wealth],
      hhi: hhiVal,
      nEff,
      totalDeposit: deposits.reduce((a, b) => a + b, 0),
      totalWager,
      totalRefund: refunds.reduce((a, b) => a + b, 0),
      totalPayout: payouts.reduce((a, b) => a + b, 0),
      U,
    });
  }

  return { rounds, N, T };
}
