/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionProbability } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, HelpCircle, ShieldAlert } from 'lucide-react';

interface ActionDistributionPanelProps {
  probabilities: ActionProbability[];
  entropy?: number;
  title?: string;
  subheading?: string;
}

export default function ActionDistributionPanel({
  probabilities,
  entropy,
  title = "Policy Action Distribution",
  subheading = "Live vocabulary and transition log probabilities"
}: ActionDistributionPanelProps) {
  // Safe default if data is empty
  const data = probabilities && probabilities.length > 0 ? probabilities : [
    { action: 'UP', probability: 0.25, isChosen: false },
    { action: 'DOWN', probability: 0.25, isChosen: false },
    { action: 'LEFT', probability: 0.25, isChosen: false },
    { action: 'RIGHT', probability: 0.25, isChosen: false }
  ];

  // Sort descending by probability for better visualization
  const sortedData = [...data].sort((a, b) => b.probability - a.probability);

  const chosenAction = data.find(p => p.isChosen)?.action || sortedData[0]?.action || 'None';
  const chosenProb = data.find(p => p.isChosen)?.probability || sortedData[0]?.probability || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[340px]" id="action-distribution-container">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="text-indigo-400" size={18} />
            <h3 className="font-sans font-medium text-slate-200 text-sm">{title}</h3>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{subheading}</p>
        </div>
        
        {entropy !== undefined && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Step Entropy</span>
            <span className="text-sm font-mono font-bold text-indigo-400">{entropy.toFixed(4)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
        {/* Left Side: Distribution Bar Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 15, left: 15, bottom: 5 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={10} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis
                type="category"
                dataKey="action"
                stroke="#94a3b8"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
                width={80}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: any) => [`${(Number(v) * 100).toFixed(1)}%`, 'Probability']}
                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#cbd5e1' }}
              />
              <Bar dataKey="probability" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isChosen ? '#4f46e5' : '#475569'}
                    className="transition-all duration-300"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right Side: Quick analysis list */}
        <div className="w-full md:w-[180px] flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
          <div className="mb-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Chosen Action</span>
            <span className="text-base font-mono font-bold text-slate-100 truncate block bg-indigo-950/20 px-2 py-1 rounded border border-indigo-900/30 mt-1">
              {chosenAction}
            </span>
          </div>
          <div className="mb-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Confidence</span>
            <span className="text-lg font-mono font-bold text-emerald-400 block mt-0.5">
              {(chosenProb * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Log-probability</span>
            <span className="text-xs font-mono text-slate-400 block mt-0.5">
              {chosenProb > 0 ? Math.log(chosenProb).toFixed(4) : '-inf'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
