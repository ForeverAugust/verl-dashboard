/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  RLMetrics,
  LLMRolloutSample,
  GridWorldState,
  TrainingState,
  EnvironmentType,
  WSMessage,
  ActionProbability,
  GenerationStep,
  AgentRLRecord
} from './src/types';

dotenv.config();

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logging helper for external VERL pushes
function writeVerlLog(filename: string, data: any) {
  try {
    const filePath = path.join(logsDir, filename);
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data
    }) + '\n';
    fs.appendFileSync(filePath, logEntry, 'utf8');
  } catch (err: any) {
    console.error(`[Logging Error] Failed to write to ${filename}:`, err.message);
  }
}

const app = express();
const PORT = 3000;
const server = createHttpServer(app);
const wss = new WebSocketServer({ noServer: true });

// Lazy-load Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

// Global server-authoritative training state
const state: TrainingState = {
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
};

const stepToolCallCounts: Record<number, number> = {};

let cumulativeSuccessfulToolCalls = 3;
let cumulativeFailedToolCalls = 1;

// Seed initial metrics history
function initMetricsHistory() {
  cumulativeSuccessfulToolCalls = 3;
  cumulativeFailedToolCalls = 1;
  state.metricsHistory = [];
  
  // Clear stepToolCallCounts
  for (const key in stepToolCallCounts) {
    delete stepToolCallCounts[key];
  }

  state.recentToolCalls = [
    {
      id: 'tool-seed-1',
      step: 48,
      toolName: 'Calculator',
      arguments: '{"expression": "12 + 12 - 6"}',
      result: '18',
      status: 'success',
      durationMs: 45,
      timestamp: new Date(Date.now() - 30000).toISOString()
    },
    {
      id: 'tool-seed-2',
      step: 42,
      toolName: 'PythonInterpreter',
      arguments: 'def prime_test(n):\n  return all(n % i for i in range(2, n))\nprint(prime_test(17))',
      result: 'True\n',
      status: 'success',
      durationMs: 140,
      timestamp: new Date(Date.now() - 90000).toISOString()
    },
    {
      id: 'tool-seed-3',
      step: 35,
      toolName: 'WebSearch',
      arguments: '{"query": "prime factorization algorithm speed"}',
      result: 'Trial division has time complexity O(sqrt(n))...',
      status: 'success',
      durationMs: 320,
      timestamp: new Date(Date.now() - 150000).toISOString()
    },
    {
      id: 'tool-seed-4',
      step: 24,
      toolName: 'Calculator',
      arguments: '{"expression": "4 * 3"}',
      result: 'Error: ParseError at *',
      status: 'failure',
      durationMs: 25,
      timestamp: new Date(Date.now() - 300000).toISOString()
    }
  ];

  let prevCumulativeCalls = 0;
  for (let s = 0; s < 50; s++) {
    const epoch = Math.floor(s / 10);
    // Simulate learning curves
    const progress = s / 150;
    // Number of cumulative tool calls
    const cumulativeCalls = Math.floor(3 + s * 0.4 + Math.sin(s * 0.3) * 1.5);
    const stepCalls = s === 0 ? cumulativeCalls : Math.max(0, cumulativeCalls - prevCumulativeCalls);
    prevCumulativeCalls = cumulativeCalls;

    stepToolCallCounts[s] = stepCalls;

    // Success rate improves over training progress
    const successRate = Math.min(0.5 + progress * 0.42 + Math.sin(s * 0.05) * 0.02, 1.0);

    state.metricsHistory.push({
      step: s,
      epoch,
      reward: -1.5 + Math.min(progress * 2.3, 2.2) + Math.sin(s * 0.1) * 0.05,
      policyLoss: 0.6 * Math.exp(-progress * 2) + Math.random() * 0.05,
      valueLoss: 2.5 * Math.exp(-progress * 1.5) + Math.random() * 0.1,
      klDivergence: 0.01 + progress * 0.08 + Math.sin(s * 0.08) * 0.01,
      entropy: 2.8 * Math.exp(-progress * 0.6) + Math.random() * 0.05,
      learningRate: state.hyperparameters.learningRate,
      timestamp: new Date(Date.now() - (150 - s) * 10000).toISOString(),
      toolCallsCount: stepCalls,
      toolSuccessRate: successRate
    });
  }
  state.currentStep = 50;
  state.currentEpoch = 5;

  state.agentRLRecords = [
    {
      id: 'agent-rl-seed-1',
      step: 49,
      query: '计算 12 + 4 * 3 - 6 的结果，并使用计算器验证逻辑。之后判断结果是否为偶数。',
      ground_truth: '步骤：1) 4 * 3 = 12；2) 12 + 12 - 6 = 18。结果 18 是偶数。',
      agent_answer: '【Turn 1】调用 Calculator 评价表达式 `4 * 3` -> 结果为 12。\n【Turn 2】调用 Calculator 计算 `12 + 12 - 6` -> 结果为 18。\n【Turn 3】判断 18 % 2 == 0，因此 18 为偶数。\n最终回答：算式结果为 18，是一个偶数。',
      extracted_answer: '18',
      train_data_index: 1042,
      timestamp: new Date(Date.now() - 10000).toISOString(),
      reward: 1.0,
      isCorrect: true,
      turnsCount: 3
    },
    {
      id: 'agent-rl-seed-2',
      step: 47,
      query: '查询 AI 领域 RL 折扣因子 γ=0.99 时 10 步折扣和的数值。',
      ground_truth: '使用算法计算 sum(0.99**i for i in range(10))，计算结果约为 9.5618。',
      agent_answer: '【Turn 1】调用 PythonInterpreter: `print(sum(0.99**i for i in range(10)))` -> 得到 `9.561792`。\n最终回答：10 步折扣和为 9.5618。',
      extracted_answer: '9.5618',
      train_data_index: 1043,
      timestamp: new Date(Date.now() - 40000).toISOString(),
      reward: 1.0,
      isCorrect: true,
      turnsCount: 2
    },
    {
      id: 'agent-rl-seed-3',
      step: 45,
      query: '求解方程 2x + 5 = 17，计算 x 的值与 2x^2 的数值。',
      ground_truth: '2x = 12 => x = 6；2*(6^2) = 72。',
      agent_answer: '【Turn 1】2x = 12 得 x = 6。\n【Turn 2】调用 Calculator 计算 `2 * (6^2)` -> 得到 72。\n最终回答：x = 6，2x^2 = 72。',
      extracted_answer: 'x = 6, 2x^2 = 72',
      train_data_index: 1044,
      timestamp: new Date(Date.now() - 90000).toISOString(),
      reward: 1.0,
      isCorrect: true,
      turnsCount: 2
    },
    {
      id: 'agent-rl-seed-4',
      step: 40,
      query: '判定 101 是否为质数，并提供算法说明。',
      ground_truth: '101 为质数，sqrt(101) ≈ 10.04，试除 2, 3, 5, 7 均无法整除。',
      agent_answer: '【Turn 1】调用 PythonInterpreter: `print(all(101 % i != 0 for i in range(2, 11)))` -> 输出 True。\n最终回答：101 是质数。',
      extracted_answer: '101是质数',
      train_data_index: 1045,
      timestamp: new Date(Date.now() - 150000).toISOString(),
      reward: 1.0,
      isCorrect: true,
      turnsCount: 1
    }
  ];
}
initMetricsHistory();

// Initialize GridWorld State
function initGridWorld(): GridWorldState {
  return {
    gridSize: 8,
    agentPos: [0, 0],
    goalPos: [7, 7],
    obstacles: [
      [1, 2], [2, 2], [3, 2],
      [4, 4], [5, 4], [6, 4],
      [2, 5], [2, 6]
    ],
    rewards: [
      { pos: [7, 7], value: 10 },
      { pos: [3, 3], value: 1 }, // Intermediate bonus
      { pos: [1, 2], value: -5 },
      { pos: [2, 2], value: -5 },
      { pos: [3, 2], value: -5 }
    ],
    currentReward: 0,
    stepCount: 0,
    actionTaken: null,
    probabilities: [
      { action: 'UP', probability: 0.25, isChosen: false },
      { action: 'DOWN', probability: 0.25, isChosen: false },
      { action: 'LEFT', probability: 0.25, isChosen: false },
      { action: 'RIGHT', probability: 0.25, isChosen: false }
    ]
  };
}
state.activeGridWorld = initGridWorld();

// Pool of LLM Reasoning samples to draw or generate in the simulator
const mathPrompts = [
  {
    prompt: "Evaluate: 12 + 4 * 3 - 6",
    reasoning: [
      "We must evaluate using order of operations (PEMDAS/BODMAS).",
      "Step 1: Multiplication first: 4 * 3 = 12.",
      "Step 2: Replace back in equation: 12 + 12 - 6.",
      "Step 3: Perform addition and subtraction from left to right.",
      "Addition: 12 + 12 = 24.",
      "Subtraction: 24 - 6 = 18.",
      "Therefore, the final answer is 18."
    ],
    answer: "18",
    tokens: ["<think>", "We", " must", " evaluate", " using", " order", " of", " operations", " (PEMDAS", "/BODMAS", ").", "\nStep", " 1", ":", " Multiplication", " first", ":", " 4", " *", " 3", " =", " 12", ".", "\nStep", " 2", ":", " Replace", " back", " in", " equation", ":", " 12", " +", " 12", " -", " 6", ".", "\nStep", " 3", ":", " Perform", " addition", " and", " subtraction", " from", " left", " to", " right", ".", "\nAddition", ":", " 12", " +", " 12", " =", " 24", ".", "\nSubtraction", ":", " 24", " -", " 6", " =", " 18", ".", "\nTherefore", ",", " the", " final", " answer", " is", " 18", ".", "</think>", " 18"]
  },
  {
    prompt: "Find the root of 2x - 10 = 0",
    reasoning: [
      "We want to solve the linear equation 2x - 10 = 0 for x.",
      "Step 1: Add 10 to both sides: 2x = 10.",
      "Step 2: Divide both sides by 2: x = 10 / 2.",
      "Step 3: Calculate x = 5."
    ],
    answer: "5",
    tokens: ["<think>", "We", " want", " to", " solve", " the", " linear", " equation", " 2x", " -", " 10", " =", " 0", " for", " x", ".", "\nStep", " 1", ":", " Add", " 10", " to", " both", " sides", ":", " 2x", " =", " 10", ".", "\nStep", " 2", ":", " Divide", " both", " sides", " by", " 2", ":", " x", " =", " 10", " /", " 2", ".", "\nStep", " 3", ":", " Calculate", " x", " =", " 5", ".", "</think>", " 5"]
  },
  {
    prompt: "Is 17 a prime number?",
    reasoning: [
      "To check if 17 is prime, we must test for divisibility.",
      "A prime number has only two divisors: 1 and itself.",
      "We test divisibility by integers up to sqrt(17) ≈ 4.12.",
      "The prime factors to test are 2 and 3.",
      "Test 2: 17 is odd, so 17 is not divisible by 2.",
      "Test 3: Sum of digits of 17 is 1+7 = 8, which is not divisible by 3, so 17 is not divisible by 3.",
      "Since 17 is not divisible by any primes up to sqrt(17), it must be prime."
    ],
    answer: "Yes, 17 is a prime number.",
    tokens: ["<think>", "To", " check", " if", " 17", " is", " prime", ",", " we", " must", " test", " for", " divisibility", ".", "\nA", " prime", " number", " has", " only", " two", " divisors", ":", " 1", " and", " itself", ".", "\nWe", " test", " divisibility", " by", " integers", " up", " to", " sqrt", "(17", ")", " ≈", " 4", ".12", ".", "\nThe", " prime", " factors", " to", " test", " are", " 2", " and", " 3", ".", "\nTest", " 2", ":", " 17", " is", " odd", ",", " so", " 17", " is", " not", " divisible", " by", " 2", ".", "\nTest", " 3", ":", " Sum", " of", " digits", " of", " 17", " is", " 1", "+7", " =", " 8", ",", " which", " is", " not", " divisible", " by", " 3", ",", " so", " 17", " is", " not", " divisible", " by", " 3", ".", "\nSince", " 17", " is", " not", " divisible", " by", " any", " primes", " up", " to", " sqrt", "(17", "),", " it", " must", " be", " prime", ".", "</think>", " Yes", ",", " 17", " is", " a", " prime", " number", "."]
  }
];

// Active generation states for the simulated VERL LLM reasoning
let currentLLMSampleIdx = 0;
let currentLLMTokenIndex = 0;
let currentLLMSteps: GenerationStep[] = [];
let generatedText = '';

function getVocabularyForToken(token: string, stepIdx: number): ActionProbability[] {
  // Generates realistic probability distributions representing VERL policy actions.
  const vocab: { [key: string]: string[] } = {
    '<think>': ['<think>', 'To', 'First', 'Let', 'We'],
    'We': [' want', ' must', ' need', ' should', ' will'],
    'Step': [' 1', ' 2', ' 3', ' 4', ' 5'],
    '18': [' 18', ' 20', ' 12', ' 16', ' 6'],
    '5': [' 5', ' -5', ' 2', ' 10', ' 4'],
    'Yes': [' Yes', ' No', ' It', ' Maybe', ' Definitely'],
    '</think>': ['</think>', ' Therefore', ' So', ' Finally', ' Thus']
  };

  const options = vocab[token] || [token, ' the', ' a', ' and', ' of'];
  const probs: ActionProbability[] = [];
  let remainingProb = 1.0;

  options.forEach((opt, idx) => {
    let p = 0;
    if (idx === 0) {
      // The chosen token is usually the highest probability (policy rollout)
      p = 0.65 + Math.random() * 0.15;
    } else {
      p = remainingProb * (0.3 / (idx + 1));
    }
    remainingProb -= p;
    probs.push({
      action: opt,
      probability: Math.round(p * 1000) / 1000,
      isChosen: idx === 0
    });
  });

  // Normalize to 1.0
  const sum = probs.reduce((acc, x) => acc + x.probability, 0);
  probs.forEach(x => x.probability = Math.round((x.probability / sum) * 1000) / 1000);

  return probs;
}

// Tick Simulation function
function tickSimulation() {
  if (!state.isRunning) return;

  try {
    state.currentStep++;
    const isEpochTransition = state.currentStep % 20 === 0;
  if (isEpochTransition) {
    state.currentEpoch++;
  }

  // Update Global training curves
  const step = state.currentStep;
  const lastMetrics = state.metricsHistory[state.metricsHistory.length - 1];
  const progress = step / 150;

  // Simulate new tool call randomly
  let didCallTool = false;
  if (Math.random() < 0.4) {
    didCallTool = true;
    const numCalls = Math.floor(Math.random() * 3) + 1; // 1 to 3 calls
    for (let c = 0; c < numCalls; c++) {
      const tools = ['Calculator', 'PythonInterpreter', 'WebSearch', 'MathParser'];
      const toolName = tools[Math.floor(Math.random() * tools.length)];
      const isSuccess = Math.random() > Math.max(0.05, 0.25 - progress * 0.2); // Success rate goes up with training progress
      const duration = Math.floor(40 + Math.random() * 180);
      
      let args = '';
      let result = '';
      if (toolName === 'Calculator') {
        const exprs = ['4 * 3', '12 + 12', '24 - 6', '10 / 2', 'sqrt(17)'];
        args = JSON.stringify({ expression: exprs[Math.floor(Math.random() * exprs.length)] });
        result = isSuccess ? String(Math.floor(Math.random() * 100)) : 'Error: SyntaxError';
      } else if (toolName === 'PythonInterpreter') {
        args = 'def solve(): return 12 + 4 * 3\nprint(solve())';
        result = isSuccess ? '18\n' : 'SyntaxError: invalid syntax';
      } else if (toolName === 'WebSearch') {
        args = JSON.stringify({ query: 'order of operations PEMDAS rules' });
        result = 'Found: Parentheses, Exponents, Multiplication, Division...';
      } else {
        args = '\\int_0^1 x^2 dx';
        result = '0.33333';
      }

      const event = {
        id: `tool-${step}-${Math.random().toString(36).substr(2, 4)}`,
        step,
        toolName,
        arguments: args,
        result,
        status: (isSuccess ? 'success' : 'failure') as 'success' | 'failure' | 'running',
        durationMs: duration,
        timestamp: new Date().toISOString()
      };

      if (event.status === 'success') {
        cumulativeSuccessfulToolCalls++;
      } else if (event.status === 'failure') {
        cumulativeFailedToolCalls++;
      }

      state.recentToolCalls.unshift(event);
      if (state.recentToolCalls.length > 20) {
        state.recentToolCalls.pop();
      }

      stepToolCallCounts[step] = (stepToolCallCounts[step] || 0) + 1;
    }
  }

  const stepCallsCount = stepToolCallCounts[step] || 0;
  
  const totalCalls = cumulativeSuccessfulToolCalls + cumulativeFailedToolCalls;
  const currentSuccessRate = totalCalls > 0 
    ? (cumulativeSuccessfulToolCalls / totalCalls) 
    : 1.0;

  const newMetrics: RLMetrics = {
    step,
    epoch: state.currentEpoch,
    reward: Math.min((lastMetrics ? lastMetrics.reward : -1) + (Math.random() * 0.08 - 0.02) + (state.environmentType === 'llm_reasoning' ? 0.015 : 0.01), 1.0),
    policyLoss: Math.max((lastMetrics ? lastMetrics.policyLoss : 0.5) - Math.random() * 0.02 + 0.008, 0.01),
    valueLoss: Math.max((lastMetrics ? lastMetrics.valueLoss : 2) - Math.random() * 0.05 + 0.02, 0.05),
    klDivergence: Math.max((lastMetrics ? lastMetrics.klDivergence : 0.02) + (Math.random() * 0.006 - 0.002), 0.005),
    entropy: Math.max((lastMetrics ? lastMetrics.entropy : 2) - (0.01 + Math.random() * 0.01), 0.3),
    learningRate: state.hyperparameters.learningRate,
    timestamp: new Date().toISOString(),
    toolCallsCount: stepCallsCount,
    toolSuccessRate: currentSuccessRate
  };

  // Prevent stats from exceeding logical bounds
  if (state.environmentType === 'gridworld_pathfinder') {
    // Gridworld rewards can be higher
    newMetrics.reward = (lastMetrics ? lastMetrics.reward : 0) + (Math.random() * 1.5 - 0.5);
    newMetrics.reward = Math.max(-10, Math.min(newMetrics.reward, 10));
  } else {
    // LLM reward is between -1.0 and 1.0 or 0.0 and 1.0
    newMetrics.reward = Math.max(-1.0, Math.min(newMetrics.reward, 1.0));
  }

  state.metricsHistory.push(newMetrics);
  if (state.metricsHistory.length > 100) {
    state.metricsHistory.shift();
  }

  broadcast({ type: 'metrics_update', data: newMetrics });

  if (state.environmentType === 'llm_reasoning') {
    // Handle LLM Reasoning Rollout Simulation (Step-by-step)
    const promptPool = mathPrompts;
    const currentSample = promptPool[currentLLMSampleIdx];

    if (currentLLMTokenIndex < currentSample.tokens.length) {
      const nextToken = currentSample.tokens[currentLLMTokenIndex];
      const isThink = nextToken.startsWith('<think>') || (currentLLMTokenIndex > 0 && currentLLMSteps[currentLLMSteps.length - 1].token !== '</think>' && !generatedText.includes('</think>'));
      
      const stepData: GenerationStep = {
        index: currentLLMTokenIndex,
        token: nextToken,
        probabilities: getVocabularyForToken(nextToken, currentLLMTokenIndex),
        entropy: 0.5 + Math.random() * 1.5,
        type: nextToken.includes('<think>') || nextToken.includes('</think>') ? 'system' : (isThink ? 'think' : 'answer')
      };

      currentLLMSteps.push(stepData);
      generatedText += nextToken;
      currentLLMTokenIndex++;

      // Create a temporary state
      const rolloutSample: LLMRolloutSample = {
        sampleId: `sim-llm-${step}`,
        prompt: currentSample.prompt,
        generation: generatedText,
        reasoningSteps: currentLLMSteps.filter(s => s.type === 'think').map(s => s.token),
        reward: currentLLMTokenIndex === currentSample.tokens.length ? (Math.random() > 0.15 ? 1.0 : -0.2) : 0,
        isCorrect: currentLLMTokenIndex === currentSample.tokens.length ? (Math.random() > 0.15) : false,
        validationLogs: currentLLMTokenIndex === currentSample.tokens.length
          ? `[VERL Evaluator] Finished sequence generation. Output parsed: "${currentSample.answer}". Expected: "${currentSample.answer}". Reward assigned.`
          : `[VERL Evaluator] Generating rollout tokens... Sequence index: ${currentLLMTokenIndex}`,
        steps: [...currentLLMSteps]
      };

      // Set active LLM Samples
      state.activeLLMSamples = [rolloutSample];
      broadcast({ type: 'llm_sample_update', data: rolloutSample });
    } else {
      // Rollout completed. Reset sequence generator for next prompt.
      const finishedSample = currentSample;
      const isCorrect = Math.random() > 0.15;

      const newAgentRLRecord: AgentRLRecord = {
        id: `agent-rl-sim-${step}`,
        step,
        query: finishedSample.prompt,
        ground_truth: `标准参考答案: ${finishedSample.answer}`,
        agent_answer: `【Turn 1】<think>${finishedSample.reasoning.slice(0, 3).join(' ')}</think>\n【Turn 2】<think>${finishedSample.reasoning.slice(3).join(' ')}</think>\n最终解答：${finishedSample.answer}`,
        extracted_answer: String(finishedSample.answer),
        train_data_index: 2000 + currentLLMSampleIdx,
        timestamp: new Date().toISOString(),
        reward: isCorrect ? 1.0 : -0.2,
        isCorrect,
        turnsCount: 2
      };

      if (!state.agentRLRecords) state.agentRLRecords = [];
      state.agentRLRecords.unshift(newAgentRLRecord);
      if (state.agentRLRecords.length > 50) state.agentRLRecords.pop();

      writeVerlLog('agent_rl.log', newAgentRLRecord);
      broadcast({ type: 'agent_rl_update', data: newAgentRLRecord });

      currentLLMSampleIdx = (currentLLMSampleIdx + 1) % promptPool.length;
      currentLLMTokenIndex = 0;
      currentLLMSteps = [];
      generatedText = '';
    }
  } else if (state.environmentType === 'gridworld_pathfinder' && state.activeGridWorld) {
    // Simulate GridWorld Pathfinder interaction
    const gw = state.activeGridWorld;
    gw.stepCount++;

    // Intelligently move the agent closer to the goal [7,7] with some exploratory noise
    const currentPos = gw.agentPos;
    const goalPos = gw.goalPos;

    let action: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' = 'RIGHT';
    const roll = Math.random();
    // 75% greedy, 25% explore
    if (roll < 0.75) {
      const dx = goalPos[0] - currentPos[0];
      const dy = goalPos[1] - currentPos[1];
      if (dx > 0 && dy > 0) {
        action = Math.random() > 0.5 ? 'RIGHT' : 'DOWN';
      } else if (dx > 0) {
        action = 'RIGHT';
      } else if (dy > 0) {
        action = 'DOWN';
      } else {
        action = 'RIGHT';
      }
    } else {
      const actions: ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      action = actions[Math.floor(Math.random() * actions.length)];
    }

    // Apply movement
    let nextX = currentPos[0];
    let nextY = currentPos[1];
    if (action === 'UP') nextY = Math.max(0, currentPos[1] - 1);
    else if (action === 'DOWN') nextY = Math.min(gw.gridSize - 1, currentPos[1] + 1);
    else if (action === 'LEFT') nextX = Math.max(0, currentPos[0] - 1);
    else if (action === 'RIGHT') nextX = Math.min(gw.gridSize - 1, currentPos[0] + 1);

    // Obstacle collision detection
    const hitObstacle = gw.obstacles.some(obs => obs[0] === nextX && obs[1] === nextY);
    if (!hitObstacle) {
      gw.agentPos = [nextX, nextY];
    }

    // Assign rewards
    let rewardValue = -0.1; // Living penalty
    if (hitObstacle) {
      rewardValue = -2.0; // Large penalty for hitting obstacle
    } else {
      // Check specific rewards
      const specificReward = gw.rewards.find(r => r.pos[0] === nextX && r.pos[1] === nextY);
      if (specificReward) {
        rewardValue = specificReward.value;
      }
    }

    gw.currentReward += rewardValue;
    gw.actionTaken = hitObstacle ? null : action;

    // Simulate policy probabilities at this state
    const actionProbMap = { UP: 0.05, DOWN: 0.05, LEFT: 0.05, RIGHT: 0.05 };
    actionProbMap[action] = 0.75;
    // Add exploration probabilities
    const otherKeys = (Object.keys(actionProbMap) as ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')[]).filter(k => k !== action);
    otherKeys.forEach(k => actionProbMap[k] = 0.08 + Math.random() * 0.02);
    // Normalize probabilities
    const totalProb = Object.values(actionProbMap).reduce((s, x) => s + x, 0);
    gw.probabilities = (Object.keys(actionProbMap) as ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')[]).map(k => ({
      action: k,
      probability: Math.round((actionProbMap[k] / totalProb) * 100) / 100,
      isChosen: k === action
    }));

    // Check terminal condition (reached goal or maximum steps)
    if ((gw.agentPos[0] === gw.goalPos[0] && gw.agentPos[1] === gw.goalPos[1]) || gw.stepCount >= 40) {
      // Reset GridWorld
      state.activeGridWorld = initGridWorld();
    }

    broadcast({ type: 'gridworld_update', data: gw });
  }
  } catch (err) {
    console.error('[Simulation Error] Error in simulation tick:', err);
  }
}

// Simulation interval
let simInterval: NodeJS.Timeout | null = null;
function startSimulationLoop() {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(tickSimulation, state.environmentType === 'llm_reasoning' ? 700 : 300);
}

function stopSimulationLoop() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
}

// Helper to broadcast WS messages
function broadcast(msg: WSMessage) {
  try {
    const payload = JSON.stringify(msg);
    const totalClients = wss.clients.size;
    console.log(`[WebSocket Broadcast] Sending message type: "${msg.type}" to ${totalClients} active client(s). Payload size: ${payload.length} bytes.`);
    let successCount = 0;
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
          successCount++;
        } catch (err: any) {
          console.log('[WebSocket] client.send failed (client disconnected mid-send):', err.message);
        }
      }
    });
    if (totalClients > 0) {
      console.log(`[WebSocket Broadcast] Successfully sent to ${successCount}/${totalClients} clients.`);
    }
  } catch (err: any) {
    console.error('[WebSocket Broadcast Error] Error during broadcast:', err.message);
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  
  // Gracefully handle socket-level errors (e.g. abrupt client disconnection/ECONNRESET)
  ws.on('error', (err) => {
    console.log('[WebSocket] Client socket error gracefully handled:', err.message);
  });

  // Immediately send initial state sync
  if (ws.readyState === WebSocket.OPEN) {
    try {
      console.log('[WebSocket] Sending initial state sync payload to newly connected client...');
      ws.send(JSON.stringify({ type: 'state_sync', data: state }));
    } catch (err: any) {
      console.log('[WebSocket] Error sending initial state sync:', err.message);
    }
  }

  ws.on('message', async (message) => {
    try {
      const rawMsg = message.toString();
      // Print first 300 chars of incoming message for debugging
      const msgPreview = rawMsg.length > 300 ? (rawMsg.substring(0, 300) + '... [TRUNCATED]') : rawMsg;
      console.log(`[WebSocket Message Received] Raw preview: ${msgPreview}`);

      const msg: WSMessage = JSON.parse(rawMsg);
      if (!msg || typeof msg !== 'object') {
        console.warn('[WebSocket Message Received] Warning: parsed message is not a valid object');
        return;
      }
      console.log(`[WebSocket Message Received] Parsed message type: "${msg.type}"`);
      
      if (msg.type === 'control') {
        if (msg.action === 'start') {
          state.isRunning = true;
          startSimulationLoop();
          broadcast({ type: 'state_sync', data: state });
        } else if (msg.action === 'pause') {
          state.isRunning = false;
          stopSimulationLoop();
          broadcast({ type: 'state_sync', data: state });
        } else if (msg.action === 'reset') {
          state.isRunning = false;
          stopSimulationLoop();
          state.currentStep = 0;
          state.currentEpoch = 0;
          initMetricsHistory();
          state.activeGridWorld = initGridWorld();
          currentLLMTokenIndex = 0;
          currentLLMSteps = [];
          generatedText = '';
          state.activeLLMSamples = [];
          broadcast({ type: 'state_sync', data: state });
        } else if (msg.action === 'set_env') {
          state.environmentType = msg.payload as EnvironmentType;
          if (state.environmentType === 'gridworld_pathfinder') {
            state.activeGridWorld = initGridWorld();
          } else {
            currentLLMTokenIndex = 0;
            currentLLMSteps = [];
            generatedText = '';
            state.activeLLMSamples = [];
          }
          // Restart simulation if active
          if (state.isRunning) {
            startSimulationLoop();
          }
          broadcast({ type: 'state_sync', data: state });
        } else if (msg.action === 'update_hyperparams') {
          state.hyperparameters = {
            ...state.hyperparameters,
            ...msg.payload
          };
          broadcast({ type: 'state_sync', data: state });
        }
      } else if (msg.type === 'chat_request') {
        const client = getGeminiClient();
        if (!client) {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                type: 'chat_response',
                text: 'Gemini Copilot is unavailable. Please verify that your `GEMINI_API_KEY` is correctly configured in the AI Studio Secrets panel.'
              }));
            } catch (err) {
              console.log('[WebSocket] Error sending copilot unavailable response:', err);
            }
          }
          return;
        }

        // Format RL context for the LLM
        const currentReward = state.metricsHistory.length > 0 ? state.metricsHistory[state.metricsHistory.length - 1].reward : 0;
        const currentKL = state.metricsHistory.length > 0 ? state.metricsHistory[state.metricsHistory.length - 1].klDivergence : 0;
        const currentEntropy = state.metricsHistory.length > 0 ? state.metricsHistory[state.metricsHistory.length - 1].entropy : 0;
        const currentPolicyLoss = state.metricsHistory.length > 0 ? state.metricsHistory[state.metricsHistory.length - 1].policyLoss : 0;

        const rlContextPrompt = `
You are the VERL RL Copilot, an expert in Reinforcement Learning for LLMs (GRPO, PPO, etc.).
Analyze the following training telemetry and respond to the user:
- Current Step: ${state.currentStep} (Epoch ${state.currentEpoch})
- Active Environment: ${state.environmentType}
- Hyperparameters: ${JSON.stringify(state.hyperparameters)}
- Telemetry:
  * Mean Rollout Reward: ${currentReward}
  * Policy Loss: ${currentPolicyLoss}
  * KL Divergence: ${currentKL}
  * Policy Entropy: ${currentEntropy}

User question: "${msg.prompt}"

Provide actionable RL and hyperparameter tuning advice. Be technically accurate, referencing concepts like learning rates, GRPO group sizing, KL penalties, temperature scaling, and rollout length. Keep your answer highly professional, clear, and actionable.
`;

        try {
          const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: rlContextPrompt
          });
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                type: 'chat_response',
                text: response.text || 'No response text received.'
              }));
            } catch (err) {
              console.log('[WebSocket] Error sending copilot response:', err);
            }
          }
        } catch (err: any) {
          console.error('[Gemini API Error]', err);
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                type: 'chat_response',
                text: `Failed to generate expert advice: ${err.message}`,
                error: true
              }));
            } catch (err) {
              console.log('[WebSocket] Error sending copilot error response:', err);
            }
          }
        }
      }
    } catch (err: any) {
      const rawMsg = message.toString();
      const preview = rawMsg.length > 500 ? (rawMsg.substring(0, 500) + '... [TRUNCATED]') : rawMsg;
      console.error('[WebSocket] Error parsing message:', err.message, '\nRaw Message Preview:', preview);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[WebSocket] Client disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'None'}`);
  });
});

// REST Endpoint to post log data (e.g. from VERL training scripts)
app.use(express.json());

app.post('/api/logs', (req, res) => {
  try {
    const { metrics, llmSample, gridworld, toolCall, agentRLRecord, agent_rl, agentRL } = req.body || {};
    
    console.log(`[API POST /api/logs] Received log upload. Payload keys: ${Object.keys(req.body || {})}`);
    
    // Process Agent RL multi-turn log if present
    const rawAgentRL = agentRLRecord || agent_rl || agentRL;
    if (rawAgentRL) {
      console.log('[API POST /api/logs] Processing uploaded Agent RL Record:', JSON.stringify(rawAgentRL));
      const recordToSave: AgentRLRecord = {
        id: rawAgentRL.id ?? `agent-rl-${state.currentStep}-${Math.random().toString(36).substr(2, 4)}`,
        step: rawAgentRL.step ?? state.currentStep,
        query: rawAgentRL.query ?? rawAgentRL.prompt ?? '',
        ground_truth: rawAgentRL.ground_truth ?? rawAgentRL.groundTruth ?? '',
        agent_answer: rawAgentRL.agent_answer ?? rawAgentRL.agentAnswer ?? rawAgentRL.generation ?? '',
        extracted_answer: rawAgentRL.extracted_answer ?? rawAgentRL.extractedAnswer ?? '',
        train_data_index: rawAgentRL.train_data_index ?? rawAgentRL.trainDataIndex ?? 0,
        timestamp: rawAgentRL.timestamp ?? new Date().toISOString(),
        reward: rawAgentRL.reward ?? 1.0,
        isCorrect: rawAgentRL.isCorrect ?? (rawAgentRL.reward !== undefined ? rawAgentRL.reward > 0.5 : true),
        turnsCount: rawAgentRL.turnsCount ?? rawAgentRL.turns_count
      };

      if (!state.agentRLRecords) {
        state.agentRLRecords = [];
      }
      state.agentRLRecords.unshift(recordToSave);
      if (state.agentRLRecords.length > 50) {
        state.agentRLRecords.pop();
      }

      // Log to logs/agent_rl.log
      writeVerlLog('agent_rl.log', recordToSave);

      broadcast({ type: 'agent_rl_update', data: recordToSave });
    }
    
    // Process tool call first so we have accurate cumulative counters for the success rate
    if (toolCall) {
      console.log('[API POST /api/logs] Processing uploaded ToolCall:', JSON.stringify(toolCall));
      const updatedToolCall = {
        id: toolCall.id ?? `tool-${state.currentStep}-${Math.random().toString(36).substr(2, 4)}`,
        step: state.currentStep, // Ignore the uploaded toolCall.step but do not delete step from payload structure
        toolName: toolCall.toolName ?? 'Unknown',
        arguments: typeof toolCall.arguments === 'object' ? JSON.stringify(toolCall.arguments) : (toolCall.arguments ?? ''),
        result: typeof toolCall.result === 'object' ? JSON.stringify(toolCall.result) : (toolCall.result ?? ''),
        status: (toolCall.status === 'success' || toolCall.status === 'failure' || toolCall.status === 'running') ? toolCall.status : 'success',
        durationMs: toolCall.durationMs ?? 0,
        timestamp: toolCall.timestamp ?? new Date().toISOString()
      };

      if (updatedToolCall.status === 'success') {
        cumulativeSuccessfulToolCalls++;
      } else if (updatedToolCall.status === 'failure') {
        cumulativeFailedToolCalls++;
      }

      state.recentToolCalls.unshift(updatedToolCall);
      if (state.recentToolCalls.length > 20) {
        state.recentToolCalls.pop();
      }

      // Log toolcall to logs/toolcalls.log
      writeVerlLog('toolcalls.log', updatedToolCall);

      const tcStep = updatedToolCall.step;
      stepToolCallCounts[tcStep] = (stepToolCallCounts[tcStep] || 0) + 1;

      // Update the existing metrics history entry if it exists
      const existingMetric = state.metricsHistory.find(m => m.step === tcStep);
      if (existingMetric) {
        existingMetric.toolCallsCount = stepToolCallCounts[tcStep];
        broadcast({ type: 'metrics_update', data: existingMetric });
      }

      broadcast({ type: 'tool_call_event', data: updatedToolCall });
    }

    // Process metrics second with calculated success rate
    if (metrics) {
      console.log('[API POST /api/logs] Processing uploaded Metrics:', JSON.stringify(metrics));
      
      const totalCalls = cumulativeSuccessfulToolCalls + cumulativeFailedToolCalls;
      const calculatedSuccessRate = totalCalls > 0 
        ? (cumulativeSuccessfulToolCalls / totalCalls) 
        : 1.0;

      const mStep = metrics.step ?? state.currentStep + 1;
      
      // Calculate stepCallsCount from either tracking or uploaded step difference
      let stepCallsCount = stepToolCallCounts[mStep] || 0;
      if (stepCallsCount === 0 && metrics.toolCallsCount !== undefined && metrics.toolCallsCount !== null) {
        const prevMetric = state.metricsHistory[state.metricsHistory.length - 1];
        const lastCumulative = prevMetric ? prevMetric.toolCallsCount : 0;
        if (metrics.toolCallsCount >= lastCumulative) {
          stepCallsCount = metrics.toolCallsCount - lastCumulative;
        } else {
          stepCallsCount = metrics.toolCallsCount;
        }
        stepToolCallCounts[mStep] = stepCallsCount;
      }

      const updatedMetrics: RLMetrics = {
        step: mStep,
        epoch: metrics.epoch ?? state.currentEpoch,
        reward: metrics.reward ?? 0,
        policyLoss: metrics.policyLoss ?? 0,
        valueLoss: metrics.valueLoss ?? 0,
        klDivergence: metrics.klDivergence ?? 0,
        entropy: metrics.entropy ?? 0,
        learningRate: metrics.learningRate ?? state.hyperparameters.learningRate,
        timestamp: new Date().toISOString(),
        toolCallsCount: stepCallsCount,
        toolSuccessRate: calculatedSuccessRate
      };
      state.currentStep = updatedMetrics.step;
      state.currentEpoch = updatedMetrics.epoch;

      // Ensure we don't have duplicate step entries
      const dupIdx = state.metricsHistory.findIndex(m => m.step === mStep);
      if (dupIdx !== -1) {
        state.metricsHistory[dupIdx] = updatedMetrics;
      } else {
        state.metricsHistory.push(updatedMetrics);
        if (state.metricsHistory.length > 100) {
          state.metricsHistory.shift();
        }
      }

      // Log metrics to logs/metrics.log
      writeVerlLog('metrics.log', updatedMetrics);

      broadcast({ type: 'metrics_update', data: updatedMetrics });
    }

    if (llmSample) {
      console.log('[API POST /api/logs] Processing uploaded LLMRolloutSample:', {
        sampleId: llmSample.sampleId,
        promptPreview: (llmSample.original_question || llmSample.prompt)?.substring(0, 100),
        generationPreview: llmSample.generation?.substring(0, 100),
        reward: llmSample.reward,
        isCorrect: llmSample.isCorrect,
        stepsCount: llmSample.steps?.length,
        trajectoryStepsCount: llmSample.trajectory?.length,
        reasoningStepsCount: llmSample.reasoningSteps?.length
      });
      state.environmentType = 'llm_reasoning';
      state.activeLLMSamples = [llmSample];
      broadcast({ type: 'llm_sample_update', data: llmSample });
    }

    if (gridworld) {
      console.log('[API POST /api/logs] Processing uploaded GridWorldState:', {
        gridSize: gridworld.grid?.length,
        stepCount: gridworld.stepCount,
        agentPos: gridworld.agentPos,
        targetPos: gridworld.targetPos,
        isCompleted: gridworld.isCompleted
      });
      state.environmentType = 'gridworld_pathfinder';
      state.activeGridWorld = gridworld;
      broadcast({ type: 'gridworld_update', data: gridworld });
    }

    res.json({ success: true, message: 'Logs received and broadcast successfully.' });
  } catch (err: any) {
    console.error('[API POST /api/logs Error] Unexpected error processing uploaded logs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upgrade HTTP Server to handle websocket connection at /ws
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? request.url.split('?')[0] : '';
  console.log(`[HTTP Upgrade Request] url: ${request.url}, pathname: ${pathname}`);
  
  if (pathname === '/ws' || pathname === '/ws/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // If not /ws, do NOT call socket.destroy(). Let other upgrade handlers (like Vite) process it.
});

// Integrate Vite Middleware
async function startApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[VERL Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startApp();
