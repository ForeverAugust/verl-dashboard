/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RLMetrics } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, Award, Zap, RefreshCw } from 'lucide-react';

interface MetricsPanelProps {
  metricsHistory: RLMetrics[];
}

export default function MetricsPanel({ metricsHistory }: MetricsPanelProps) {
  // Grab the latest record
  const latest = metricsHistory[metricsHistory.length - 1] || {
    step: 0,
    epoch: 0,
    reward: 0,
    policyLoss: 0,
    valueLoss: 0,
    klDivergence: 0,
    entropy: 0,
    learningRate: 0
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs font-mono">
          <p className="text-slate-400 mb-1">Step {label}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} style={{ color: p.color }} className="font-semibold">
              {p.name}: {p.value.toFixed(4)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="metrics-panel-container">
      {/* Metric Card 1: Reward Curve */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]" id="metric-card-reward">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="text-emerald-400" size={18} />
            <h3 className="font-sans font-medium text-slate-200 text-sm">Mean Rollout Reward</h3>
          </div>
          <span className="font-mono text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded">
            Value: {latest.reward.toFixed(4)}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metricsHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReward" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="step" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="reward" name="Reward" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReward)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric Card 2: Training Losses */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]" id="metric-card-loss">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-400" size={18} />
            <h3 className="font-sans font-medium text-slate-200 text-sm">Policy & Value Loss</h3>
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900/40 px-1.5 py-0.5 rounded">
              P-Loss: {latest.policyLoss.toFixed(4)}
            </span>
            <span className="font-mono text-[10px] text-rose-400 bg-rose-950/40 border border-rose-900/40 px-1.5 py-0.5 rounded">
              V-Loss: {latest.valueLoss.toFixed(4)}
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="step" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="policyLoss" name="Policy Loss" stroke="#f59e0b" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="valueLoss" name="Value Loss" stroke="#f43f5e" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric Card 3: KL Divergence */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]" id="metric-card-kl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-sky-400" size={18} />
            <h3 className="font-sans font-medium text-slate-200 text-sm">KL Divergence (Ref Model)</h3>
          </div>
          <span className="font-mono text-xs text-sky-400 bg-sky-950/40 border border-sky-900/40 px-2 py-0.5 rounded">
            KL: {latest.klDivergence.toFixed(4)}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metricsHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorKL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="step" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="klDivergence" name="KL Divergence" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorKL)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric Card 4: Policy Entropy */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]" id="metric-card-entropy">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-violet-400" size={18} />
            <h3 className="font-sans font-medium text-slate-200 text-sm">Policy Entropy</h3>
          </div>
          <span className="font-mono text-xs text-violet-400 bg-violet-950/40 border border-violet-900/40 px-2 py-0.5 rounded">
            Entropy: {latest.entropy.toFixed(4)}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="step" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="entropy" name="Entropy" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
