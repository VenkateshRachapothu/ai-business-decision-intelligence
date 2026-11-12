import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import api from '../api';

const TrendAnalysis = () => {
  const { selectedDataset, goBack, goNext } = useOutletContext();
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [outliers, setOutliers] = useState(null);
  const [loading, setLoading] = useState(Boolean(selectedDataset));
  const [error, setError] = useState('');

  // Chatbot State
  const [chatHistory, setChatHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const messagesEndRef = useRef(null);

  // Fetch analysis data safely when active dataset changes
  useEffect(() => {
    if (!selectedDataset) return;

    let isCurrent = true;
    setLoading(true);
    setError('');

    Promise.all([
      api.get(`/analytics/${selectedDataset.id}`),
      api.get(`/analytics/${selectedDataset.id}/trends`),
      api.get(`/analytics/${selectedDataset.id}/outliers`)
    ])
      .then(([aRes, tRes, oRes]) => {
        if (!isCurrent) return;
        setAnalytics(aRes.data);
        setTrends(tRes.data);
        setOutliers(oRes.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Failed to load trends/outliers data:', err);
        setError('Unable to load analysis for this dataset.');
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDataset]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  // Derive Trend Analysis Insights from Real Backend Data
  const trendInsights = useMemo(() => {
    const timeData = analytics?.sales_over_time || [];
    const trendItems = trends?.trends || [];
    const hasTimeData = timeData.length > 0;
    const hasTrendError = Boolean(trends?.error);

    if (!hasTimeData || hasTrendError) {
      return {
        isAvailable: false,
        reason: trends?.error || 'This dataset does not contain a suitable time/date field for time-based trend analysis.',
        timeData: []
      };
    }

    // Determine primary trend (preference: Revenue -> Quantity -> Orders -> first available)
    const primaryTrendObj =
      trendItems.find((t) => t.metric?.toLowerCase() === 'revenue') ||
      trendItems.find((t) => t.metric?.toLowerCase() === 'quantity') ||
      trendItems.find((t) => t.metric?.toLowerCase() === 'orders') ||
      trendItems[0] ||
      null;

    const trendDirection = (primaryTrendObj?.trend || 'stable').toLowerCase();
    let trendLabel = 'Stable Pattern';
    let trendBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';

    if (trendDirection === 'increasing') {
      trendLabel = 'Increasing Trend';
      trendBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (trendDirection === 'decreasing') {
      trendLabel = 'Decreasing Trend';
      trendBadgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (trendDirection === 'stable') {
      trendLabel = 'Stable';
      trendBadgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
    } else {
      trendLabel = 'No Meaningful Trend';
      trendBadgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
    }

    const firstPoint = timeData[0];
    const lastPoint = timeData[timeData.length - 1];
    const startDate = firstPoint?.date || '';
    const endDate = lastPoint?.date || '';
    const periodCount = timeData.length;

    const startVal = firstPoint?.value ?? firstPoint?.revenue ?? firstPoint?.quantity ?? 0;
    const endVal = lastPoint?.value ?? lastPoint?.revenue ?? lastPoint?.quantity ?? 0;

    let pctChange = null;
    if (startVal > 0) {
      pctChange = ((endVal - startVal) / startVal) * 100;
    }

    const primaryMetricName = primaryTrendObj?.metric || firstPoint?.measure_label || 'Value';
    const unit = firstPoint?.unit || '';

    // Driver context (e.g. top product or top category)
    const topProduct = analytics?.top_products?.[0]?.name;
    const topCategory = analytics?.sales_by_category?.[0]?.category;
    const topLocation = analytics?.sales_by_location?.[0]?.location;

    // Narrative generation from actual calculated results
    let narrative = '';
    if (trendDirection === 'increasing') {
      narrative = `${primaryMetricName} demonstrated an upward trajectory across ${periodCount} recorded periods from ${startDate} to ${endDate}. `;
      if (pctChange !== null) {
        narrative += `Overall momentum grew by ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%, advancing from ${formatValue(startVal, unit)} to ${formatValue(endVal, unit)}. `;
      }
      if (primaryTrendObj?.evidence) {
        narrative += primaryTrendObj.evidence;
      }
    } else if (trendDirection === 'decreasing') {
      narrative = `${primaryMetricName} experienced a contraction across ${periodCount} recorded periods from ${startDate} to ${endDate}. `;
      if (pctChange !== null) {
        narrative += `Values retracted by ${pctChange.toFixed(1)}%, declining from ${formatValue(startVal, unit)} to ${formatValue(endVal, unit)}. `;
      }
      if (primaryTrendObj?.evidence) {
        narrative += primaryTrendObj.evidence;
      }
    } else {
      narrative = `${primaryMetricName} remained relatively stable across ${periodCount} periods between ${startDate} and ${endDate}, showing steady volume without sharp directional drift. `;
      if (primaryTrendObj?.evidence) {
        narrative += primaryTrendObj.evidence;
      }
    }

    return {
      isAvailable: true,
      timeData,
      trendLabel,
      trendBadgeColor,
      trendDirection,
      primaryMetricName,
      unit,
      startDate,
      endDate,
      periodCount,
      startVal,
      endVal,
      pctChange,
      narrative,
      topProduct,
      topCategory,
      topLocation,
      trendItems
    };
  }, [analytics, trends]);

  // Derive Outlier Detection Insights from Real Backend Data
  const outlierInsights = useMemo(() => {
    const rawOutliers = outliers?.outliers || [];
    const count = rawOutliers.length;

    let statusLabel = 'No Significant Outliers';
    let statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

    if (count > 0) {
      const hasHighZ = rawOutliers.some((o) => {
        const zMatch = o.evidence?.match(/Z-score of (-?\d+(\.\d+)?)/i);
        const z = zMatch ? Math.abs(parseFloat(zMatch[1])) : 3.0;
        return z >= 4.0;
      });

      if (hasHighZ || count >= 5) {
        statusLabel = 'Significant Outliers Detected';
        statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
      } else {
        statusLabel = 'Unusual Values Detected';
        statusBadgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
      }
    }

    // Format outlier data for scatter/deviation chart
    const scatterData = rawOutliers.map((o, idx) => {
      let upper = null;
      let lower = null;
      if (o.expected_range && typeof o.expected_range === 'string') {
        const parts = o.expected_range.split('to').map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          lower = parts[0];
          upper = parts[1];
        }
      }

      // Context identifier
      const ctx = o.context || {};
      const identifier = ctx.product || ctx.order || ctx.location || ctx.date || `Record #${idx + 1}`;

      return {
        id: idx + 1,
        name: identifier,
        metric: o.metric,
        value: o.value,
        upperRange: upper,
        lowerRange: lower,
        status: o.status,
        evidence: o.evidence,
        context: ctx
      };
    });

    return {
      count,
      statusLabel,
      statusBadgeColor,
      rawOutliers,
      scatterData
    };
  }, [outliers]);

  // Chat message submission
  const handleSendChat = async (e, customText = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const queryText = (customText || question).trim();
    if (!queryText || isChatLoading || !selectedDataset) return;

    const userMessage = { role: 'user', content: queryText };
    setChatHistory((prev) => [...prev, userMessage]);
    setQuestion('');
    setChatError('');
    setIsChatLoading(true);

    try {
      const res = await api.post('/chat/', {
        dataset_id: selectedDataset.id,
        question: queryText
      });

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'agent',
          data: res.data
        }
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Unable to generate answer.';
      setChatError(errMsg);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'agent',
          error: errMsg
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setChatError('');
  };

  // Helper formatting function
  function formatValue(val, unit = '') {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (unit === '$' || unit.toLowerCase().includes('usd')) {
      return `$${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return `${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
  }

  // Suggested questions relevant to Trends & Outliers
  const suggestedQuestions = [
    'Why is this metric increasing or decreasing?',
    'What is the strongest trend in this dataset?',
    'Which records were identified as outliers?',
    'Why was this value considered unusual?',
    'Are there important business risks in these results?',
    'Explain the results in simple language.'
  ];

  if (!selectedDataset) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-16 shadow-xs">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Dataset Selected</h2>
        <p className="text-sm text-slate-500 mb-6">
          Please upload or choose a cleaned dataset to analyze trends, detect anomalies, and consult the AI Business Assistant.
        </p>
        <button
          onClick={goBack}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
        >
          Select Dataset
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin"></div>
        </div>
        <p className="text-base font-semibold text-slate-800">Synthesizing Trends & Outliers...</p>
        <p className="text-xs text-slate-500 mt-1">Evaluating temporal momentum and statistical distributions</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/70 border border-red-200 rounded-xl p-6 my-8 max-w-2xl mx-auto shadow-xs">
        <div className="flex items-start">
          <div className="flex-shrink-0 text-red-500 mt-0.5">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-base font-semibold text-red-900">Analysis Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-white border border-red-300 text-red-800 hover:bg-red-50 shadow-2xs"
              >
                Retry Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header (Model 2: Clean, focused BI narrative matching previous agent styling) */}
      <header className="border-b border-slate-200/80 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trend & Anomaly Intelligence</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Trends & Outliers
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Discover what's changing and identify unusual patterns in your data with specialized intelligence agents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[220px]" title={selectedDataset.name}>
                {selectedDataset.original_filename || selectedDataset.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {selectedDataset.processing_status === 'cleaned' ? 'Cleaned' : selectedDataset.processing_status}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout: 2-Column Responsive Layout (Main Area: ~72%, AI Assistant: ~28%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Insight Area (Story Section 1 & Section 2) */}
        <div className="lg:col-span-8 space-y-8">
          {/* SECTION 1: Trend Intelligence Agent */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">Trend Intelligence Agent</h2>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      Business Trend & Pattern Analysis
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Responsible for analyzing business metrics over time, identifying increasing or decreasing trends, and detecting patterns when valid temporal data is available.
                  </p>
                </div>
              </div>

              {trendInsights.isAvailable && (
                <div className="self-start sm:self-auto flex-shrink-0">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${trendInsights.trendBadgeColor}`}>
                    {trendInsights.trendDirection === 'increasing' && (
                      <svg className="w-3.5 h-3.5 mr-1.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    )}
                    {trendInsights.trendDirection === 'decreasing' && (
                      <svg className="w-3.5 h-3.5 mr-1.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    )}
                    {trendInsights.trendDirection === 'stable' && (
                      <svg className="w-3.5 h-3.5 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14" />
                      </svg>
                    )}
                    {trendInsights.trendLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Section Body */}
            <div className="p-6">
              {trendInsights.isAvailable ? (
                <div className="space-y-6">
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block">Analyzed Period</span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate" title={`${trendInsights.startDate} to ${trendInsights.endDate}`}>
                        {trendInsights.startDate} → {trendInsights.endDate}
                      </p>
                      <span className="text-[10px] text-slate-500">{trendInsights.periodCount} intervals</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block">Starting Value</span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        {formatValue(trendInsights.startVal, trendInsights.unit)}
                      </p>
                      <span className="text-[10px] text-slate-500">Period baseline</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block">Ending Value</span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        {formatValue(trendInsights.endVal, trendInsights.unit)}
                      </p>
                      <span className="text-[10px] text-slate-500">Latest recorded</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block">Net Change</span>
                      {trendInsights.pctChange !== null ? (
                        <p className={`text-sm font-bold mt-0.5 ${trendInsights.pctChange > 0 ? 'text-blue-700' : trendInsights.pctChange < 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                          {trendInsights.pctChange >= 0 ? '+' : ''}
                          {trendInsights.pctChange.toFixed(1)}%
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Calculable N/A</p>
                      )}
                      <span className="text-[10px] text-slate-500">Trajectory delta</span>
                    </div>
                  </div>

                  {/* Plain Language Insight Story Card */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4.5">
                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-3 shadow-2xs">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Key Trend Narrative</h3>
                        <p className="text-sm text-blue-950 mt-1 leading-relaxed">
                          {trendInsights.narrative}
                        </p>
                        {(trendInsights.topProduct || trendInsights.topCategory) && (
                          <div className="mt-3 pt-2.5 border-t border-blue-200/50 flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-800">
                            {trendInsights.topProduct && (
                              <span>
                                <strong className="font-semibold text-blue-900">Key Leading Product:</strong> {trendInsights.topProduct}
                              </span>
                            )}
                            {trendInsights.topCategory && (
                              <span>
                                <strong className="font-semibold text-blue-900">Top Category:</strong> {trendInsights.topCategory}
                              </span>
                            )}
                            {trendInsights.topLocation && (
                              <span>
                                <strong className="font-semibold text-blue-900">Primary Region:</strong> {trendInsights.topLocation}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clean Recharts Time-Series Line Chart */}
                  <div className="border border-slate-200/80 rounded-xl p-5 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-800">
                        {trendInsights.primaryMetricName} Over Time
                      </h4>
                      <span className="text-xs text-slate-500 font-medium">
                        Unit: {trendInsights.unit || 'Standard'}
                      </span>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendInsights.timeData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                              if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                              if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                              return val;
                            }}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const dataItem = payload[0].payload;
                                return (
                                  <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200 text-xs">
                                    <p className="font-bold text-slate-800 mb-1">{label}</p>
                                    <p className="text-blue-600 font-semibold">
                                      {trendInsights.primaryMetricName}: {formatValue(payload[0].value, trendInsights.unit)}
                                    </p>
                                    {dataItem.orders && (
                                      <p className="text-slate-500 mt-0.5">Orders: {dataItem.orders.toLocaleString()}</p>
                                    )}
                                    {dataItem.quantity && trendInsights.primaryMetricName !== 'Quantity' && (
                                      <p className="text-slate-500 mt-0.5">Quantity: {dataItem.quantity.toLocaleString()} units</p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={trendInsights.primaryMetricName}
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#2563eb', strokeWidth: 1, stroke: '#ffffff' }}
                            activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#bfdbfe', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Multi-Metric Trend Grid if multiple metrics exist */}
                  {trendInsights.trendItems.length > 1 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Evaluated Metric Summaries
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {trendInsights.trendItems.map((item, idx) => (
                          <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 capitalize">{item.metric}</span>
                              <span
                                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                                  item.trend.toLowerCase() === 'increasing'
                                    ? 'bg-blue-100 text-blue-700'
                                    : item.trend.toLowerCase() === 'decreasing'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {item.trend}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5 leading-snug">{item.evidence}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Trend Analysis Unavailable Informative State */
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-8 text-center max-w-lg mx-auto my-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Temporal Trend Analysis Unavailable</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    This dataset does not contain a suitable time/date field for time-based trend analysis.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    The Trend Intelligence Agent requires temporal columns (such as date, order_date, or timestamp) to evaluate trajectory momentum and directional patterns.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: Anomaly Detection Agent */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">Anomaly Detection Agent</h2>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Outlier & Business Risk Identification
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Responsible for detecting unusual values in metrics such as revenue, price, quantity, and demand, and explaining their potential business significance.
                  </p>
                </div>
              </div>

              <div className="self-start sm:self-auto flex-shrink-0">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${outlierInsights.statusBadgeColor}`}>
                  {outlierInsights.count > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse"></span>
                  ) : (
                    <svg className="w-3.5 h-3.5 mr-1.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {outlierInsights.statusLabel}
                </span>
              </div>
            </div>

            {/* Section Body */}
            <div className="p-6">
              {outlierInsights.count > 0 ? (
                <div className="space-y-6">
                  {/* Summary Metric Strip for Outliers */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200/60">
                    <div>
                      <span className="text-[11px] font-medium text-amber-900/70 uppercase tracking-wide block">Detected Outliers</span>
                      <p className="text-lg font-bold text-amber-900 mt-0.5">
                        {outlierInsights.count} {outlierInsights.count === 1 ? 'Record' : 'Records'}
                      </p>
                      <span className="text-[10px] text-amber-700">Flagged anomalies</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-amber-900/70 uppercase tracking-wide block">Primary Affected Metric</span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {outlierInsights.rawOutliers[0]?.metric || 'Metric'}
                      </p>
                      <span className="text-[10px] text-slate-500">Highest deviation</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-amber-900/70 uppercase tracking-wide block">Detection Baseline</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        Z-Score (±3.0σ)
                      </p>
                      <span className="text-[10px] text-slate-500">Statistical bounds</span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-amber-900/70 uppercase tracking-wide block">Action Impact</span>
                      <p className="text-sm font-semibold text-amber-800 mt-0.5">
                        Demand Skew Risk
                      </p>
                      <span className="text-[10px] text-amber-600">Review recommended</span>
                    </div>
                  </div>

                  {/* Visual Treatment: Outlier Distribution / Scatter Plot */}
                  <div className="border border-slate-200 rounded-xl p-5 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">
                          Anomaly Deviation Distribution
                        </h4>
                        <p className="text-xs text-slate-500">
                          Scatter plot positioning flagged outlier values against standard expectations
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5"></span>
                          Unusually High
                        </span>
                        <span className="flex items-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 mr-1.5"></span>
                          Unusually Low
                        </span>
                      </div>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 10, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="id"
                            name="Anomaly Index"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickFormatter={(v) => `#${v}`}
                          />
                          <YAxis
                            dataKey="value"
                            name="Observed Value"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => {
                              if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                              if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                              return v;
                            }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const pt = payload[0].payload;
                                return (
                                  <div className="bg-white p-3.5 rounded-lg shadow-md border border-slate-200 text-xs max-w-xs">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="font-bold text-slate-900">{pt.metric} Outlier</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        pt.status.toLowerCase().includes('high') ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {pt.status}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mb-1">
                                      Observed Value: {Number(pt.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </p>
                                    {pt.upperRange && (
                                      <p className="text-slate-500 mb-1">
                                        Expected Range: {pt.lowerRange?.toLocaleString()} to {pt.upperRange?.toLocaleString()}
                                      </p>
                                    )}
                                    <p className="text-slate-600 text-[11px] mt-1 pt-1 border-t border-slate-100">
                                      {pt.name}
                                    </p>
                                    <p className="text-slate-400 text-[10px] mt-0.5">{pt.evidence}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Scatter data={outlierInsights.scatterData}>
                            {outlierInsights.scatterData.map((entry, index) => {
                              const isHigh = entry.status?.toLowerCase().includes('high');
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={isHigh ? '#f59e0b' : '#e11d48'}
                                  stroke="#ffffff"
                                  strokeWidth={2}
                                />
                              );
                            })}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Outlier Detail Table with Context and Explanations */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Detected Unusual Records & Context
                      </h4>
                      <span className="text-xs text-slate-500 font-medium">
                        Showing top {outlierInsights.count} anomalies
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                          <tr>
                            <th scope="col" className="px-4 py-3">Metric</th>
                            <th scope="col" className="px-4 py-3">Unusual Value</th>
                            <th scope="col" className="px-4 py-3">Expected Range</th>
                            <th scope="col" className="px-4 py-3">Status</th>
                            <th scope="col" className="px-4 py-3">Record Context</th>
                            <th scope="col" className="px-4 py-3">Evidence / Explanation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {outlierInsights.rawOutliers.map((o, idx) => {
                            const isHigh = o.status?.toLowerCase().includes('high');
                            const ctx = o.context || {};
                            return (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                  {o.metric}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                                  {Number(o.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                                  {o.expected_range || 'Statistical mean ± 3σ'}
                                </td>
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      isHigh
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}
                                  >
                                    {o.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-slate-700 max-w-xs truncate" title={JSON.stringify(ctx)}>
                                  {ctx.product && (
                                    <span className="block truncate font-medium text-slate-800">
                                      {ctx.product}
                                    </span>
                                  )}
                                  {ctx.order && (
                                    <span className="text-[11px] text-slate-500 block">Order: {ctx.order}</span>
                                  )}
                                  {ctx.location && (
                                    <span className="text-[10px] text-slate-400 block">{ctx.location}</span>
                                  )}
                                  {!ctx.product && !ctx.order && !ctx.location && (
                                    <span className="text-slate-400 italic">Row ID #{idx + 1}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-slate-600 max-w-sm">
                                  <p className="leading-snug text-xs">{o.evidence}</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* No Significant Outliers State */
                <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-8 text-center max-w-lg mx-auto my-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No significant outliers detected</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    No unusually extreme values were found by the Anomaly Detection Agent using the selected detection method (Z-score ±3.0σ).
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    All observed transactions, prices, quantities, and demand figures fall within standard statistical baseline ranges.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Navigation Controls */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={goBack}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-2xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              onClick={goNext}
              className="w-full sm:w-auto inline-flex justify-center items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-2xs text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Continue to Forecasting
              <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* AI Business Assistant Column (Right ~28%): Compact Chatbot */}
        <div className="lg:col-span-4 sticky top-20">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[740px] overflow-hidden">
            {/* Assistant Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-2xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">AI Business Assistant</h3>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] text-slate-500">Grounded in Trend & Anomaly Intelligence</span>
                  </div>
                </div>
              </div>

              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearChat}
                  title="Start New Chat"
                  className="text-xs text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Chat Stream / Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col justify-between py-2 text-center">
                  <div className="my-auto px-2">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 mx-auto flex items-center justify-center mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Ask Questions About Your Analysis
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Query trajectory drivers, statistical outliers, or business risks grounded in <strong>{selectedDataset.name}</strong>.
                    </p>
                  </div>

                  {/* Suggested Prompts */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Suggested Questions
                    </span>
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(null, q)}
                        disabled={isChatLoading}
                        className="w-full text-left text-xs bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 rounded-lg px-3 py-2 transition-colors shadow-2xs leading-snug"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-xs shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${
                            msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                          }`}
                        >
                          {msg.role === 'user' ? 'You' : 'AI Business Assistant'}
                        </div>

                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : msg.error ? (
                          <div className="text-rose-600 flex items-start space-x-1.5">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{msg.error}</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <p className="whitespace-pre-wrap text-slate-700">{msg.data?.answer}</p>

                            {/* Evidence Context Accordion / Badges */}
                            {msg.data?.evidence?.length > 0 && (
                              <details className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                <summary className="cursor-pointer font-semibold text-slate-700 hover:text-blue-600">
                                  Evidence context ({msg.data.evidence.length})
                                </summary>
                                <ul className="mt-1.5 pl-4 list-disc space-y-1 text-[11px]">
                                  {msg.data.evidence.map((ev, i) => (
                                    <li key={i}>{ev}</li>
                                  ))}
                                </ul>
                              </details>
                            )}

                            {/* Confidence & Limitations Strip */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                Confidence:{' '}
                                <strong className="text-slate-600 font-semibold">
                                  {((msg.data?.confidence ?? 0.85) * 100).toFixed(0)}%
                                </strong>
                              </span>
                              {msg.data?.limitations?.length > 0 && (
                                <span className="truncate max-w-[140px]" title={msg.data.limitations.join('; ')}>
                                  {msg.data.limitations[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-2xs flex items-center space-x-1.5 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        <span className="ml-2 text-[11px] font-medium text-slate-400">Consulting dataset...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Chat Error Banner */}
            {chatError && (
              <div className="px-3 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                <span className="truncate pr-2">{chatError}</span>
                <button
                  type="button"
                  onClick={() => setChatError('')}
                  className="text-rose-500 hover:text-rose-700 font-bold ml-1 text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendChat} className="p-3 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about trends, outliers, or risks..."
                  disabled={isChatLoading}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isChatLoading}
                  className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0 shadow-2xs"
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
    </div>
  );
};

export default TrendAnalysis;
