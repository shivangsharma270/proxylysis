import React, { useState, useEffect } from 'react';
import { getTokenHistory, TokenUsage } from '../services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { Coins, Zap, Activity, History, Trash2 } from 'lucide-react';

const PRICING = {
  input: 0.0000035, // $3.50 per 1M tokens
  output: 0.0000105, // $10.50 per 1M tokens
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const TokenAnalysis: React.FC = () => {
  const [history, setHistory] = useState<TokenUsage[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  useEffect(() => {
    const updateHistory = () => {
      setHistory([...getTokenHistory()]);
    };

    updateHistory();
    window.addEventListener('gemini-token-update', updateHistory);
    return () => window.removeEventListener('gemini-token-update', updateHistory);
  }, []);

  const totals = history.reduce((acc, curr) => ({
    input: acc.input + curr.prompt_tokens,
    output: acc.output + curr.completion_tokens,
    total: acc.total + curr.total_tokens,
    cost: acc.cost + (curr.prompt_tokens * PRICING.input) + (curr.completion_tokens * PRICING.output)
  }), { input: 0, output: 0, total: 0, cost: 0 });

  const pieData = [
    { name: 'Input Tokens', value: totals.input },
    { name: 'Output Tokens', value: totals.output },
  ];

  const chartData = history.slice(-10).map((item, index) => ({
    name: `Req ${index + 1}`,
    input: item.prompt_tokens,
    output: item.completion_tokens,
    total: item.total_tokens,
    cost: (item.prompt_tokens * PRICING.input) + (item.completion_tokens * PRICING.output)
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-bottom border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-800">Gemini Token Analysis</h2>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          >
            History
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' ? (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Tokens</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{totals.total.toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Input Tokens</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{totals.input.toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Output Tokens</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{totals.output.toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 text-white">
                <div className="flex items-center gap-2 text-indigo-400 mb-1">
                  <Coins className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Est. Cost (USD)</span>
                </div>
                <div className="text-2xl font-bold">${totals.cost.toFixed(4)}</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-[300px] bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Token Usage (Last 10 Requests)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={10} tick={{fill: '#64748b'}} />
                    <YAxis fontSize={10} tick={{fill: '#64748b'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="input" name="Input" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="output" name="Output" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[300px] bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Input vs Output Distribution</h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Request History</h3>
              <div className="text-xs text-slate-500">{history.length} total requests</div>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium border-bottom border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Input</th>
                    <th className="px-4 py-3">Output</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.slice().reverse().map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-indigo-600">
                        {item.model}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.prompt_tokens}</td>
                      <td className="px-4 py-3 text-slate-700">{item.completion_tokens}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.total_tokens}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600">
                        ${((item.prompt_tokens * PRICING.input) + (item.completion_tokens * PRICING.output)).toFixed(5)}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                        No requests tracked yet. Start an analysis to see data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-slate-50 border-top border-slate-100 text-[10px] text-slate-400 flex justify-between items-center">
        <div>Pricing: $3.50/1M Input, $10.50/1M Output (Gemini 2.5 Pro Est.)</div>
        <div className="flex items-center gap-1">
          <History className="w-3 h-3" />
          <span>Session tracking only</span>
        </div>
      </div>
    </div>
  );
};

export default TokenAnalysis;
