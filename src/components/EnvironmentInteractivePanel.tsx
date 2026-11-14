/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LLMRolloutSample, GridWorldState, EnvironmentType, GenerationStep } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Eye, ShieldAlert, Award, FileText, Cpu, User, Clock, Layers, MessageSquare, Code } from 'lucide-react';

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

  const [selectedStepId, setSelectedStepId] = useState<string | number | null>(null);

  // Automatically select the first trajectory step when a sample with a trajectory is received
  useEffect(() => {
    if (activeLLMSample?.trajectory && activeLLMSample.trajectory.length > 0) {
      const stepIds = activeLLMSample.trajectory.map(t => t.step_id);
      if (selectedStepId === null || !stepIds.includes(selectedStepId)) {
        setSelectedStepId(activeLLMSample.trajectory[0].step_id);
      }
    }
  }, [activeLLMSample, selectedStepId]);

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

    const hasTrajectory = sample.trajectory && sample.trajectory.length > 0;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[480px]" id="env-llm-container">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="text-emerald-400" size={18} />
            <span className="font-sans font-medium text-slate-200 text-sm">Rollout Trajectory (推理轨迹)</span>
          </div>
          <span className="font-mono text-xs text-slate-500">Sample ID: {sample.sampleId}</span>
        </div>

        {/* Prompt Header */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mb-3">
          <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold block mb-1">PROMPT / QUESTION</span>
          <p className="text-slate-200 text-xs font-sans font-medium">{sample.original_question || sample.prompt}</p>
        </div>

        {/* Dynamic Area based on whether SDK reported high-level trajectory steps or low-level tokens */}
        {hasTrajectory ? (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 mb-3">
            {/* Timeline Selector */}
            <div className="w-full md:w-[240px] bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto flex flex-col">
              <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold block mb-2 border-b border-slate-800 pb-1">TRAJECTORY PATHWAY</span>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {sample.trajectory?.map((step, idx) => {
                  const isSelected = selectedStepId === step.step_id;
                  let typeBg = 'bg-slate-800/60 text-slate-400 border-slate-800';
                  if (step.step_type === 'think') {
                    typeBg = 'bg-amber-950/40 text-amber-400 border-amber-900/30';
                  } else if (step.step_type === 'tool' || step.step_type === 'call') {
                    typeBg = 'bg-blue-950/40 text-blue-400 border-blue-900/30';
                  } else if (step.step_type === 'user') {
                    typeBg = 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30';
                  } else if (step.step_type === 'assistant') {
                    typeBg = 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30';
                  }

                  const previewText = step.state || step.user_turns || step.assistant_turns || '';
                  const shortPreview = typeof previewText === 'object' 
                    ? JSON.stringify(previewText).substring(0, 45) 
                    : (previewText.length > 45 ? previewText.substring(0, 45) + '...' : previewText);

                  return (
                    <div
                      key={step.step_id || idx}
                      onClick={() => setSelectedStepId(step.step_id)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-950/50'
                          : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] text-slate-500">Step #{step.step_id}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold tracking-wider uppercase ${typeBg}`}>
                          {step.step_type}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] line-clamp-2 mb-1 font-sans">
                        {shortPreview || '(No text content)'}
                      </p>
                      {step.timestamp && (
                        <div className="flex items-center gap-1 text-[9px] text-slate-600 font-mono mt-1">
                          <Clock size={10} />
                          <span>{step.timestamp.includes('T') ? step.timestamp.split('T')[1].substring(0, 8) : step.timestamp}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Details Inspector */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col min-h-0 overflow-y-auto">
              {(() => {
                const currentStep = sample.trajectory?.find(t => t.step_id === selectedStepId) || sample.trajectory?.[0];
                if (!currentStep) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-slate-600 italic text-xs">
                      No trajectory step selected.
                    </div>
                  );
                }

                return (
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <div className="flex items-center gap-2">
                        <Layers className="text-indigo-400" size={14} />
                        <span className="font-sans font-bold text-slate-200 text-xs uppercase">Step #{currentStep.step_id} Details</span>
                      </div>
                      {currentStep.timestamp && (
                        <span className="text-[10px] text-slate-500 font-mono">{currentStep.timestamp}</span>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                      {/* User turns if any */}
                      {currentStep.user_turns && (
                        <div className="space-y-1">
                          <span className="text-[9px] text-indigo-400 font-mono uppercase font-bold flex items-center gap-1">
                            <User size={10} /> User Query / Input
                          </span>
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
                            {typeof currentStep.user_turns === 'object' ? JSON.stringify(currentStep.user_turns, null, 2) : currentStep.user_turns}
                          </div>
                        </div>
                      )}

                      {/* Assistant turns if any */}
                      {currentStep.assistant_turns && (
                        <div className="space-y-1">
                          <span className="text-[9px] text-emerald-400 font-mono uppercase font-bold flex items-center gap-1">
                            <Cpu size={10} /> Assistant Output / Agent Response
                          </span>
                          <div className="bg-slate-900/60 border border-emerald-950/40 rounded-lg p-2.5 text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
                            {typeof currentStep.assistant_turns === 'object' ? JSON.stringify(currentStep.assistant_turns, null, 2) : currentStep.assistant_turns}
                          </div>
                        </div>
                      )}

                      {/* State if any */}
                      {currentStep.state && (
                        <div className="space-y-1">
                          <span className="text-[9px] text-amber-400 font-mono uppercase font-bold flex items-center gap-1">
                            <Code size={10} /> State / Observations
                          </span>
                          <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-2.5 text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[160px]">
                            {currentStep.state}
                          </div>
                        </div>
                      )}

                      {/* Payload data if any */}
                      {currentStep.data && (
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-400 font-mono uppercase font-bold">
                            Additional Metadata / Metrics Payload
                          </span>
                          <pre className="bg-slate-900/20 border border-slate-800/40 rounded-lg p-2.5 text-slate-400 font-mono text-[10px] leading-tight overflow-x-auto max-h-[160px]">
                            {JSON.stringify(currentStep.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* Live Terminal Token-by-Token Generation Area (Legacy Fallback) */
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
        )}
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
