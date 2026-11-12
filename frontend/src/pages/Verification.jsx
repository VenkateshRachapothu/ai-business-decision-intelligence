import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';

const Verification = () => {
  const { selectedDataset, graphContext, setGraphContext, goBack, goNext } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedDataset?.id) return;
    if (graphContext && graphContext.dataset_id === selectedDataset.id) return;

    let isCurrent = true;
    setLoading(true);
    setError('');

    api.get(`/datasets/${selectedDataset.id}/context`)
      .then((res) => {
        if (!isCurrent) return;
        if (setGraphContext) {
          setGraphContext(res.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError('Unable to load Verification results: ' + (err.response?.data?.detail || err.message));
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDataset?.id, graphContext, setGraphContext]);

  const verif = graphContext?.verification;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-100 border-t-teal-600 mb-4"></div>
        <p className="text-base font-medium text-slate-700">Running Independent Decision Verification...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 my-6">
        <h3 className="text-base font-bold text-red-800">Verification Unavailable</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!graphContext) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-lg font-medium text-slate-600">
          {selectedDataset ? 'Please complete the AI Decision stage first.' : 'Please select or upload a dataset first.'}
        </p>
      </div>
    );
  }

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'VERIFIED': 
        return { 
          text: 'Verified', 
          icon: (
            <svg className="w-8 h-8 mr-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-emerald-700', 
          bg: 'bg-emerald-50', 
          border: 'border-emerald-200' 
        };
      case 'PARTIALLY_SUPPORTED': 
        return { 
          text: 'Partially Supported', 
          icon: (
            <svg className="w-8 h-8 mr-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          color: 'text-amber-700', 
          bg: 'bg-amber-50', 
          border: 'border-amber-200' 
        };
      case 'NOT_SUPPORTED': 
        return { 
          text: 'Not Supported', 
          icon: (
            <svg className="w-8 h-8 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-red-700', 
          bg: 'bg-red-50', 
          border: 'border-red-200' 
        };
      default: 
        return { 
          text: status || 'Verification Failed', 
          icon: (
            <svg className="w-8 h-8 mr-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-slate-700', 
          bg: 'bg-slate-50', 
          border: 'border-slate-200' 
        };
    }
  };

  const statusDisplay = verif ? getStatusDisplay(verif.status) : null;

  return (
    <div className="space-y-8">
      {/* Prominent Decision Verification Agent Heading */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Decision Verification Agent</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Recommendation Verification
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Independent cross-validation of strategic decisions against historical evidence and model constraints.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${
              verif
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${verif ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              {verif ? 'Active Agent' : 'Standby'}
            </span>
          </div>
        </div>
      </div>
      
      {verif ? (
        <div className="space-y-6">
          <div className={`${statusDisplay.bg} border ${statusDisplay.border} rounded-lg p-6 flex flex-col sm:flex-row items-center sm:justify-between shadow-sm`}>
            <div className="flex items-center mb-4 sm:mb-0">
              {statusDisplay.icon}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Verification Status</h3>
                <h2 className={`text-3xl font-bold ${statusDisplay.color}`}>
                  {statusDisplay.text}
                </h2>
              </div>
            </div>
            <div className="flex gap-6 text-center sm:text-right">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Verification Score</p>
                <p className="text-2xl font-semibold text-slate-900">{((verif.verification_score||0) * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
                <p className="text-2xl font-semibold text-slate-900">{((verif.confidence||0) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Supported Claims
              </h4>
              <ul className="space-y-3">
                {verif.supported_claims?.map((c, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start">
                    <span className="text-emerald-500 mr-2 mt-0.5">•</span>
                    <span>{c}</span>
                  </li>
                ))}
                {(!verif.supported_claims || verif.supported_claims.length === 0) && (
                  <li className="text-sm text-slate-500 italic text-center py-2">No supported claims</li>
                )}
              </ul>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Unsupported / Contradicted
              </h4>
              <ul className="space-y-3">
                {verif.unsupported_claims?.map((c, i) => (
                  <li key={`un-${i}`} className="text-sm text-slate-700 flex items-start">
                    <span className="text-amber-500 mr-2 mt-0.5">•</span>
                    <span>{c} <span className="text-amber-600 text-xs font-medium ml-1">(Unsupported)</span></span>
                  </li>
                ))}
                {verif.contradicted_claims?.map((c, i) => (
                  <li key={`con-${i}`} className="text-sm text-slate-700 flex items-start">
                    <span className="text-red-500 mr-2 mt-0.5">•</span>
                    <span>{c} <span className="text-red-600 text-xs font-medium ml-1">(Contradicted)</span></span>
                  </li>
                ))}
                {(!verif.unsupported_claims?.length && !verif.contradicted_claims?.length) && (
                  <li className="text-sm text-slate-500 italic text-center py-2">No unsupported claims</li>
                )}
              </ul>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="mb-6">
              <h4 className="text-base font-semibold text-slate-900 mb-3">Verification Reasoning</h4>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded border border-slate-100">{verif.reasoning}</p>
            </div>
            
            <div className="mb-6">
              <h4 className="text-base font-semibold text-slate-900 mb-3">Supporting Evidence for Verification</h4>
              <ul className="space-y-2">
                {verif.evidence?.map((e, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start bg-slate-50 p-2 rounded">
                    <svg className="w-4 h-4 text-indigo-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            {verif.limitations && (Array.isArray(verif.limitations) ? verif.limitations.length > 0 : Boolean(verif.limitations)) && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-2">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">Limitations</h3>
                    <div className="mt-1 text-sm text-amber-700">
                      {Array.isArray(verif.limitations) ? (
                        <ul className="list-disc pl-4 space-y-1">
                          {verif.limitations.map((lim, idx) => (
                            <li key={idx}>{lim}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{verif.limitations}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center flex flex-col items-center">
          <svg className="w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-base font-semibold text-red-800 mb-2">Verification could not be completed.</p>
          <p className="text-sm text-red-600 max-w-lg">The required service is unavailable, or the AI Decision stage failed to generate a recommendation to verify. Ensure the GenAI API (Groq) is configured correctly.</p>
        </div>
      )}

      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <button 
          onClick={goBack} 
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>


        <button 
          onClick={goNext} 
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Continue to Chatbot
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Verification;
