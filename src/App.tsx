/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { TrainingState, EnvironmentType, RLMetrics, LLMRolloutSample, GridWorldState, WSMessage, GenerationStep, AgentRLRecord } from './types';
import Sidebar from './components/Sidebar';
import MetricsPanel from './components/MetricsPanel';
import EnvironmentInteractivePanel from './components/EnvironmentInteractivePanel';
import ActionDistributionPanel from './components/ActionDistributionPanel';
import PythonCodeSnippet from './components/PythonCodeSnippet';
import ToolCallPanel from './components/ToolCallPanel';
import AgentRLPanel from './components/AgentRLPanel';
import { Activity, Terminal, Layers, RefreshCcw, Wifi } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

export default function App() {
  // Client state synced from the server
  const [state, setState] = useState<TrainingState>({
    isRunning: false,
    currentStep: 0,
    currentEpoch: 0,
    environmentType: 'llm_reasoning',
    metricsHistory: [],
    activeLLMSamples: [],
    activeGridWorld: null,
    recentToolCalls: [],
    agentRLRecords: [],
    hyperparameters: {
      learningRate: 1e-5,
      klCoeff: 0.05,
      batchSize: 64,
      temperature: 0.7,
      gamma: 0.99
    }
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'sandbox' | 'sdk'>('sandbox');
  const [selectedToken, setSelectedToken] = useState<GenerationStep | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  // Auto-connect and reconnect WebSockets
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`[WS] Connecting to ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) {
          ws.close();
          return;
        }
        console.log('[WS] Connected');
        setWsConnected(true);
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        console.log('[WS] Disconnected, scheduled reconnect...');
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg: WSMessage = JSON.parse(event.data);
          
          if (msg.type === 'state_sync') {
            setState(msg.data);
            // Default select the latest token of the active sample if present
            if (msg.data.environmentType === 'llm_reasoning' && msg.data.activeLLMSamples.length > 0) {
              const sample = msg.data.activeLLMSamples[0];
              if (sample.steps.length > 0) {
                setSelectedToken(sample.steps[sample.steps.length - 1]);
              }
            } else {
              setSelectedToken(null);
            }
          } else if (msg.type === 'metrics_update') {
            setState(prev => {
              const metricsHistory = [...prev.metricsHistory, msg.data];
              if (metricsHistory.length > 100) metricsHistory.shift();
              return {
                ...prev,
                currentStep: msg.data.step,
                currentEpoch: msg.data.epoch,
                metricsHistory
              };
            });
          } else if (msg.type === 'llm_sample_update') {
            setState(prev => ({
              ...prev,
              activeLLMSamples: [msg.data]
            }));
            // Automatically focus on the newly produced token
            if (msg.data.steps.length > 0) {
              setSelectedToken(msg.data.steps[msg.data.steps.length - 1]);
            }
          } else if (msg.type === 'gridworld_update') {
            setState(prev => ({
              ...prev,
              activeGridWorld: msg.data
            }));
          } else if (msg.type === 'tool_call_event') {
            setState(prev => {
              const recentToolCalls = [msg.data, ...(prev.recentToolCalls || [])];
              if (recentToolCalls.length > 20) recentToolCalls.pop();
              return {
                ...prev,
                recentToolCalls
              };
            });
          } else if (msg.type === 'agent_rl_update') {
            setState(prev => {
              const agentRLRecords = [msg.data, ...(prev.agentRLRecords || [])];
              if (agentRLRecords.length > 50) agentRLRecords.pop();
              return {
                ...prev,
                agentRLRecords
              };
            });
          }
        } catch (err) {
          console.error('[WS Error] Error decoding payload', err);
        }
      };

      ws.onerror = (err) => {
        if (isUnmounted) return;
        // Log gracefully since disconnections/reconnections are a normal part of development server restarts
        console.log('[WS Graceful Error] WebSocket state transition or routine fluctuation:', err);
      };
    }

    connect();

    return () => {
      isUnmounted = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Dispatch helpers
  const sendWSMessage = (msg: WSMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  const handleControl = (action: 'start' | 'pause' | 'reset') => {
    sendWSMessage({ type: 'control', action });
  };

  const handleSetEnv = (env: EnvironmentType) => {
    sendWSMessage({ type: 'control', action: 'set_env', payload: env });
  };

  const handleUpdateHyperparams = (params: any) => {
    sendWSMessage({ type: 'control', action: 'update_hyperparams', payload: params });
  };



  // Extract key summary statistics
  const latestMetric = state.metricsHistory[state.metricsHistory.length - 1] || {
    reward: 0,
    policyLoss: 0,
    klDivergence: 0
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="app-root">
      {/* Top Main Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center justify-between" id="dashboard-header">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Activity className="text-white" size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-sans font-extrabold text-slate-100 text-sm tracking-tight">VERL Core RL</h1>
              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono font-semibold px-1.5 py-0.5 rounded border border-slate-700/60">v0.4.1</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Hybrid Flow Reinforcement Learning Dashboard</p>
          </div>
        </div>

        {/* Dynamic micro stats line */}
        <div className="hidden lg:flex items-center gap-6 font-mono text-[10.5px]">
          <div className="flex flex-col">
            <span className="text-slate-500 uppercase tracking-wider text-[8px]">Global Step</span>
            <span className="text-slate-200 font-bold">{state.currentStep}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 uppercase tracking-wider text-[8px]">Current Epoch</span>
            <span className="text-slate-200 font-bold">{state.currentEpoch}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 uppercase tracking-wider text-[8px]">Mean Reward</span>
            <span className="text-emerald-400 font-bold">{latestMetric.reward.toFixed(4)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 uppercase tracking-wider text-[8px]">KL Div</span>
            <span className="text-sky-400 font-bold">{latestMetric.klDivergence.toFixed(4)}</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${activeTab === 'sandbox' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Activity size={13} /> Interactive Sandbox
          </button>
          <button
            onClick={() => setActiveTab('sdk')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${activeTab === 'sdk' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Terminal size={13} /> Python Callback SDK
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 flex flex-col lg:flex-row gap-5" id="main-dashboard-body">
        {/* Left Side: Sidebar Panel */}
        <aside className="w-full lg:w-[280px] shrink-0" id="aside-panel">
          <Sidebar
            isRunning={state.isRunning}
            currentStep={state.currentStep}
            currentEpoch={state.currentEpoch}
            envType={state.environmentType}
            wsConnected={wsConnected}
            hyperparameters={state.hyperparameters}
            onControl={handleControl}
            onSetEnv={handleSetEnv}
            onUpdateHyperparams={handleUpdateHyperparams}
          />
        </aside>

        {/* Right Side: Primary tabs content container */}
        <main className="flex-1 min-w-0" id="primary-content-container">
          {activeTab === 'sandbox' && (
            <div className="flex flex-col gap-5">
              {/* Environment Visualizer and Action Distribution Panel */}
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                <div className="xl:col-span-3">
                  <EnvironmentInteractivePanel
                    envType={state.environmentType}
                    activeLLMSample={state.activeLLMSamples[0] || null}
                    activeGridWorld={state.activeGridWorld}
                    onSelectToken={(t) => setSelectedToken(t)}
                    selectedTokenIdx={selectedToken?.index ?? null}
                  />
                </div>
                
                <div className="xl:col-span-2">
                  <ActionDistributionPanel
                    probabilities={
                      state.environmentType === 'llm_reasoning'
                        ? (selectedToken?.probabilities || [])
                        : (state.activeGridWorld?.probabilities || [])
                    }
                    entropy={
                      state.environmentType === 'llm_reasoning'
                        ? selectedToken?.entropy
                        : (state.activeGridWorld?.probabilities ? 0.35 : undefined)
                    }
                    title={
                      state.environmentType === 'llm_reasoning'
                        ? `Token Vocabulary Probabilities ("${selectedToken?.token || ''}")`
                        : "GridWorld Policy Action Distribution"
                    }
                    subheading={
                      state.environmentType === 'llm_reasoning'
                        ? `Vocabulary index: ${selectedToken?.index ?? 0}. Showing top soft-max output probabilities.`
                        : "Discrete action transition probabilities π(a|s)"
                    }
                  />
                </div>
              </div>

              {/* Dynamic Metrics Tracking Area */}
              <section className="border-t border-slate-800/50 pt-4">
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <h2 className="font-sans font-bold text-slate-200 text-sm tracking-tight">Active Training Curve Diagnostics</h2>
                </div>
                <MetricsPanel metricsHistory={state.metricsHistory} />
              </section>

              {/* Tool Tracing Diagnostics Area */}
              <section className="border-t border-slate-800/50 pt-4" id="tool-diagnostics-section">
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  <h2 className="font-sans font-bold text-slate-200 text-sm tracking-tight">Dynamic Tool Invocations & Usage Trends</h2>
                </div>
                <ToolCallPanel metricsHistory={state.metricsHistory} recentToolCalls={state.recentToolCalls || []} />
              </section>

              {/* Multi-Turn Agent RL Results Panel */}
              <section className="border-t border-slate-800/50 pt-4" id="agent-rl-results-section">
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  <h2 className="font-sans font-bold text-slate-200 text-sm tracking-tight">多轮 Agent RL 结果与评估数据 (Multi-Turn Evaluation Logs)</h2>
                </div>
                <AgentRLPanel records={state.agentRLRecords || []} />
              </section>
            </div>
          )}

          {activeTab === 'sdk' && (
            <div className="flex flex-col gap-4">
              <div className="bg-indigo-950/20 border border-indigo-900/40 p-4 rounded-xl max-w-3xl">
                <h2 className="font-sans font-bold text-indigo-300 text-sm mb-1">Inject Live Logs from your GPU / Cluster Runs</h2>
                <p className="text-slate-400 text-xs leading-relaxed">
                  By default, this dashboard runs high-fidelity simulated tasks authoritatively on port 3000. 
                  However, you can connect your **real python training loop** (such as a VERL PPO trainer run) 
                  by sending HTTP POST requests to this container's API. The dashboard will immediately override the simulation and switch to your live feed!
                </p>
              </div>
              <PythonCodeSnippet />
            </div>
          )}


        </main>
      </div>
    </div>
  );
}
