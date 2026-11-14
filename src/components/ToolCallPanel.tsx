/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { RLMetrics, ToolCallEvent } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  Wrench,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Code,
  SlidersHorizontal,
  TrendingUp,
  Cpu,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ToolCallPanelProps {
  metricsHistory: RLMetrics[];
  recentToolCalls: ToolCallEvent[];
}

export default function ToolCallPanel({ metricsHistory, recentToolCalls }: ToolCallPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Latest status summary
  const latestMetric = metricsHistory[metricsHistory.length - 1] || {
    toolCallsCount: 0,
    toolSuccessRate: 1.0,
    step: 0
  };

  // Calculate the overall total invocations across all steps
  const totalInvocations = metricsHistory.reduce((sum, m) => sum + m.toolCallsCount, 0);

  // Process metrics to get step-wise tool call counts (already step-wise from the server)
  const processedMetrics = metricsHistory.map((metric) => {
    return {
      ...metric,
      stepToolCallsCount: metric.toolCallsCount
    };
  });

  const filteredCalls = recentToolCalls.filter(call => {
    const matchesSearch =
      call.toolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.arguments.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.result.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'success' && call.status === 'success') ||
      (statusFilter === 'failure' && call.status === 'failure');

    return matchesSearch && matchesStatus;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs font-mono">
          <p className="text-slate-400 mb-1">Step {label}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} style={{ color: p.color }} className="font-semibold">
              {p.name}: {p.name.includes('Rate') ? `${(p.value * 100).toFixed(1)}%` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col gap-6" id="tool-call-panel-container">
      {/* 1. Header Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="tool-overview-stats">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4" id="stat-total-calls">
          <div className="bg-purple-950/50 border border-purple-900/60 p-2.5 rounded-lg text-purple-400">
            <Wrench size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Tool Invocations</p>
            <p className="font-mono text-2xl font-bold text-slate-100">{totalInvocations}</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4" id="stat-success-rate">
          <div className="bg-emerald-950/50 border border-emerald-900/60 p-2.5 rounded-lg text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Tool Execution Success Rate</p>
            <p className="font-mono text-2xl font-bold text-emerald-400">
              {(latestMetric.toolSuccessRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4" id="stat-active-step">
          <div className="bg-sky-950/50 border border-sky-900/60 p-2.5 rounded-lg text-sky-400">
            <Cpu size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Latest Active Step</p>
            <p className="font-mono text-2xl font-bold text-slate-100">{latestMetric.step}</p>
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side Trend Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="tool-trend-charts">
        {/* Dynamic Tool Invocations & Usage Trends Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]" id="tool-card-cumulative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-purple-400" size={18} />
              <h3 className="font-sans font-medium text-slate-200 text-sm">Dynamic Tool Invocations & Usage Trends</h3>
            </div>
            <span className="font-mono text-xs text-purple-400 bg-purple-950/40 border border-purple-900/40 px-2 py-0.5 rounded">
              Total: {totalInvocations}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedMetrics} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="step" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 'auto']} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="stepToolCallsCount" name="Tool Invocations" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorCumulative)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success Rate Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]" id="tool-card-success">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-400" size={18} />
              <h3 className="font-sans font-medium text-slate-200 text-sm">Tool Success Rate (%)</h3>
            </div>
            <span className="font-mono text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded">
              Rate: {(latestMetric.toolSuccessRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedMetrics} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccessRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="step" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 1]} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="toolSuccessRate" name="Success Rate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccessRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Live Log Details Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden" id="tool-logs-card">
        {/* Filters and Header Bar */}
        <div className="border-b border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40" id="tool-logs-filters">
          <div>
            <h3 className="font-sans font-medium text-slate-200 text-sm">Active Tool Invocation Log</h3>
            <p className="text-xs text-slate-400 mt-1">Real-time output stream of tool-use events inside RL reasonings.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-44 bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-800 focus:outline-none focus:border-slate-700 font-mono"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center border border-slate-800 rounded-lg p-0.5 bg-slate-900 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-slate-100 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('success')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                  statusFilter === 'success'
                    ? 'bg-emerald-950 text-emerald-400 font-medium border border-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setStatusFilter('failure')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                  statusFilter === 'failure'
                    ? 'bg-rose-950 text-rose-400 font-medium border border-rose-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Failed
              </button>
            </div>
          </div>
        </div>

        {/* Log Events List */}
        <div className="divide-y divide-slate-800 max-h-[420px] overflow-y-auto" id="tool-logs-list">
          {filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <Wrench size={28} className="mb-2 stroke-slate-600" />
              <p className="text-xs font-mono">No matching tool invocations recorded.</p>
              <p className="text-[10px] mt-1 text-slate-600">Start the RL simulation to observe live tool calls.</p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isExpanded = expandedId === call.id;
              return (
                <div key={call.id} className="p-4 hover:bg-slate-950/20 transition-colors" id={`tool-call-row-${call.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Log summary row */}
                    <div className="flex items-start gap-3">
                      {/* Status indicator */}
                      <div className="mt-0.5">
                        {call.status === 'success' ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-950/50 border border-emerald-900/40 text-emerald-400">
                            <CheckCircle2 size={12} />
                          </span>
                        ) : call.status === 'failure' ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-950/50 border border-rose-900/40 text-rose-400">
                            <XCircle size={12} />
                          </span>
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-950/50 border border-amber-900/40 text-amber-400 animate-pulse">
                            <SlidersHorizontal size={12} />
                          </span>
                        )}
                      </div>

                      {/* Tool name & meta */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-200">{call.toolName}</span>
                          <span className="font-mono text-[10px] text-slate-500">Step {call.step}</span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                            {call.id}
                          </span>
                        </div>
                        {/* Prompt-like short args */}
                        <p className="text-xs font-mono text-slate-400 mt-1 line-clamp-1 max-w-[300px] sm:max-w-md md:max-w-2xl">
                          {call.arguments}
                        </p>
                      </div>
                    </div>

                    {/* Right utilities: Latency & Expand */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-slate-950 border border-slate-800/80 px-2 py-1 rounded">
                        <Clock size={10} className="text-slate-500" />
                        <span>{call.durationMs}ms</span>
                      </div>

                      <button
                        onClick={() => toggleExpand(call.id)}
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        title={isExpanded ? "Collapse Details" : "Expand Details"}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON Arguments and Return values */}
                  {isExpanded && (
                    <div className="mt-3 pl-8 grid grid-cols-1 md:grid-cols-2 gap-3" id={`tool-call-details-${call.id}`}>
                      {/* Passed Arguments */}
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-2">
                          <Code size={11} className="text-purple-400" />
                          <span>Input Arguments</span>
                        </div>
                        <pre className="font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-40">
                          {call.arguments.startsWith('{')
                            ? JSON.stringify(JSON.parse(call.arguments), null, 2)
                            : call.arguments}
                        </pre>
                      </div>

                      {/* Execution Result */}
                      <div className={`border rounded-lg p-3 ${
                        call.status === 'success' 
                          ? 'bg-slate-950/80 border-emerald-950/60' 
                          : 'bg-slate-950/80 border-rose-950/60'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                            <Code size={11} className={call.status === 'success' ? "text-emerald-400" : "text-rose-400"} />
                            <span>Execution Return</span>
                          </div>
                          <span className={`text-[9px] font-mono font-medium uppercase px-1.5 py-0.2 rounded ${
                            call.status === 'success'
                              ? 'bg-emerald-950/50 border border-emerald-900/30 text-emerald-400'
                              : 'bg-rose-950/50 border border-rose-900/30 text-rose-400'
                          }`}>
                            {call.status}
                          </span>
                        </div>
                        <pre className="font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-40">
                          {call.result.startsWith('{')
                            ? JSON.stringify(JSON.parse(call.result), null, 2)
                            : call.result}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
