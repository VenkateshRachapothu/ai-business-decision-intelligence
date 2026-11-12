import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../api';

const Decision = () => {
  const { selectedDataset, goBack, goNext, setGraphContext } = useOutletContext();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Decision Assistant State
  const [chatMessages, setChatMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!selectedDataset?.id) {
      setContext(null);
      setLoading(false);
      return;
    }
    let isCurrent = true;
    setLoading(true);
    setError('');
    setContext(null);
    setChatMessages([]);

    api.get(`/datasets/${selectedDataset.id}/context`)
      .then(res => {
        if (!isCurrent) return;
        setContext(res.data);
        if (setGraphContext) {
          setGraphContext(res.data);
        }
        setLoading(false);

        // Initialize welcome message in assistant
        const rec = res.data?.recommendation;
        const initialGreeting = {
          role: 'assistant',
          content: rec?.decision
            ? `Hello! I can explain the recommended action (${rec.decision}), review supporting evidence, or clarify the Verification Agent's findings.`
            : `Hello! I am ready to answer questions about this dataset and its strategic business decisions.`
        };
        setChatMessages([initialGreeting]);
      })
      .catch(err => {
        if (!isCurrent) return;
        setError('Unable to load AI Decision context: ' + (err.response?.data?.detail || err.message));
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDataset?.id, selectedDataset?.processing_status, selectedDataset?.name, setGraphContext]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Suggested questions for assistant
  const suggestedQuestions = [
    "Why is this decision recommended?",
    "Should we increase or reduce production?",
    "What evidence supports this decision?",
    "What should we do next?",
    "Is this recommendation verified?"
  ];

  const handleSendChat = async (qText) => {
    const questionToSend = qText || inputQuestion;
    if (!questionToSend.trim() || chatLoading || !selectedDataset) return;

    const userMsg = { role: 'user', content: questionToSend };
    setChatMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setChatLoading(true);

    try {
      const res = await api.post('/chat/', {
        dataset_id: selectedDataset.id,
        question: questionToSend
      });
      const assistantMsg = {
        role: 'assistant',
        content: res.data?.answer || "I could not generate an answer.",
        evidence: res.data?.evidence || [],
        confidence: res.data?.confidence,
        verification_status: res.data?.verification_status
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error processing question: ' + (err.response?.data?.detail || err.message)
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!selectedDataset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center min-h-[60vh]">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#0B1220] mb-2">No Dataset Selected</h2>
        <p className="text-sm text-[#506783] max-w-md">Please upload or select a dataset from the top navigation to view the AI Decision Center.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
        <div className="relative w-16 h-16 mb-5">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-[#1672F9] border-t-transparent animate-spin"></div>
        </div>
        <p className="text-base font-semibold text-[#0B1220]">Synthesizing Business Analytics & Verification Evidence...</p>
        <p className="text-xs text-[#506783] mt-1">Evaluating demand forecasts, risk signals, and decision constraints for {selectedDataset.name}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 my-6 shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0 bg-red-100 p-2 rounded-xl">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-base font-bold text-red-800">Decision Center Unavailable</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const rec = context?.recommendation;
  const verif = context?.verification;
  const analytics = context?.analytics || {};
  const analyticsSummary = analytics?.summary || analytics;
  const forecast = context?.forecast || {};
  const risks = context?.risks || {};

  // Map Verification status to standard professional wording and status colors
  const getVerificationBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return {
          label: 'Supported by Evidence',
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'PARTIALLY_SUPPORTED':
        return {
          label: 'Partially Supported',
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-200',
          dot: 'bg-amber-500'
        };
      case 'NOT_SUPPORTED':
        return {
          label: 'Not Supported',
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
          dot: 'bg-rose-500'
        };
      default:
        return {
          label: 'Verification Unavailable',
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          dot: 'bg-slate-400'
        };
    }
  };

  const verifBadge = getVerificationBadge(verif?.status);

  // Prepare trend/forecast chart data using matched forecast cadence when available
  const chartData = [];
  const forecastHistory = forecast?.historical_data || [];
  const salesHistory = analytics?.sales_over_time || [];
  const futureForecast = forecast?.future_forecast || [];

  const historySeries = (Array.isArray(forecastHistory) && forecastHistory.length > 0)
    ? forecastHistory
    : salesHistory;

  if (Array.isArray(historySeries) && historySeries.length > 0) {
    historySeries.slice(-8).forEach(pt => {
      chartData.push({
        date: String(pt.date || pt.ds || '') || 'Past',
        actual: pt.actual ?? pt.revenue ?? pt.value ?? pt.quantity ?? pt.orders ?? null,
        forecast: null
      });
    });
  }

  if (Array.isArray(futureForecast) && futureForecast.length > 0) {
    futureForecast.slice(0, 6).forEach(pt => {
      chartData.push({
        date: String(pt.date || pt.ds || '') || 'Forecast',
        actual: null,
        forecast: pt.predicted_demand ?? pt.forecast ?? pt.yhat ?? null
      });
    });
  }

  const hasChartData = chartData.length >= 3;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* 1. Page Heading */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#0B1220] tracking-tight">AI Decision Center</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1672F9] border border-blue-200">
              Strategic Decision Agent
            </span>
          </div>
          <p className="mt-1 text-sm text-[#506783]">
            Turn business analysis, demand forecasts, and detected risks into clear business actions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${verifBadge.bg} ${verifBadge.text} ${verifBadge.border}`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${verifBadge.dot}`}></span>
            {verifBadge.label}
          </span>
        </div>
      </div>

      {/* Main Grid: Left Central Area (8 cols) + Right Assistant (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Central Area: Final Business Decision, Evidence, Verification */}
        <div className="lg:col-span-8 space-y-6">

          {/* ========================================================= */}
          {/* 2. FINAL BUSINESS DECISION — MAIN FOCUS                   */}
          {/* ========================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1672F9]">
                Recommended Business Decision
              </span>
              <div className="flex items-center gap-2">
                {rec?.priority && (
                  <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                    rec.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    rec.priority === 'Medium' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    Priority: {rec.priority}
                  </span>
                )}
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${verifBadge.bg} ${verifBadge.text} ${verifBadge.border}`}>
                  {verifBadge.label}
                </span>
              </div>
            </div>

            {/* Decision Headline & Target Item */}
            {rec?.decision ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1220] tracking-tight leading-snug">
                    {rec.decision}
                  </h2>
                  {rec.affected_item && (
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#1672F9] bg-[#EAF6FF] px-3 py-1 rounded-lg border border-[#B9DCFF]/70">
                      <span>Affected Scope:</span>
                      <span className="text-[#0B1220] font-medium">{rec.affected_item}</span>
                    </div>
                  )}
                </div>

                {/* Reason */}
                {rec.reason && (
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#506783] mb-1">
                      Reason for Recommendation
                    </p>
                    <p className="text-sm sm:text-base text-[#0B1220] font-medium leading-relaxed">
                      “{rec.reason}”
                    </p>
                  </div>
                )}

                {/* Actionable Recommendation */}
                {rec.recommendation && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#506783] mb-1.5">
                      Action Required
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed font-normal">
                      {rec.recommendation}
                    </p>
                  </div>
                )}

                {/* Limitations notice: Inventory & Capacity boundaries */}
                <div className="pt-3 border-t border-slate-100 text-xs text-[#506783] flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Optimal production quantities and physical stock levels cannot be established from sales data alone (actual physical warehouse inventory and factory capacity records are unavailable in this dataset).
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <h3 className="text-xl font-bold text-[#0B1220] mb-2">No Reliable Decision Yet</h3>
                <p className="text-sm text-[#506783] max-w-lg mx-auto leading-relaxed">
                  More suitable data or additional business information is required before recommending a specific action.
                </p>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 3. SUPPORTING EVIDENCE — WHY THIS DECISION?               */}
          {/* ========================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0B1220]">
                Why This Decision?
              </h3>
              <span className="text-xs text-[#506783] font-medium">3 Evidence Pillars</span>
            </div>

            {/* 3 Short Items */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Item 1: Business Analytics */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#1672F9] mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Business Analytics</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {analyticsSummary?.total_revenue != null
                      ? `Generated $${Number(analyticsSummary.total_revenue).toLocaleString(undefined, { maximumFractionDigits: 2 })} across ${analyticsSummary.total_orders ?? 'recorded'} orders.`
                      : 'Historical revenue and order volume patterns analyzed across available records.'}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-[#506783]">
                  {Array.isArray(analytics.top_products) && analytics.top_products.length > 0
                    ? `Top item: ${analytics.top_products[0]?.name || analytics.top_products[0]?.Description || 'Identified'}`
                    : 'Portfolio metric aggregation active'}
                </div>
              </div>

              {/* Item 2: Demand Forecasting */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#1672F9] mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Demand Forecasting</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {(forecast.error || forecast.reason || forecast.status === 'not_available')
                      ? `Forecast limitation: ${forecast.error || forecast.reason || 'Insufficient historical depth'}`
                      : Array.isArray(forecast.future_forecast) && forecast.future_forecast.length > 0
                      ? `Projected trajectory across ${forecast.future_forecast.length} ${forecast.frequency ? forecast.frequency.toLowerCase() : ''} intervals based on historical velocity.`
                      : 'Statistical forecast requires suitable regular time-series history.'}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-[#506783]">
                  {(forecast.error || forecast.reason || forecast.status === 'not_available') ? 'Limited time-series depth' : 'Predictive models evaluated'}
                </div>
              </div>

              {/* Item 3: Risk Detection */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#1672F9] mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Risk Detection</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {Array.isArray(risks.risks) && risks.risks.length > 0
                      ? `${risks.risks.length} risk signals identified (Top: ${risks.risks[0]?.risk_type || 'Demand anomaly'}).`
                      : 'No critical operational risks identified in transaction distribution.'}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-[#506783]">
                  {Array.isArray(risks.risks) && risks.risks.length > 0
                    ? `Severity: ${risks.risks[0]?.severity || 'Medium'}`
                    : 'Risk levels nominal'}
                </div>
              </div>

            </div>

            {/* Small Readable Chart (Only if data exists and adds value) */}
            {hasChartData ? (
              <div className="pt-3">
                <p className="text-xs font-bold text-[#506783] mb-2 uppercase tracking-wider">
                  Demand Trend &amp; Forecast Trajectory
                </p>
                <div className="h-44 w-full bg-slate-50/60 rounded-xl p-2 border border-slate-200/60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} 
                      />
                      <Line type="monotone" dataKey="actual" stroke="#1672F9" strokeWidth={2} dot={{ r: 3 }} name="Observed" connectNulls={false} />
                      <Line type="monotone" dataKey="forecast" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} name="Forecast" connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#506783] bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex items-center justify-between">
                <span>Time-series graphical projection:</span>
                <span className="font-medium text-slate-700">
                  {forecast?.error || 'Dataset timestamp depth is limited; trajectory summarized numerically above.'}
                </span>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4. VERIFICATION AGENT RESULT                              */}
          {/* ========================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-base font-bold text-[#0B1220]">Verification Agent</h3>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verifBadge.bg} ${verifBadge.text} ${verifBadge.border}`}>
                {verifBadge.label}
              </span>
            </div>

            {/* Explanation & Claims */}
            <div className="space-y-3">
              <p className="text-sm text-slate-800 leading-relaxed font-medium">
                {verif?.reasoning || 'The Verification Agent checked proposed claims against historical data distributions and risk parameters.'}
              </p>

              {/* Supported Claims */}
              {Array.isArray(verif?.supported_claims) && verif.supported_claims.length > 0 && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                    Evidence-Supported Findings
                  </p>
                  <ul className="space-y-1">
                    {verif.supported_claims.map((claim, idx) => (
                      <li key={idx} className="text-xs text-emerald-900 flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{claim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Information / Unsupported Claims */}
              {Array.isArray(verif?.unsupported_claims) && verif.unsupported_claims.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1.5">
                    Missing Information &amp; Scope Limits
                  </p>
                  <ul className="space-y-1">
                    {verif.unsupported_claims.map((claim, idx) => (
                      <li key={idx} className="text-xs text-amber-900 flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{claim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contradicted Claims if any */}
              {Array.isArray(verif?.contradicted_claims) && verif.contradicted_claims.length > 0 && (
                <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3.5">
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1.5">
                    Contradictory Evidence Identified
                  </p>
                  <ul className="space-y-1">
                    {verif.contradicted_claims.map((claim, idx) => (
                      <li key={idx} className="text-xs text-rose-900 flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{claim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* 5. AI DECISION ASSISTANT (RIGHT SIDEBAR)                  */}
        {/* ========================================================= */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[740px] sticky top-20">
            
            {/* Assistant Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1672F9]/10 border border-[#1672F9]/20 flex items-center justify-center text-[#1672F9]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0B1220]">AI Decision Assistant</h3>
                  <p className="text-[10px] text-[#506783]">Tied to dataset &amp; verification evidence</p>
                </div>
              </div>
            </div>

            {/* Suggested Question Chips */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#506783] mb-2">
                Suggested Questions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChat(q)}
                    className="text-[11px] bg-slate-50 hover:bg-[#EAF6FF] text-slate-700 hover:text-[#1672F9] border border-slate-200 hover:border-[#B9DCFF] px-2.5 py-1 rounded-full transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-3 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#1672F9] text-white shadow-2xs'
                        : 'bg-white border border-slate-200/90 text-slate-800 shadow-2xs'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {/* Citations / Evidence from Assistant */}
                    {Array.isArray(msg.evidence) && msg.evidence.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5">
                        <span className="font-semibold text-slate-600">Referenced Evidence:</span>
                        {msg.evidence.slice(0, 2).map((ev, i) => (
                          <div key={i} className="truncate">• {ev}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-1.5 text-slate-400 text-xs pl-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1672F9] animate-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1672F9] animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1672F9] animate-bounce [animation-delay:0.4s]"></div>
                  <span className="text-[11px] ml-1">Analyzing context...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Field */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="p-3 border-t border-slate-100 bg-white rounded-b-2xl">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  placeholder="Ask a decision question..."
                  disabled={chatLoading}
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1672F9] focus:border-transparent text-slate-800 placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !inputQuestion.trim()}
                  className="bg-[#1672F9] hover:bg-[#125ecc] disabled:opacity-40 text-white p-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center flex-shrink-0"
                  aria-label="Send message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>

          </div>
        </div>

      </div>

      {/* Navigation Buttons (Back & Continue) */}
      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <button 
          onClick={goBack} 
          className="w-full sm:w-auto inline-flex justify-center items-center px-5 py-2.5 border border-slate-300 shadow-xs text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-[#1672F9]"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Risks
        </button>

        <button 
          onClick={goNext} 
          className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-[#1672F9] hover:bg-[#125ecc] transition-colors focus-visible:outline-2 focus-visible:outline-[#1672F9]"
        >
          Continue to Verification
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

    </div>
  );
};

export default Decision;
