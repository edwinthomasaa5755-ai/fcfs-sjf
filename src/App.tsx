/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Play, BarChart3, Info, Cpu, Clock, ListTodo } from 'lucide-react';

type Algorithm = 'FCFS' | 'SJF' | 'Priority';

interface Process {
  id: string;
  arrivalTime: number;
  burstTime: number;
  priority: number;
}

interface ProcessResult extends Process {
  completionTime: number;
  turnaroundTime: number;
  waitingTime: number;
  startTime: number;
}

interface GanttBlock {
  id: string;
  start: number;
  end: number;
}

export default function App() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [algorithm, setAlgorithm] = useState<Algorithm>('FCFS');
  const [results, setResults] = useState<ProcessResult[] | null>(null);
  const [ganttData, setGanttData] = useState<GanttBlock[]>([]);

  const addProcess = () => {
    const nextId = `P${processes.length + 1}`;
    setProcesses([...processes, { id: nextId, arrivalTime: 0, burstTime: 1, priority: 1 }]);
  };

  const removeProcess = (index: number) => {
    setProcesses(processes.filter((_, i) => i !== index));
  };

  const updateProcess = (index: number, field: keyof Process, value: string) => {
    const newProcesses = [...processes];
    if (field === 'id') {
      newProcesses[index].id = value;
    } else {
      // We store as string in the state temporarily to allow empty inputs while typing
      // but the interface expects numbers. We'll use 'any' to bypass for the state
      // and sanitize during simulation.
      (newProcesses[index] as any)[field] = value;
    }
    setProcesses(newProcesses);
  };

  const simulate = () => {
    if (processes.length === 0) {
      setResults(null);
      setGanttData([]);
      return;
    }

    // Ensure all numeric values are valid numbers (handle empty strings as 0)
    const sanitizedProcesses = processes.map(p => ({
      ...p,
      arrivalTime: Number(p.arrivalTime) || 0,
      burstTime: Math.max(1, Number(p.burstTime) || 0),
      priority: Number(p.priority) || 0
    }));

    let sortedProcesses = [...sanitizedProcesses].sort((a, b) => a.arrivalTime - b.arrivalTime);
    let currentTime = 0;
    const completed: ProcessResult[] = [];
    const gantt: GanttBlock[] = [];
    const readyQueue: Process[] = [];
    const remainingProcesses = [...sortedProcesses];

    while (completed.length < processes.length) {
      // Add arrived processes to ready queue
      while (remainingProcesses.length > 0 && remainingProcesses[0].arrivalTime <= currentTime) {
        readyQueue.push(remainingProcesses.shift()!);
      }

      if (readyQueue.length === 0) {
        // CPU Idle
        if (remainingProcesses.length > 0) {
          currentTime = remainingProcesses[0].arrivalTime;
          continue;
        } else {
          break;
        }
      }

      // Select process based on algorithm
      let selectedIndex = 0;
      if (algorithm === 'SJF') {
        selectedIndex = readyQueue.reduce((minIdx, p, idx, arr) => 
          p.burstTime < arr[minIdx].burstTime ? idx : minIdx, 0);
      } else if (algorithm === 'Priority') {
        selectedIndex = readyQueue.reduce((minIdx, p, idx, arr) => 
          p.priority < arr[minIdx].priority ? idx : minIdx, 0);
      }
      // FCFS is just the first in readyQueue because we sorted by arrival initially

      const p = readyQueue.splice(selectedIndex, 1)[0];
      const startTime = currentTime;
      const completionTime = startTime + p.burstTime;
      const turnaroundTime = completionTime - p.arrivalTime;
      const waitingTime = turnaroundTime - p.burstTime;

      completed.push({
        ...p,
        startTime,
        completionTime,
        turnaroundTime,
        waitingTime,
      });

      gantt.push({ id: p.id, start: startTime, end: completionTime });
      currentTime = completionTime;

      // Check for new arrivals during execution
      while (remainingProcesses.length > 0 && remainingProcesses[0].arrivalTime <= currentTime) {
        readyQueue.push(remainingProcesses.shift()!);
      }
    }

    setResults(completed);
    setGanttData(gantt);
  };

  const avgWaitingTime = useMemo(() => {
    if (!results) return 0;
    return results.reduce((acc, r) => acc + r.waitingTime, 0) / results.length;
  }, [results]);

  const avgTurnaroundTime = useMemo(() => {
    if (!results) return 0;
    return results.reduce((acc, r) => acc + r.turnaroundTime, 0) / results.length;
  }, [results]);

  const analysis = useMemo(() => {
    if (!results) return null;
    
    const arrivalOrder = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
    const priorityOrder = [...processes].sort((a, b) => a.priority - b.priority);
    const actualOrder = results;

    const isArrivalOrder = actualOrder.every((r, i) => r.id === arrivalOrder[i].id);
    const isPriorityOrder = actualOrder.every((r, i) => r.id === priorityOrder[i].id);

    let commentary = "";
    let impactLevel = "Low";

    if (algorithm === 'FCFS') {
      commentary = "In FCFS, process priority is completely ignored. The CPU simply handles tasks as they arrive. This can lead to the 'Convoy Effect' if a long process arrives first, forcing higher-priority or shorter tasks to wait indefinitely.";
      impactLevel = "None";
    } else if (algorithm === 'SJF') {
      commentary = "SJF uses Burst Time as an implicit priority. While it minimizes average waiting time, it ignores the user-defined 'Priority' field. This algorithm is optimal for throughput but can cause 'Starvation' for long processes.";
      impactLevel = "Implicit (via Burst Time)";
    } else if (algorithm === 'Priority') {
      if (isPriorityOrder) {
        commentary = "The scheduler perfectly followed your priority levels. Since all processes were available in the ready queue when needed, the CPU always picked the highest priority (lowest number) task regardless of arrival sequence.";
        impactLevel = "High";
      } else if (!isArrivalOrder) {
        commentary = "Priority had a significant impact here. The scheduler reordered tasks based on their priority values once they arrived, allowing more important tasks to 'jump the line' ahead of earlier arrivals.";
        impactLevel = "Moderate";
      } else {
        commentary = "Although Priority scheduling was selected, Arrival Time dominated the execution. This usually happens when processes arrive far apart, leaving the CPU with no other choice but to execute the only available process, even if its priority is low.";
        impactLevel = "Low (due to Arrival Gaps)";
      }
    }

    return { commentary, impactLevel };
  }, [results, algorithm, processes]);

  const getProcessColor = (id: string) => {
    const colors = [
      { bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-700' },
      { bg: 'bg-indigo-100', border: 'border-indigo-200', text: 'text-indigo-700' },
      { bg: 'bg-violet-100', border: 'border-violet-200', text: 'text-violet-700' },
      { bg: 'bg-fuchsia-100', border: 'border-fuchsia-200', text: 'text-fuchsia-700' },
      { bg: 'bg-sky-100', border: 'border-sky-200', text: 'text-sky-700' },
      { bg: 'bg-cyan-100', border: 'border-cyan-200', text: 'text-cyan-700' },
      { bg: 'bg-rose-100', border: 'border-rose-200', text: 'text-rose-700' },
      { bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-700' },
    ];
    const index = parseInt(id.replace(/\D/g, '')) || 0;
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Cpu className="text-blue-600" /> CPU Scheduler Sim
            </h1>
            <p className="text-zinc-500 mt-1">Simulate and visualize process scheduling algorithms.</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              className="bg-white border border-zinc-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
            >
              <option value="FCFS">First-Come, First-Served (FCFS)</option>
              <option value="SJF">Shortest Job First (SJF)</option>
              <option value="Priority">Priority Scheduling (Non-preemptive)</option>
            </select>
            <button 
              onClick={simulate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-md"
            >
              <Play size={18} fill="currentColor" /> Simulate
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <section className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ListTodo size={20} className="text-blue-600" /> Processes
              </h2>
              <button 
                onClick={addProcess}
                className="text-xs bg-white border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors shadow-sm"
              >
                <Plus size={14} /> Add Process
              </button>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {processes.map((p, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-white border border-zinc-200 p-4 rounded-xl space-y-3 relative group shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <input 
                        value={p.id}
                        onChange={(e) => updateProcess(idx, 'id', e.target.value)}
                        className="bg-transparent font-bold text-blue-600 focus:outline-none w-20"
                      />
                      <button 
                        onClick={() => removeProcess(idx)}
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Arrival</label>
                        <input 
                          type="number"
                          min="0"
                          value={p.arrivalTime}
                          onChange={(e) => updateProcess(idx, 'arrivalTime', e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Burst</label>
                        <input 
                          type="number"
                          min="1"
                          value={p.burstTime}
                          onChange={(e) => updateProcess(idx, 'burstTime', e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Priority</label>
                        <input 
                          type="number"
                          min="1"
                          value={p.priority}
                          onChange={(e) => updateProcess(idx, 'priority', e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Visualization & Results */}
          <section className="lg:col-span-2 space-y-8">
            {!results ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 rounded-3xl p-12 text-center">
                <BarChart3 size={48} className="mb-4 opacity-20" />
                <p className="text-lg font-medium text-zinc-600">Ready to simulate</p>
                <p className="text-sm">Add your processes and click "Simulate" to see the results.</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Gantt Chart */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <Clock size={16} /> Gantt Chart
                  </h3>
                  <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
                    <div className="flex w-full gap-1">
                      {ganttData.map((block, i) => {
                        const color = getProcessColor(block.id);
                        return (
                          <div 
                            key={i} 
                            className="flex flex-col"
                            style={{ flex: block.end - block.start }}
                          >
                            <div 
                              className={`h-12 flex items-center justify-center ${color.bg} border ${color.border} ${color.text} font-bold text-sm rounded-xl shadow-sm`}
                            >
                              {block.id}
                            </div>
                            <div className="flex justify-between w-full mt-1 text-[10px] font-mono text-zinc-400 px-1">
                              <span>{block.start}</span>
                              {i === ganttData.length - 1 && <span>{block.end}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Results Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Result Table</h3>
                  <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold">PID</th>
                          <th className="px-4 py-3 font-semibold">Arrival</th>
                          <th className="px-4 py-3 font-semibold">Burst</th>
                          <th className="px-4 py-3 font-semibold">Priority</th>
                          <th className="px-4 py-3 font-semibold">CT</th>
                          <th className="px-4 py-3 font-semibold">TAT</th>
                          <th className="px-4 py-3 font-semibold">WT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {results.map((r, i) => (
                          <tr key={i} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 font-bold text-blue-600">{r.id}</td>
                            <td className="px-4 py-3">{r.arrivalTime}</td>
                            <td className="px-4 py-3">{r.burstTime}</td>
                            <td className="px-4 py-3">{r.priority}</td>
                            <td className="px-4 py-3">{r.completionTime}</td>
                            <td className="px-4 py-3">{r.turnaroundTime}</td>
                            <td className="px-4 py-3">{r.waitingTime}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-50 border-t border-blue-100">
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-right font-semibold text-zinc-500">
                            <div className="flex flex-col gap-1">
                              <span>Average Turnaround Time:</span>
                              <span>Average Waiting Time:</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-bold text-blue-600 text-lg">
                            <div className="flex flex-col gap-1">
                              <span>{avgTurnaroundTime.toFixed(2)}</span>
                              <span>{avgWaitingTime.toFixed(2)}</span>
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Analysis Section */}
                {analysis && (
                  <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-blue-600 font-bold flex items-center gap-2">
                        <Info size={18} /> Scheduling Analysis
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Priority Impact:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          analysis.impactLevel === 'High' ? 'bg-blue-600 text-white' : 
                          analysis.impactLevel === 'None' ? 'bg-zinc-200 text-zinc-600' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {analysis.impactLevel}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-zinc-600 leading-relaxed text-sm">
                        {analysis.commentary}
                      </p>
                      <div className="pt-3 border-t border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Key Insight</span>
                          <p className="text-xs text-zinc-500 italic">
                            {algorithm === 'Priority' ? "Lower priority numbers represent higher urgency in this simulation." : 
                             algorithm === 'SJF' ? "SJF is the most efficient for average wait time but risky for long tasks." : 
                             "FCFS is the simplest but can be inefficient for mixed workloads."}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Execution Logic</span>
                          <p className="text-xs text-zinc-500">
                            {algorithm === 'Priority' ? "Ready Queue → Sort by Priority → Execute" : 
                             algorithm === 'SJF' ? "Ready Queue → Sort by Burst Time → Execute" : 
                             "Ready Queue → First In, First Out"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d4d4d8;
        }
      `}</style>
    </div>
  );
}
