/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { AgentRLRecord } from '../types';
import { 
  Bot, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Copy, 
  Check, 
  Database, 
  MessageSquareText, 
  HelpCircle, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode2,
  ListFilter,
  Target,
  Layers,
  X
} from 'lucide-react';

interface AgentRLPanelProps {
  records: AgentRLRecord[];
}

export default function AgentRLPanel({ records }: AgentRLPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [selectedDataIndex, setSelectedDataIndex] = useState<string | number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, copyKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(copyKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Extract unique train_data_index items and summary stats
  const dataIndexSummary = useMemo(() => {
    const map = new Map<string | number, { count: number; correctCount: number; latestRecord: AgentRLRecord }>();
    
    records.forEach(r => {
      const idx = r.train_data_index;
      const isCorrect = r.isCorrect ?? ((r.reward ?? 1) > 0.5);
      
      if (!map.has(idx)) {
        map.set(idx, { count: 0, correctCount: 0, latestRecord: r });
      }
      const item = map.get(idx)!;
      item.count += 1;
      if (isCorrect) item.correctCount += 1;
    });

    return Array.from(map.entries()).map(([idx, data]) => ({
      index: idx,
      count: data.count,
      correctCount: data.correctCount,
      allCorrect: data.correctCount === data.count,
      latestRecord: data.latestRecord
    }));
  }, [records]);

  const filteredRecords = records.filter(record => {
    // 1. Filter by selected train_data_index if active
    if (selectedDataIndex !== null && String(record.train_data_index) !== String(selectedDataIndex)) {
      return false;
    }

    // 2. Filter by search term (query, ground_truth, agent_answer, extracted_answer, train_data_index)
    const matchesSearch =
      String(record.train_data_index).toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.ground_truth.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.agent_answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.extracted_answer || '').toLowerCase().includes(searchTerm.toLowerCase());

    const isCorrect = record.isCorrect ?? (record.reward !== undefined ? record.reward > 0.5 : true);

    // 3. Filter by correctness status
    if (filterStatus === 'correct') return matchesSearch && isCorrect;
    if (filterStatus === 'incorrect') return matchesSearch && !isCorrect;
    return matchesSearch;
  });

  const totalCount = records.length;
  const correctCount = records.filter(r => (r.isCorrect ?? ((r.reward ?? 1) > 0.5))).length;
  const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 100;
  const avgReward = totalCount > 0 
    ? records.reduce((acc, r) => acc + (r.reward ?? 1.0), 0) / totalCount 
    : 1.0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5" id="agent-rl-panel">
      {/* Panel Header & Micro Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-100 text-base flex items-center gap-2">
                多轮 Agent RL 结果
                <span className="text-[10px] font-mono uppercase bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full">
                  Multi-Turn RL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                记录多轮对话与工具调用的 Agent RL 训练评估数据 (`query`, `ground_truth`, `extracted_answer`, `agent_answer`, `train_data_index`)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Summary Metrics */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg flex flex-col items-center min-w-[90px]">
            <span className="text-[10px] text-slate-500 uppercase">总记录数</span>
            <span className="text-slate-200 font-bold text-sm">{totalCount}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg flex flex-col items-center min-w-[90px]">
            <span className="text-[10px] text-slate-500 uppercase">准确率</span>
            <span className={`font-bold text-sm ${accuracy >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {accuracy.toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg flex flex-col items-center min-w-[90px]">
            <span className="text-[10px] text-slate-500 uppercase">平均 Reward</span>
            <span className="text-indigo-400 font-bold text-sm">{avgReward.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Train Data Index Selection Bar (列表展示 train_data_index) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Layers size={14} className="text-indigo-400" />
            <span>Train Data Index 数据列表 ({dataIndexSummary.length} 个独立 Index)</span>
            <span className="text-[11px] font-normal text-slate-500">点击选中查看指定 Index 详情</span>
          </div>
          {selectedDataIndex !== null && (
            <button
              onClick={() => setSelectedDataIndex(null)}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/50 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              <X size={12} />
              <span>重置选中 (显示全部)</span>
            </button>
          )}
        </div>

        {/* Scrollable list of train_data_index chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 text-xs scrollbar-thin scrollbar-thumb-slate-800">
          <button
            onClick={() => setSelectedDataIndex(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedDataIndex === null
                ? 'bg-indigo-600 text-white border-indigo-500 font-medium shadow-md shadow-indigo-950/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Database size={12} />
            <span>全部 Index ({records.length})</span>
          </button>

          {dataIndexSummary.map((item) => {
            const isSelected = selectedDataIndex !== null && String(selectedDataIndex) === String(item.index);
            return (
              <button
                key={`idx-chip-${item.index}`}
                onClick={() => setSelectedDataIndex(isSelected ? null : item.index)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-400 font-semibold shadow-md shadow-indigo-950/50'
                    : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.allCorrect ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span>Index {item.index}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans ${
                  isSelected ? 'bg-indigo-950/80 text-indigo-100' : 'bg-slate-950 text-slate-400'
                }`}>
                  {item.count} 条
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="搜索 query, ground truth, extracted answer, agent answer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-md focus:outline-none focus:border-indigo-500/60 transition-colors placeholder:text-slate-600"
            id="agent-rl-search-input"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <ListFilter size={14} className="text-slate-500" />
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-1 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${filterStatus === 'all' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              全部 ({records.length})
            </button>
            <button
              onClick={() => setFilterStatus('correct')}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${filterStatus === 'correct' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              正确 ({correctCount})
            </button>
            <button
              onClick={() => setFilterStatus('incorrect')}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${filterStatus === 'incorrect' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              不匹配 ({totalCount - correctCount})
            </button>
          </div>
        </div>
      </div>

      {/* Selected Index Indicator Banner if active */}
      {selectedDataIndex !== null && (
        <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-lg px-4 py-2 flex items-center justify-between text-xs text-indigo-300">
          <div className="flex items-center gap-2 font-mono">
            <Database size={14} className="text-indigo-400" />
            <span>当前筛选 <strong>train_data_index = {selectedDataIndex}</strong> 的详情记录</span>
            <span className="text-slate-400 font-sans">({filteredRecords.length} 条匹配)</span>
          </div>
          <button
            onClick={() => setSelectedDataIndex(null)}
            className="text-slate-400 hover:text-slate-200 text-xs underline cursor-pointer"
          >
            显示全部数据
          </button>
        </div>
      )}

      {/* Main Records List */}
      <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1" id="agent-rl-records-list">
        {filteredRecords.length === 0 ? (
          <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2">
            <Sparkles className="text-slate-600 mb-1" size={24} />
            <p className="text-slate-400 text-xs font-medium">暂无符合条件的 Agent RL 多轮结果记录</p>
            <p className="text-slate-600 text-[11px] max-w-md">
              可通过 Python API 或实时训练推送 `/api/logs` 格式包含 `query`, `ground_truth`, `extracted_answer`, `agent_answer`, `train_data_index` 的 JSON 数据。
            </p>
          </div>
        ) : (
          filteredRecords.map((record, index) => {
            const isCorrect = record.isCorrect ?? ((record.reward ?? 1) > 0.5);
            const isExpanded = expandedIds[record.id] ?? (index === 0);

            return (
              <div
                key={record.id || `rl-${index}`}
                className={`bg-slate-950/70 border rounded-xl overflow-hidden transition-all duration-200 ${
                  isCorrect ? 'border-slate-800 hover:border-emerald-900/60' : 'border-rose-900/40 hover:border-rose-800/80'
                }`}
              >
                {/* Record Header */}
                <div
                  onClick={() => toggleExpand(record.id)}
                  className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Index Badge */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDataIndex(record.train_data_index);
                      }}
                      className="flex items-center gap-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer"
                      title="点击仅查看此 train_data_index 记录"
                    >
                      <Database size={12} className="text-indigo-400" />
                      <span>train_data_index: {record.train_data_index}</span>
                    </button>

                    {/* Step tag if available */}
                    {record.step !== undefined && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                        Step {record.step}
                      </span>
                    )}

                    {/* Turns count if present */}
                    {record.turnsCount && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50 flex items-center gap-1">
                        <MessageSquareText size={10} />
                        {record.turnsCount} 轮对话
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Reward & Status Badge */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-slate-400">Reward:</span>
                      <span className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(record.reward ?? (isCorrect ? 1.0 : 0.0)).toFixed(2)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                        isCorrect
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                          : 'bg-rose-950/40 text-rose-400 border-rose-800/50'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 size={12} />
                          <span>正确匹配</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={12} />
                          <span>不匹配</span>
                        </>
                      )}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(JSON.stringify(record, null, 2), `json-${record.id}`);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 rounded cursor-pointer transition-colors"
                      title="复制 JSON 完整记录"
                    >
                      {copiedId === `json-${record.id}` ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <FileCode2 size={13} />
                      )}
                    </button>

                    <button className="text-slate-400 hover:text-slate-200 p-1">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Details Body */}
                {isExpanded && (
                  <div className="p-4 flex flex-col gap-4 text-xs font-sans">
                    {/* 1. Query Field */}
                    <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-semibold text-[11px] uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                          <HelpCircle size={13} />
                          1. Query (输入问题 / 任务指令)
                        </span>
                        <button
                          onClick={() => handleCopy(record.query, `q-${record.id}`)}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {copiedId === `q-${record.id}` ? (
                            <>
                              <Check size={11} className="text-emerald-400" />
                              <span className="text-emerald-400 font-mono">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span className="font-mono">Copy Query</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
                        {record.query}
                      </div>
                    </div>

                    {/* 2 & 3 & 4 Fields in Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* 2. Ground Truth Field */}
                      <div className="bg-slate-900/60 border border-emerald-950/60 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-semibold text-[11px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            2. Ground Truth (标准参考)
                          </span>
                          <button
                            onClick={() => handleCopy(record.ground_truth, `gt-${record.id}`)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {copiedId === `gt-${record.id}` ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span className="text-emerald-400 font-mono">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span className="font-mono">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-emerald-900/30 text-emerald-200/90 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all min-h-[80px]">
                          {record.ground_truth}
                        </div>
                      </div>

                      {/* 3. Extracted Answer Field */}
                      <div className="bg-slate-900/60 border border-cyan-950/60 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-semibold text-[11px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                            <Target size={13} className="text-cyan-400" />
                            3. Extracted Answer (抽取的答案)
                          </span>
                          <button
                            onClick={() => handleCopy(record.extracted_answer || record.agent_answer, `ea-${record.id}`)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {copiedId === `ea-${record.id}` ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span className="text-emerald-400 font-mono">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span className="font-mono">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-cyan-900/30 text-cyan-200/90 font-mono text-xs font-semibold leading-relaxed whitespace-pre-wrap select-all min-h-[80px]">
                          {record.extracted_answer || <span className="text-slate-600 font-normal italic">(未单独抽离或即 Agent Answer)</span>}
                        </div>
                      </div>

                      {/* 4. Agent Answer Field */}
                      <div className="bg-slate-900/60 border border-indigo-950/60 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-semibold text-[11px] uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                            <Bot size={13} />
                            4. Agent Answer (Agent 多轮回答)
                          </span>
                          <button
                            onClick={() => handleCopy(record.agent_answer, `aa-${record.id}`)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {copiedId === `aa-${record.id}` ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span className="text-emerald-400 font-mono">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span className="font-mono">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-indigo-900/30 text-indigo-100/90 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all min-h-[80px]">
                          {record.agent_answer}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                      <span>train_data_index: {record.train_data_index}</span>
                      <span>{record.timestamp ? new Date(record.timestamp).toLocaleString() : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
