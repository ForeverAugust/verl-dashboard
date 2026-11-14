/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Check, Copy, Code2, Terminal } from 'lucide-react';

export default function PythonCodeSnippet() {
  const [copied, setCopied] = useState(false);

  const pythonCode = `import requests
import json
import time

# VERL training script integration helper
DASHBOARD_URL = "http://localhost:3000"

def log_to_dashboard(step, epoch, reward, policy_loss, value_loss, kl_div, entropy, lr=1e-5, tool_calls_count=0, tool_success_rate=1.0):
    """
    Call this callback function inside your VERL / PyTorch training loop
    after each step to push training telemetry to the dashboard in real-time.
    """
    payload = {
        "metrics": {
            "step": step,
            "epoch": epoch,
            "reward": float(reward),
            "policyLoss": float(policy_loss),
            "valueLoss": float(value_loss),
            "klDivergence": float(kl_div),
            "entropy": float(entropy),
            "learningRate": float(lr),
            "toolCallsCount": int(tool_calls_count),
            "toolSuccessRate": float(tool_success_rate)
        }
    }
    try:
        response = requests.post(f"{DASHBOARD_URL}/api/logs", json=payload, timeout=2)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to send telemetry: {e}")
        return False

def log_tool_call(step, tool_name, arguments, result, status="success", duration_ms=50):
    """
    Log a specific tool-execution event to trace dynamic tool choices and outputs.
    Note: The 'step' parameter in toolCall payload is kept in data structure for compatibility,
    and server maps tool calls to the current active metrics step.
    """
    payload = {
        "toolCall": {
            "step": int(step),
            "toolName": str(tool_name),
            "arguments": json.dumps(arguments) if isinstance(arguments, dict) else str(arguments),
            "result": json.dumps(result) if isinstance(result, dict) else str(result),
            "status": str(status), # "success" or "failure" or "running"
            "durationMs": int(duration_ms)
        }
    }
    try:
        response = requests.post(f"{DASHBOARD_URL}/api/logs", json=payload, timeout=2)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to push tool log: {e}")
        return False

def log_agent_rl(query, ground_truth, agent_answer, train_data_index, extracted_answer="", step=0, reward=1.0):
    """
    Log multi-turn Agent RL evaluation results to the dashboard and server logs/agent_rl.log.
    Fields required: query, ground_truth, agent_answer, train_data_index, extracted_answer
    """
    payload = {
        "agentRLRecord": {
            "query": str(query),
            "ground_truth": str(ground_truth),
            "agent_answer": str(agent_answer),
            "extracted_answer": str(extracted_answer),
            "train_data_index": int(train_data_index),
            "step": int(step),
            "reward": float(reward)
        }
    }
    try:
        response = requests.post(f"{DASHBOARD_URL}/api/logs", json=payload, timeout=2)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to push Agent RL result: {e}")
        return False

def push_rollout_trajectory(sample_id, original_question, trajectory_steps, reward, is_correct):
    """
    Push detailed RL trajectory steps and rollout sequences directly to the dashboard.
    
    trajectory_steps should be a list of dicts, where each dict has:
    - step_id: str or int
    - step_type: str ("think", "tool", "user", "assistant")
    - state: str (optional)
    - timestamp: str (optional)
    - user_turns: str or list (optional)
    - assistant_turns: str or list (optional)
    - data: dict (optional metadata payload)
    """
    payload = {
        "llmSample": {
            "sampleId": sample_id,
            "original_question": original_question,
            "reward": float(reward),
            "isCorrect": bool(is_correct),
            "trajectory": trajectory_steps
        }
    }
    try:
        response = requests.post(f"{DASHBOARD_URL}/api/logs", json=payload, timeout=2)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to push trajectory sample: {e}")
        return False

# Example Usage inside your trainer:
# for step, batch in enumerate(data_loader):
#     # ... execution loop ...
#     # Log an active tool call event
#     log_tool_call(step=step, tool_name="Calculator", arguments={"expr": "12 + 4 * 3"}, result="24", status="success")
#
#     # Log training step metrics
#     log_to_dashboard(
#         step=step,
#         epoch=step // 100,
#         reward=mean_reward.item(),
#         policy_loss=p_loss.item(),
#         value_loss=v_loss.item(),
#         kl_div=kl.item(),
#         entropy=ent.item(),
#         tool_calls_count=cumulative_calls_count,
#         tool_success_rate=success_rate
#     )
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl" id="python-snippet-container">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-emerald-400" />
          <span className="text-xs font-mono font-medium text-slate-300">verl_logger_callback.py</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-all cursor-pointer"
          title="Copy to Clipboard"
          id="btn-copy-code"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy SDK'}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto max-h-[350px]">
        <pre className="text-xs font-mono text-slate-300 leading-relaxed selection:bg-slate-800 selection:text-white">
          {pythonCode}
        </pre>
      </div>
    </div>
  );
}
