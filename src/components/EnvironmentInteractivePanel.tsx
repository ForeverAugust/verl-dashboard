/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMRolloutSample, GridWorldState, EnvironmentType, GenerationStep } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Eye, ShieldAlert, Award, FileText } from 'lucide-react';

interface EnvironmentInteractivePanelProps {
  envType: EnvironmentType;
  activeLLMSample: LLMRolloutSample | null;
  activeGridWorld: GridWorldState | null;
  onSelectToken: (step: GenerationStep) => void;
  selectedTokenIdx: number | null;
}

export default function EnvironmentInteractivePanel({
  envType,
  activeLLMSample,
  activeGridWorld,
  onSelectToken,
  selectedTokenIdx
}: EnvironmentInteractivePanelProps) {

  // Handle LLM Rendering Mode
  if (envType === 'llm_reasoning') {
    const sample = activeLLMSample || {
      sampleId: 'waiting',
      prompt: 'Waiting for training step...',
      original_question: '',
      generation: '',
      reasoningSteps: [],
      reward: 0,
      isCorrect: false,
      validationLogs: 'Connecting to WebSocket...',
      steps: [],
      trajectory: []
    };

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[480px]" id="env-llm-container">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="text-emerald-400" size={18} />
            <span className="font-sans font-medium text-slate-200 text-sm">Rollout Generation (逐步 Token 生成)</span>
          </div>
          <span className="font-mono text-xs text-slate-500">Sample ID: {sample.sampleId}</span>
        </div>

        {/* Prompt Header */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mb-3">
          <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold block mb-1">PROMPT / QUESTION</span>
          <p className="text-slate-200 text-xs font-sans font-medium">{sample.original_question || sample.prompt}</p>
        </div>

        {/* Live Terminal Token-by-Token Generation Area */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 mb-3">
            {/* Scrolling Terminal Tokens */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-xs leading-relaxed flex flex-col">
              <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold block mb-2 border-b border-slate-800 pb-1">ROLLOUT SEQUENCE</span>
              <div className="flex-1">
                {!sample.steps || sample.steps.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-600 italic">
                    No steps or trajectory generated yet. Click "Start Training" in the sidebar or run your training script to upload rollout trajectory...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 items-start">
                    {sample.steps.map((step, idx) => {
                      const isSelected = selectedTokenIdx === step.index;
                      let bgClass = 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border-slate-800';
                      
                      if (step.type === 'system') {
                        bgClass = 'bg-indigo-950/40 text-indigo-300 border-indigo-900/50 hover:bg-indigo-950/80';
                      } else if (step.type === 'think') {
                        bgClass = 'bg-slate-900/90 text-amber-400/90 border-amber-950/50 hover:bg-amber-900/20';
                      } else if (step.type === 'answer') {
                        bgClass = 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/50';
                      }

                      if (isSelected) {
                        bgClass += ' ring-2 ring-indigo-500 border-transparent';
                      }

                      return (
                        <motion.span
                          key={idx}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => onSelectToken(step)}
                          className={`px-1.5 py-0.5 rounded border text-xs cursor-pointer select-none transition-all ${bgClass}`}
                          title={`Token probabilities (Entropy: ${step.entropy.toFixed(3)})`}
                        >
                          {step.token === '\nStep' ? '\nStep' : step.token}
                        </motion.span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Validation Logs */}
            <div className="w-full md:w-[220px] bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col justify-between font-mono text-[10px]">
              <div className="flex-1 overflow-y-auto text-slate-400 mb-2 whitespace-pre-line">
                <span className="text-[10px] text-amber-400 uppercase font-bold block mb-2 border-b border-slate-800 pb-1">VERIFIER LOGS</span>
                {sample.validationLogs}
              </div>
              {sample.reward !== 0 && (
                <div className="border-t border-slate-800 pt-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase">OUTCOME</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sample.isCorrect ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-rose-950 text-rose-400 border border-rose-900'}`}>
                      {sample.isCorrect ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase">REWARD</span>
                    <span className={`text-xs font-bold ${sample.reward > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {sample.reward.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    );
  }

  // Handle GridWorld Pathfinder Rendering Mode
  const gw = activeGridWorld || {
    gridSize: 8,
    agentPos: [0, 0],
    goalPos: [7, 7],
    obstacles: [],
    rewards: [],
    currentReward: 0,
    stepCount: 0,
    actionTaken: null
  };

  const cells = [];
  for (let y = 0; y < gw.gridSize; y++) {
    for (let x = 0; x < gw.gridSize; x++) {
      const isAgent = gw.agentPos[0] === x && gw.agentPos[1] === y;
      const isGoal = gw.goalPos[0] === x && gw.goalPos[1] === y;
      const isObstacle = gw.obstacles.some(obs => obs[0] === x && obs[1] === y);
      const isSpecialReward = gw.rewards.find(r => r.pos[0] === x && r.pos[1] === y && r.value > 0);
      
      cells.push({ x, y, isAgent, isGoal, isObstacle, isSpecialReward });
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[480px]" id="env-gridworld-container">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Eye className="text-indigo-400" size={18} />
          <span className="font-sans font-medium text-slate-200 text-sm">GridWorld Pathfinder Visualizer</span>
        </div>
        <div className="flex gap-3 text-xs font-mono text-slate-400">
          <span>Steps: {gw.stepCount}/40</span>
          <span className="text-emerald-400">Reward: {gw.currentReward.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center gap-6">
        {/* Rendered Grid Stage */}
        <div className="aspect-square h-full max-h-[340px] bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-8 gap-1.5 shadow-2xl relative">
          {cells.map((cell, idx) => {
            let bgClass = 'bg-slate-900 border border-slate-800/60';
            
            if (cell.isObstacle) {
              bgClass = 'bg-slate-800 border-transparent shadow-inner';
            } else if (cell.isGoal) {
              bgClass = 'bg-emerald-950/40 border-emerald-500/30';
            } else if (cell.isSpecialReward) {
              bgClass = 'bg-amber-950/20 border-amber-500/30';
            }

            return (
              <div
                key={idx}
                className={`relative rounded-md flex items-center justify-center transition-all duration-200 ${bgClass}`}
              >
                {cell.isGoal && (
                  <Award className="text-emerald-400 animate-pulse absolute" size={16} />
                )}
                
                {cell.isSpecialReward && !cell.isGoal && (
                  <span className="text-amber-400 text-[10px] font-mono font-bold absolute">+1</span>
                )}

                {cell.isAgent && (
                  <motion.div
                    layoutId="agent-token"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="w-5 h-5 rounded-full bg-indigo-500 border border-white flex items-center justify-center shadow-lg shadow-indigo-500/50 absolute z-10"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend / Status Info */}
        <div className="w-full md:w-[220px] flex flex-col justify-between font-sans text-xs bg-slate-950/50 border border-slate-800/40 rounded-lg p-3 h-full max-h-[340px]">
          <div>
            <h4 className="font-semibold text-slate-300 border-b border-slate-800 pb-1.5 mb-2.5">Environment Assets</h4>
            <div className="space-y-2.5 font-mono text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-indigo-500 border border-white shadow-md shadow-indigo-500/20" />
                <span className="text-slate-300">Agent (Policy $\pi_\theta$)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-emerald-950 border border-emerald-500/40 flex items-center justify-center">
                  <Award size={10} className="text-emerald-400" />
                </div>
                <span className="text-slate-300">Goal State (+10.0 Reward)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-amber-950/40 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  +1
                </div>
                <span className="text-slate-300">Bonus State (+1.0 Reward)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-slate-800" />
                <span className="text-slate-300">Obstacle (-2.0 Collision)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2.5">
            <span className="text-[10px] text-slate-500 block">LAST ACTION</span>
            <span className="text-xs font-mono font-bold text-indigo-400 block mt-0.5">
              {gw.actionTaken ? `MOVE ${gw.actionTaken}` : 'STAY (COLLISION)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
