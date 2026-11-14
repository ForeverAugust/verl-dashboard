/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RLMetrics {
  step: number;
  epoch: number;
  reward: number;
  policyLoss: number;
  valueLoss: number;
  klDivergence: number;
  entropy: number;
  learningRate: number;
  timestamp: string;
  toolCallsCount: number;
  toolSuccessRate: number;
}

export interface ActionProbability {
  action: string;
  probability: number;
  isChosen: boolean;
}

export interface GenerationStep {
  index: number;
  token: string;
  probabilities: ActionProbability[];
  entropy: number;
  type: 'think' | 'answer' | 'system';
}

export interface TrajectoryStep {
  step_id: string | number;
  step_type: string;
  state?: string;
  timestamp?: string;
  user_turns?: any;
  assistant_turns?: any;
  data?: any;
}

export interface LLMRolloutSample {
  sampleId: string;
  prompt?: string;
  original_question?: string;
  generation?: string;
  reasoningSteps?: string[];
  reward: number;
  isCorrect?: boolean;
  validationLogs?: string;
  steps?: GenerationStep[];
  trajectory?: TrajectoryStep[];
}

export interface GridWorldState {
  gridSize: number;
  agentPos: [number, number];
  goalPos: [number, number];
  obstacles: [number, number][];
  rewards: { pos: [number, number]; value: number }[];
  currentReward: number;
  stepCount: number;
  actionTaken: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'STAY' | null;
  probabilities: ActionProbability[];
}

export interface ToolCallEvent {
  id: string;
  step: number;
  toolName: string;
  arguments: string;
  result: string;
  status: 'success' | 'failure' | 'running';
  durationMs: number;
  timestamp: string;
}

export interface AgentRLRecord {
  id: string;
  step?: number;
  query: string;
  ground_truth: string;
  agent_answer: string;
  extracted_answer?: string;
  train_data_index: number | string;
  timestamp?: string;
  reward?: number;
  isCorrect?: boolean;
  turnsCount?: number;
}

export type EnvironmentType = 'llm_reasoning' | 'gridworld_pathfinder';

export interface TrainingState {
  isRunning: boolean;
  currentStep: number;
  currentEpoch: number;
  environmentType: EnvironmentType;
  metricsHistory: RLMetrics[];
  activeLLMSamples: LLMRolloutSample[];
  activeGridWorld: GridWorldState | null;
  recentToolCalls: ToolCallEvent[];
  agentRLRecords: AgentRLRecord[];
  hyperparameters: {
    learningRate: number;
    klCoeff: number;
    batchSize: number;
    temperature: number;
    gamma: number;
  };
}

export type WSMessage =
  | { type: 'metrics_update'; data: RLMetrics }
  | { type: 'llm_sample_update'; data: LLMRolloutSample }
  | { type: 'gridworld_update'; data: GridWorldState }
  | { type: 'tool_call_event'; data: ToolCallEvent }
  | { type: 'agent_rl_update'; data: AgentRLRecord }
  | { type: 'state_sync'; data: TrainingState }
  | { type: 'control'; action: 'start' | 'pause' | 'reset' | 'set_env' | 'update_hyperparams'; payload?: any }
  | { type: 'chat_request'; prompt: string; history: { role: 'user' | 'model'; parts: { text: string }[] }[] }
  | { type: 'chat_response'; text: string; error?: boolean };
