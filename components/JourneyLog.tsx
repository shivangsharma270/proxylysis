
import React from 'react';
import { JourneyStep } from '../types.ts';

interface JourneyLogProps {
  steps: JourneyStep[];
}

export const JourneyLog: React.FC<JourneyLogProps> = ({ steps }) => {
  return (
    <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-8 h-[500px] overflow-y-auto">
      <h2 className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
        Activity Feed
      </h2>
      <div className="space-y-8 pb-4">
        {steps.length === 0 && (
          <div className="text-center py-20 text-slate-600 text-xs font-bold uppercase tracking-widest">
            Awaiting Command...
          </div>
        )}
        {[...steps].reverse().map((step, idx) => (
          <div key={step.id} className="relative pl-10">
            {idx !== steps.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-[-32px] w-[1px] bg-slate-800"></div>
            )}
            <div className={`absolute left-0 top-1 w-8 h-8 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center z-10
              ${step.status === 'success' ? 'text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : step.status === 'error' ? 'text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'text-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]'}`}>
              {step.status === 'success' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              ) : step.status === 'error' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">{step.title}</h3>
                <span className="text-[9px] text-slate-600 font-mono">{step.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              {/* Fixed: description property now exists on JourneyStep. Added fallback to message for better UX. */}
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{step.description || step.message}</p>
              
              {/* Fixed: data property now exists on JourneyStep interface. */}
              {step.data && (
                <div className="mt-4 bg-slate-950 rounded-xl p-4 overflow-x-auto border border-slate-800/50">
                  <pre className="text-[10px] text-emerald-500/80 font-mono leading-tight whitespace-pre">
                    {typeof step.data === 'string' && step.data.startsWith('{') 
                      ? step.data 
                      : JSON.stringify(step.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
