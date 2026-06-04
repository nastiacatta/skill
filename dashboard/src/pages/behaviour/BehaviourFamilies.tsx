import { useState } from 'react';
import PageHeader from '@/components/dashboard/PageHeader';
import SectionLabel from '@/components/dashboard/SectionLabel';
import ChartCard from '@/components/dashboard/ChartCard';

const FAMILIES: { id: string; label: string; items: string[]; note?: string }[] = [
  {
    id: 'participation',
    label: 'Participation and timing',
    items: [
      'Availability (who can participate)',
      'Burstiness (clustered activity)',
      'Deadline effects',
      'Selection on edge (participate when confident)',
      'Selection on confidence',
      'Avoiding skill decay (strategic absence)',
      'Task choice',
    ],
  },
  {
    id: 'belief',
    label: 'Information and belief formation',
    items: [
      'Precision of private signal',
      'Bias (systematic error)',
      'Miscalibration',
      'Correlated errors across agents',
      'Drift adaptation',
      'Costly information',
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting strategy',
    items: [
      'Truthful reporting',
      'Noisy reporting',
      'Hedged reports',
      'Strategic misreporting',
      'Reputation gaming',
      'Sandbagging',
    ],
  },
  {
    id: 'staking',
    label: 'Staking and bankroll behaviour',
    items: [
      'Budget constraints',
      'Deposits (how much to lock in)',
      'Fixed-fraction',
      'Kelly-like',
      'Edge-proportional',
      'Caps, house-money, break-even',
      'Lumpy bets',
    ],
  },
  {
    id: 'objectives',
    label: 'Objectives and preferences',
    items: [
      'Expected value vs utility over wealth',
      'Risk aversion',
      'Externalities',
      'Signalling',
      'Leaderboard motives',
      'Compliance cost',
    ],
    note: 'Easy to forget; clearly in the slides as its own block.',
  },
  {
    id: 'identity',
    label: 'Identity and account management',
    items: [
      'Single identity',
      'Multi-account control',
      'Cap circumvention',
      'Reputation reset',
      'Dormancy, reactivation',
      'Hidden mapping from real user to accounts',
    ],
  },
  {
    id: 'learning',
    label: 'Learning and meta-strategy',
    items: [
      'Reinforcement from profits',
      'Rule learning',
      'Opponent awareness',
      'Exploration vs exploitation',
    ],
  },
  {
    id: 'adversarial',
    label: 'Adversarial and manipulative behaviours',
    items: [
      'Sybils',
      'Collusion',
      'Arbitrage',
      'Volume gaming',
      'Evasion',
      'Insider-type selective entry',
    ],
  },
  {
    id: 'frictions',
    label: 'Operational frictions and data artefacts',
    items: [
      'Latency',
      'Missed rounds',
      'Interface errors',
      'Automation patterns',
    ],
    note: 'Own block so irregular patterns are not labelled as manipulation.',
  },
];

export default function BehaviourFamilies() {
  const [active, setActive] = useState(FAMILIES[0].id);
  const current = FAMILIES.find((f) => f.id === active) ?? FAMILIES[0];

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Behaviour families"
        description="All behaviour categories from the deck. Each family is a tab; expand to see the full taxonomy."
      />

      <div className="flex items-center gap-2 mb-4">
        <SectionLabel type="user_choice" />
        <span className="text-xs text-slate-500">Policy outputs sit in these families.</span>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
          Family
        </label>
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      <ChartCard title={current.label} subtitle={current.note}>
        <ul className="space-y-2 text-xs text-slate-600">
          {current.items.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-slate-400">•</span>
              {item}
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}
