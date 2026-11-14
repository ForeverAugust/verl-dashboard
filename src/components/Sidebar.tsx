/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EnvironmentType } from '../types';
import { Play, Pause, RotateCcw, Cpu, Network, Sliders, Layers } from 'lucide-react';

interface SidebarProps {
  isRunning: boolean;
  currentStep: number;
  currentEpoch: number;
  envType: EnvironmentType;
  wsConnected: boolean;
  hyperparameters: {
    learningRate: number;
    klCoeff: number;
    batchSize: number;
    temperature: number;
    gamma: number;
  };
  onControl: (action: 'start' | 'pause' | 'reset') => void;
  onSetEnv: (env: EnvironmentType) => void;
  onUpdateHyperparams: (params: any) => void;
}

export default function Sidebar({
  isRunning,
  currentStep,
  currentEpoch,
  envType,
  wsConnected,
  hyperparameters,
  onControl,
  onSetEnv,
  onUpdateHyperparams
}: SidebarProps) {

  const handleLRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateHyperparams({ learningRate: parseFloat(e.target.value) });
  };

  const handleKLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateHyperparams({ klCoeff: parseFloat(e.target.value) });
  };

  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateHyperparams({ temperature: parseFloat(e.target.value) });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-5 h-full" id="sidebar-container">
      {/* App brand/status */}
      <div className="flex flex-col gap-1.5 border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-indigo-400" size={18} />
            <span className="font-sans font-bold text-slate-100 text-sm tracking-tight">VERL Orchestrator</span>
          </div>
          {/* WS connected state indicator */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800/60">
            <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-mono text-[9px] font-bold text-slate-400">{wsConnected ? 'LIVE' : 'DISC'}</span>
          </div>
        </div>
        <p className="text-slate-500 text-[10px] leading-relaxed">
          vLLM-based RL telemetry agent. Capture tokens, distributions & states.
        </p>
      </div>

      {/* Control Actions */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">Trainer Loop Control</span>
        <div className="grid grid-cols-2 gap-2">
          {isRunning ? (
            <button
              onClick={() => onControl('pause')}
              className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border border-amber-500/20"
              id="btn-pause-trainer"
            >
              <Pause size={12} /> Pause
            </button>
          ) : (
            <button
              onClick={() => onControl('start')}
              className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border border-indigo-500/20 shadow-md shadow-indigo-600/10"
              id="btn-start-trainer"
            >
              <Play size={12} /> Start
            </button>
          )}

          <button
            onClick={() => onControl('reset')}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border border-slate-700"
            id="btn-reset-trainer"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Environment Selector */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
          <Network size={12} /> Active RL Task
        </span>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onSetEnv('llm_reasoning')}
            className={`text-left px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${envType === 'llm_reasoning' ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/60' : 'bg-slate-950 hover:bg-slate-800 border border-transparent text-slate-400'}`}
          >
            <span>LLM Reasoning (VERL)</span>
            {envType === 'llm_reasoning' && <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full" />}
          </button>

          <button
            onClick={() => onSetEnv('gridworld_pathfinder')}
            className={`text-left px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${envType === 'gridworld_pathfinder' ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/60' : 'bg-slate-950 hover:bg-slate-800 border border-transparent text-slate-400'}`}
          >
            <span>GridWorld Pathfinder</span>
            {envType === 'gridworld_pathfinder' && <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full" />}
          </button>
        </div>
      </div>

      {/* Hyperparameters Form */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1 border-b border-slate-800 pb-1">
          <Sliders size={12} /> Policy Hyperparameters
        </span>
        
        <div className="space-y-3 font-mono text-[10px]">
          {/* Learning Rate Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-slate-300">
              <span>Learning Rate (α)</span>
              <span className="text-indigo-400 font-bold">{hyperparameters.learningRate.toExponential(1)}</span>
            </div>
            <input
              type="range"
              min="1e-6"
              max="1e-4"
              step="1e-6"
              value={hyperparameters.learningRate}
              onChange={handleLRChange}
              className="w-full accent-indigo-500 cursor-pointer h-1 rounded"
            />
          </div>

          {/* KL Penalty Coeff */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-slate-300">
              <span>KL Penalty Coeff (β)</span>
              <span className="text-indigo-400 font-bold">{hyperparameters.klCoeff.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.01"
              value={hyperparameters.klCoeff}
              onChange={handleKLChange}
              className="w-full accent-indigo-500 cursor-pointer h-1 rounded"
            />
          </div>

          {/* Generation Temp */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-slate-300">
              <span>Gen Temperature (T)</span>
              <span className="text-indigo-400 font-bold">{hyperparameters.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.1"
              value={hyperparameters.temperature}
              onChange={handleTempChange}
              className="w-full accent-indigo-500 cursor-pointer h-1 rounded"
            />
          </div>

          {/* Extra Non-editable logs */}
          <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-850 flex flex-col gap-1.5 mt-2 text-slate-400 text-[9px] space-y-0.5">
            <div className="flex justify-between">
              <span>Batch Size</span>
              <span className="text-slate-300">{hyperparameters.batchSize}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount factor (γ)</span>
              <span className="text-slate-300">{hyperparameters.gamma}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device details */}
      <div className="mt-auto border-t border-slate-800 pt-3 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase font-bold">
          <Cpu size={12} className="text-emerald-400" /> Distributed Compute Cluster
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between font-mono text-[9px]">
          <span className="text-slate-500">Nodes: 8x Ray-Actor</span>
          <span className="text-emerald-500 font-semibold">Active (H100)</span>
        </div>
        <div className="flex justify-between font-mono text-[9px] text-slate-500 px-1">
          <span>Global Step: {currentStep}</span>
          <span>Epoch: {currentEpoch}</span>
        </div>
      </div>
    </div>
  );
}
