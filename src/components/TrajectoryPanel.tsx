/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LLMRolloutSample } from '../types';
import { Route, Clock, Layers, User, Cpu, Code, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';

interface TrajectoryPanelProps {
  sample: LLMRolloutSample | null;
}

export default function TrajectoryPanel({ sample }: TrajectoryPanelProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Automatically select the first trajectory step when a sample with a trajectory is received
  useEffect(() => {
    if (sample?.trajectory && sample.trajectory.length > 0) {
      const stepIds = sample.trajectory.map(t => t.step_id);
      if (selectedStepId === null || !stepIds.includes(selectedStepId)) {
        setSelectedStepId(sample.trajectory[0].step_id);
      }
    }
  }, [sample, selectedStepId]);

  const trajectory = sample?.trajectory || [];
  const hasTrajectory = trajectory.length > 0;
  const currentStep = trajectory.find(t => t.step_id === selectedStepId) || trajectory[0];

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col ${isCollapsed ? '' : 'min-h-[480px] h-[calc(100vh-220px)]'}`}
      id="trajectory-panel"
    >
      {/* Panel Header (click to collapse / expand) */}
      <div
        onClick={() => setIsCollapsed(prev => !prev)}
        className={`flex items-center justify-between cursor-pointer select-none group ${
          isCollapsed ? '' : 'border-b border-slate-800 pb-2 mb-3'
        }`}
        title={isCollapsed ? '展开轨迹详情' : '收起轨迹详情'}
      >
        <div className="flex items-center gap-2">
          <Route className="text-indigo-400" size={18} />
          <span className="font-sans font-medium text-slate-200 text-sm">Rollout Trajectory (推理轨迹)</span>
          {trajectory.length > 0 && (
            <span className="text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded-full">
              {trajectory.length} steps
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500">Sample ID: {sample?.sampleId || 'waiting'}</span>
          <span className="text-slate-400 group-hover:text-slate-200 p-1 flex items-center transition-colors">
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Prompt Header */}
          {(sample?.original_question || sample?.prompt) && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mb-3">
              <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold block mb-1">PROMPT / QUESTION</span>
              <p className="text-slate-200 text-xs font-sans font-medium">{sample.original_question || sample.prompt}</p>
            </div>
          )}

          {/* Timeline + Inspector, or empty state when no trajectory pushed yet */}
          {!hasTrajectory ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-2 text-center max-w-md">
                <Sparkles className="text-slate-600 mb-1" size={24} />
                <p className="text-slate-400 text-xs font-medium">暂无轨迹数据 (No trajectory data yet)</p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  当前 Rollout 样本未包含 trajectory 字段。启动训练或通过 Python API 推送包含
                  <code className="text-slate-500 font-mono mx-1">trajectory</code>
                  的 JSON 数据后，这里将展示逐步的推理轨迹（think / tool / user / assistant 轮次）。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
              {/* Timeline Selector */}
              <div className="w-full md:w-[280px] bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto flex flex-col shrink-0">
                <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold block mb-2 border-b border-slate-800 pb-1">
                  TRAJECTORY PATHWAY ({trajectory.length} steps)
                </span>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {trajectory.map((step, idx) => {
                    const isSelected = currentStep?.step_id === step.step_id;
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
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-2.5 text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[240px]">
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
                            <pre className="bg-slate-900/20 border border-slate-800/40 rounded-lg p-2.5 text-slate-400 font-mono text-[10px] leading-tight overflow-x-auto max-h-[240px]">
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
          )}
        </>
      )}
    </div>
  );
}
