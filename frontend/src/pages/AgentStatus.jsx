import React from 'react';

const AGENT_METADATA = {
  "Data Understanding Agent": {
    purpose: "Understands dataset structure",
    input: "Raw or Cleaned dataset",
    output: "Dataset capabilities & health",
  },
  "Analysis Agent": {
    purpose: "Finds business patterns",
    input: "Cleaned data",
    output: "Analytics, trends, and outliers",
  },
  "Analysis Agent (Trends)": {
    purpose: "Identifies historical trends",
    input: "Cleaned time-series data",
    output: "Trends and anomalies",
  },
  "Forecasting Agent": {
    purpose: "Estimates future demand",
    input: "Historical time-series data",
    output: "Forecast & model metrics",
  },
  "Risk Detection Agent": {
    purpose: "Identifies possible business risks",
    input: "Trends + forecast",
    output: "Risk findings",
  },
  "Decision Agent": {
    purpose: "Generates business recommendation",
    input: "Analytics + forecast + risks + evidence",
    output: "Strategic recommendation",
  },
  "Verification Agent": {
    purpose: "Checks recommendation against evidence",
    input: "Recommendation + evidence",
    output: "Verification result",
  },
  "Vision Agent": {
    purpose: "Interprets visual business charts",
    input: "Chart image",
    output: "Chart analysis & insights",
  },
  "Chatbot Agent": {
    purpose: "Answers business questions using RAG",
    input: "User query + Dataset context",
    output: "Evidence-backed answer",
  }
};

const AgentStatus = ({ name, status }) => {
  const getStatusClasses = () => {
    if (status === 'Completed' || status === 'Verified') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'Running') return 'text-amber-700 bg-amber-50 border-amber-200';
    if (status === 'Failed' || status === 'Not Available' || status.includes('unavailable')) return 'text-red-700 bg-red-50 border-red-200';
    if (status === 'Standby' || status === 'Pending') return 'text-slate-600 bg-slate-50 border-slate-200';
    return 'text-brand-700 bg-brand-50 border-brand-200'; // Default/Fallback (Partially Supported, etc)
  };

  const statusClasses = getStatusClasses();
  const meta = AGENT_METADATA[name] || {
    purpose: "Processes data in pipeline",
    input: "System data",
    output: "Structured results",
  };

  return (
    <div className={`flex flex-col w-full max-w-sm rounded-xl border shadow-sm overflow-hidden bg-white mb-4 ${statusClasses.replace(/text-[\w-]+ bg-[\w-]+ /, 'bg-white ')}`}>
      {/* Header */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${statusClasses.replace('border-', 'border-b-')}`}>
        <div className="flex items-center font-bold text-sm tracking-tight">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          {name}
        </div>
      </div>
      
      {/* Body */}
      <div className="p-4 text-xs text-slate-600 space-y-3 bg-white">
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Purpose</span>
          <span className="font-medium text-slate-800">{meta.purpose}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Input</span>
            <span className="font-medium text-slate-700">{meta.input}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Output</span>
            <span className="font-medium text-slate-700">{meta.output}</span>
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <div className={`px-4 py-2 border-t flex items-center text-xs font-semibold ${statusClasses}`}>
        <span className="mr-2">Status:</span>
        <span className="flex items-center">
          {(status === 'Completed' || status === 'Verified') && (
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'Running' && (
            <svg className="animate-spin w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {status === 'Failed' || status === 'Not Available' || status.includes('unavailable') ? (
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : null}
          {status}
        </span>
      </div>
    </div>
  );
};

export default AgentStatus;
