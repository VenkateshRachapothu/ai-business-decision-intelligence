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
  ReferenceLine
} from 'recharts';
import api from '../api';

const Forecasting = () => {
  const { selectedDataset, goBack, goNext } = useOutletContext();
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(Boolean(selectedDataset));
  const [error, setError] = useState('');

  // Forecast view toggles
  const [showBaselineLine, setShowBaselineLine] = useState(true);
  const [showTopProductsCount, setShowTopProductsCount] = useState(5);

  // Chatbot State
  const [chatHistory, setChatHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!selectedDataset) return;
    let isCurrent = true;
    setLoading(true);
    setError('');

    api.get(`/forecasting/${selectedDataset.id}`)
      .then((res) => {
        if (!isCurrent) return;
        if (res.data.status === 'success') {
          setForecast(res.data.data);
        } else {
          setError(res.data.message || 'Forecasting failed for this dataset.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Forecasting loading error:', err);
        setError(err.response?.data?.detail || 'Unable to load demand forecasting.');
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDataset]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  // Format Helper
  const formatValue = (val, unit = '') => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = Number(val);
    if (unit === '$' || unit.toLowerCase().includes('usd')) {
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
  };

  // Derive Top KPIs and Insights
  const summaryKpis = useMemo(() => {
    if (!forecast || !forecast.future_forecast || forecast.future_forecast.length === 0) {
      return null;
    }

    const future = forecast.future_forecast;
    const futurePeriods = future.length;
    const startDate = future[0]?.date || '';
    const endDate = future[futurePeriods - 1]?.date || '';
    const frequency = forecast.frequency || 'Weekly';

    // 1. Forecast Period
    const periodLabel = `Next ${futurePeriods} ${frequency === 'Weekly' ? 'Weeks' : 'Days'}`;

    // 2. Total Predicted Demand
    const totalPredictedDemand = future.reduce((acc, f) => acc + (f.predicted_demand || 0), 0);
    const targetMetric = forecast.target_metric || 'Demand';
    const unit = forecast.unit || '';

    // 3. Expected Change (Comparison with preceding historical period)
    const precedingDemand = forecast.historical_summary?.preceding_demand ?? 0;
    let pctChange = null;
    let changeDirection = 'stable';

    if (precedingDemand > 0) {
      pctChange = ((totalPredictedDemand - precedingDemand) / precedingDemand) * 100;
      if (pctChange > 2.0) changeDirection = 'increasing';
      else if (pctChange < -2.0) changeDirection = 'decreasing';
      else changeDirection = 'stable';
    }

    // 4. Prediction Reliability from verified XGBoost R2 Score
    const xgbR2 = forecast.evaluation?.xgboost?.r2 ?? null;
    const baselineR2 = forecast.evaluation?.baseline?.r2 ?? null;
    let reliabilityLabel = 'Reliability Not Established';
    let reliabilityColor = 'text-slate-600 bg-slate-50 border-slate-200';
    let reliabilityDesc = 'Evaluation metrics could not be verified.';

    if (xgbR2 !== null) {
      if (xgbR2 >= 0.7) {
        reliabilityLabel = 'High Reliability';
        reliabilityColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        reliabilityDesc = `Model explains ${(xgbR2 * 100).toFixed(1)}% of historical variance.`;
      } else if (xgbR2 >= 0.3) {
        reliabilityLabel = 'Moderate Reliability';
        reliabilityColor = 'text-blue-700 bg-blue-50 border-blue-200';
        reliabilityDesc = `Captures general momentum with notable period variance (R²: ${xgbR2.toFixed(2)}).`;
      } else if (xgbR2 >= 0) {
        reliabilityLabel = 'Low Reliability';
        reliabilityColor = 'text-amber-700 bg-amber-50 border-amber-200';
        reliabilityDesc = `High historical volatility limits statistical certainty (R²: ${xgbR2.toFixed(2)}).`;
      } else {
        reliabilityLabel = 'Reliability Not Established';
        reliabilityColor = 'text-rose-700 bg-rose-50 border-rose-200';
        reliabilityDesc = `Negative R² (${xgbR2.toFixed(2)}). Data exhibits irregular volatility; baseline prediction recommended.`;
      }
    }

    return {
      periodLabel,
      startDate,
      endDate,
      totalPredictedDemand,
      precedingDemand,
      pctChange,
      changeDirection,
      targetMetric,
      unit,
      reliabilityLabel,
      reliabilityColor,
      reliabilityDesc,
      xgbR2,
      baselineR2
    };
  }, [forecast]);

  // Combine Historical + Future Forecast into a unified continuous timeline
  const combinedChartData = useMemo(() => {
    if (!forecast) return [];

    const hist = forecast.historical_data || [];
    const future = forecast.future_forecast || [];

    if (hist.length === 0 && (!forecast.test_chart_data || forecast.test_chart_data.length === 0)) {
      return [];
    }

    // Take the last 20 historical periods for clear view alongside the forecast
    const recentHist = hist.length > 0 ? hist.slice(-20) : (forecast.test_chart_data || []).slice(-20);
    const chart = [];

    recentHist.forEach((h) => {
      chart.push({
        date: h.date,
        actual: h.actual,
        forecast: null,
        baseline: null,
        isFuture: false
      });
    });

    // Link point: connect last historical point to forecast
    if (chart.length > 0 && future.length > 0) {
      const lastHist = chart[chart.length - 1];
      lastHist.forecast = lastHist.actual;
      lastHist.baseline = lastHist.actual;
    }

    future.forEach((f) => {
      chart.push({
        date: f.date,
        actual: null,
        forecast: f.predicted_demand,
        baseline: f.baseline_demand ?? null,
        isFuture: true
      });
    });

    return chart;
  }, [forecast]);

  // Derived Business Insights & Recommendations
  const businessInsights = useMemo(() => {
    if (!summaryKpis) return [];

    const list = [];
    const { pctChange, changeDirection, targetMetric, unit, totalPredictedDemand, precedingDemand, xgbR2, reliabilityLabel } = summaryKpis;

    // 1. Trajectory Insight
    if (changeDirection === 'increasing' && pctChange !== null) {
      list.push({
        type: 'growth',
        title: 'Projected Demand Expansion',
        evidence: `Forecast models anticipate a +${pctChange.toFixed(1)}% volume growth (${formatValue(totalPredictedDemand, unit)} vs ${formatValue(precedingDemand, unit)} previously).`,
        action: 'Coordinate with suppliers to advance procurement orders and prevent buffer depletion.'
      });
    } else if (changeDirection === 'decreasing' && pctChange !== null) {
      list.push({
        type: 'warning',
        title: 'Anticipated Demand Contraction',
        evidence: `Forecast indicates a ${pctChange.toFixed(1)}% contraction from preceding levels (${formatValue(totalPredictedDemand, unit)} vs ${formatValue(precedingDemand, unit)}).`,
        action: 'Audit reorder quantities and avoid surplus inventory commitments before demand stabilizes.'
      });
    } else {
      list.push({
        type: 'neutral',
        title: 'Stable Demand Horizon',
        evidence: `Demand is expected to remain consistent within normal operational thresholds (${formatValue(totalPredictedDemand, unit)}).`,
        action: 'Maintain standard replenishment schedules and focus on lead time optimization.'
      });
    }

    // 2. Best-Selling Product Insight
    const topProd = forecast.product_forecasts?.[0];
    if (topProd) {
      list.push({
        type: 'product',
        title: `Leading Demand Driver: ${topProd.product_name}`,
        evidence: `Expected demand of ${formatValue(topProd.predicted_demand, unit)} (${topProd.expected_change >= 0 ? '+' : ''}${topProd.expected_change}% change), ranking #1 among evaluated items.`,
        action: 'Prioritize inventory availability and verify production capacity for this primary product.'
      });
    }

    // 3. Reliability & Inventory Notice
    if (xgbR2 !== null && xgbR2 < 0) {
      list.push({
        type: 'risk',
        title: 'Volatile Demand Caution',
        evidence: `Model R² score is negative (${xgbR2.toFixed(2)}), showing that demand patterns exhibit erratic spikes or limited historical depth.`,
        action: 'Use the Moving Average baseline as a conservative planning reference and confirm orders manually.'
      });
    } else {
      list.push({
        type: 'notice',
        title: 'Inventory Qualification Policy',
        evidence: `Predictions are grounded in historical ${targetMetric} patterns (${reliabilityLabel}). Lead times, return rates, and supplier minimums are not factored into raw demand totals.`,
        action: 'Reconcile predicted demand figures against on-hand stock and warehouse storage capacity before issuing purchase orders.'
      });
    }

    return list;
  }, [summaryKpis, forecast]);

  // Chat Submission Handler
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
      const errMsg = err.response?.data?.detail || err.message || 'Unable to generate forecast answer.';
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

  // 8 Specific Suggested Question Chips from prompt requirements
  const suggestedQuestions = [
    'Which product will sell the most?',
    'What will demand be next month?',
    'Which products have increasing demand?',
    'Which products have decreasing demand?',
    'Why is demand changing?',
    'Which product has the highest forecast risk?',
    'Should we increase stock?',
    'Explain this forecast in simple words.'
  ];

  if (!selectedDataset) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-16 shadow-xs">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Dataset Selected</h2>
        <p className="text-sm text-slate-500 mb-6">
          Please select or upload a cleaned dataset to run the Demand Forecasting models.
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
        <p className="text-base font-semibold text-slate-800">Training Time-Series Models & Generating Forecast...</p>
        <p className="text-xs text-slate-500 mt-1">Executing XGBoost lag regressions and baseline moving averages</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        {/* Page Header */}
        <header className="border-b border-slate-200/80 pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 border border-indigo-200 flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Demand Forecasting</h1>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Demand Forecasting Agent
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Understand future demand, identify high-potential products, and make better inventory decisions.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[220px]" title={selectedDataset.name}>
                {selectedDataset.original_filename || selectedDataset.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                Evaluation Limited
              </span>
            </div>
          </div>
        </header>

        {/* Informative Limitation Card */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-8 max-w-3xl mx-auto shadow-xs">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900">Forecasting Unavailable for this Dataset</h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                The Demand Forecasting Agent evaluated the dataset schema but determined that reliable time-series modeling cannot be performed.
              </p>
              <div className="mt-4 p-3.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
                <strong className="text-slate-900 font-semibold">Diagnosis:</strong> {error}
              </div>

              <div className="mt-6 bg-white border border-slate-200/80 rounded-xl p-4.5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Technical Requirements for Demand Forecasting:
                </h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2.5"></span>
                    Valid temporal date column (e.g. order_date, transaction_date, timestamp).
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2.5"></span>
                    Numeric commercial measure (quantity or revenue).
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2.5"></span>
                    Minimum of 20 distinct historical time periods for lag and rolling feature engineering.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="pt-6 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={goBack}
            className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-2xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={goNext}
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-2xs text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Continue to Risk Detection
            <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const forecastHorizonStart = forecast.future_forecast?.[0]?.date;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Page Heading, Dataset Selector, and Agent Status */}
      <header className="border-b border-slate-200/80 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 border border-indigo-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Demand Forecasting</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Demand Forecasting Agent
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Understand future demand, identify high-potential products, and make better inventory decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[220px]" title={selectedDataset.name}>
                {selectedDataset.original_filename || selectedDataset.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Model Ready
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Four Compact Forecast Summary KPIs */}
      {summaryKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI A: Forecast Period */}
          <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Forecast Period</span>
            <div className="mt-1 flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-slate-900">{summaryKpis.periodLabel}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate" title={`${summaryKpis.startDate} to ${summaryKpis.endDate}`}>
              {summaryKpis.startDate} → {summaryKpis.endDate}
            </p>
          </div>

          {/* KPI B: Predicted Demand */}
          <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Predicted {summaryKpis.targetMetric}
            </span>
            <div className="mt-1">
              <h2 className="text-xl font-bold text-indigo-950">
                {formatValue(summaryKpis.totalPredictedDemand, summaryKpis.unit)}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Horizon aggregate ({summaryKpis.unit || 'Standard Units'})
            </p>
          </div>

          {/* KPI C: Expected Change */}
          <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Expected Change</span>
            <div className="mt-1 flex items-center">
              {summaryKpis.pctChange !== null ? (
                <>
                  <span
                    className={`text-lg font-bold mr-2 ${
                      summaryKpis.changeDirection === 'increasing'
                        ? 'text-emerald-700'
                        : summaryKpis.changeDirection === 'decreasing'
                        ? 'text-amber-700'
                        : 'text-slate-800'
                    }`}
                  >
                    {summaryKpis.pctChange >= 0 ? '+' : ''}
                    {summaryKpis.pctChange.toFixed(1)}%
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      summaryKpis.changeDirection === 'increasing'
                        ? 'bg-emerald-50 text-emerald-700'
                        : summaryKpis.changeDirection === 'decreasing'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {summaryKpis.changeDirection}
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-600">Comparison N/A</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              vs previous period ({formatValue(summaryKpis.precedingDemand, summaryKpis.unit)})
            </p>
          </div>

          {/* KPI D: Prediction Reliability */}
          <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prediction Reliability</span>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${summaryKpis.reliabilityColor}`}>
                {summaryKpis.reliabilityLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug truncate" title={summaryKpis.reliabilityDesc}>
              {summaryKpis.reliabilityDesc}
            </p>
          </div>
        </div>
      )}

      {/* 3. Main Forecast Chart & AI Business Assistant Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Chart, Best-Selling Table, Methods, Insights (~72%) */}
        <div className="lg:col-span-8 space-y-8">
          {/* MAIN FORECAST CHART: Historical vs Forecasted Demand */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                  Time-Series Trajectory
                </span>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">Historical vs Forecasted Demand</h2>
                </div>
              </div>

              {/* Chart Legend Controls */}
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center font-medium text-slate-600">
                  <span className="w-3 h-0.5 bg-slate-500 mr-1.5"></span>
                  Historical Actual
                </span>
                <span className="flex items-center font-medium text-indigo-700">
                  <span className="w-3 h-0.5 bg-indigo-600 mr-1.5 border-t border-dashed"></span>
                  XGBoost Forecast
                </span>
                {forecast.future_forecast?.[0]?.baseline_demand !== undefined && (
                  <button
                    onClick={() => setShowBaselineLine(!showBaselineLine)}
                    className={`flex items-center px-2 py-0.5 rounded border transition-colors ${
                      showBaselineLine
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                    }`}
                  >
                    <span className="w-2.5 h-0.5 bg-emerald-500 mr-1.5"></span>
                    Moving Avg Baseline
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedChartData} margin={{ top: 15, right: 25, left: 10, bottom: 5 }}>
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
                          const pt = payload[0].payload;
                          return (
                            <div className="bg-white p-3.5 rounded-lg shadow-md border border-slate-200 text-xs max-w-xs">
                              <p className="font-bold text-slate-900 mb-1">{label}</p>
                              {pt.actual !== null && (
                                <p className="text-slate-600 font-medium">
                                  Historical Actual: <strong className="text-slate-900">{formatValue(pt.actual, forecast.unit)}</strong>
                                </p>
                              )}
                              {pt.forecast !== null && pt.isFuture && (
                                <p className="text-indigo-600 font-semibold mt-1">
                                  XGBoost Forecast: <strong className="text-indigo-900">{formatValue(pt.forecast, forecast.unit)}</strong>
                                </p>
                              )}
                              {pt.baseline !== null && pt.isFuture && showBaselineLine && (
                                <p className="text-emerald-600 font-medium mt-0.5">
                                  Moving Avg: {formatValue(pt.baseline, forecast.unit)}
                                </p>
                              )}
                              {pt.isFuture && (
                                <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-[10px] text-indigo-700 font-semibold">
                                  Projected Horizon
                                </span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {forecastHorizonStart && (
                      <ReferenceLine
                        x={forecastHorizonStart}
                        stroke="#6366f1"
                        strokeDasharray="3 3"
                        label={{ value: 'Forecast Horizon Start', position: 'top', fill: '#4f46e5', fontSize: 10, fontWeight: 'bold' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Historical Actual"
                      stroke="#475569"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#475569' }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="XGBoost Forecast"
                      stroke="#6366f1"
                      strokeWidth={3}
                      strokeDasharray="4 4"
                      dot={{ r: 4, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                      connectNulls={true}
                    />
                    {showBaselineLine && (
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        name="Moving Average Baseline"
                        stroke="#10b981"
                        strokeWidth={1.8}
                        strokeDasharray="2 2"
                        dot={false}
                        connectNulls={true}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <span>
                  Frequency: <strong>{forecast.frequency}</strong> · Horizon: <strong>{forecast.future_forecast?.length || 4} intervals</strong>
                </span>
                <span>
                  Primary Measure: <strong>{forecast.target_metric || 'Demand'} ({forecast.unit || 'Standard'})</strong>
                </span>
              </div>
            </div>
          </section>

          {/* 4. FUTURE BEST-SELLING PRODUCTS TABLE */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                  Demand Ranking
                </span>
                <h2 className="text-lg font-bold text-slate-900">Future Best-Selling Products</h2>
                <p className="text-xs text-slate-500 mt-0.5">Which products are expected to have the highest demand?</p>
              </div>

              {forecast.product_forecasts?.length > 5 && (
                <button
                  onClick={() => setShowTopProductsCount(showTopProductsCount === 5 ? 10 : 5)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-auto"
                >
                  {showTopProductsCount === 5 ? 'Show Top 10 Products' : 'Show Top 5 Products'}
                </button>
              )}
            </div>

            <div className="p-0">
              {forecast.product_forecasts && forecast.product_forecasts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 font-medium">
                      <tr>
                        <th scope="col" className="px-5 py-3">Rank</th>
                        <th scope="col" className="px-5 py-3">Product Name / Identifier</th>
                        <th scope="col" className="px-5 py-3">Category</th>
                        <th scope="col" className="px-5 py-3">Preceding Period</th>
                        <th scope="col" className="px-5 py-3">Predicted Demand</th>
                        <th scope="col" className="px-5 py-3">Expected Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {forecast.product_forecasts.slice(0, showTopProductsCount).map((p, idx) => {
                        const isTop = idx === 0;
                        return (
                          <tr
                            key={p.product_id || idx}
                            className={`transition-colors ${
                              isTop ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-700">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                  isTop ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                #{p.rank}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-900 max-w-xs truncate" title={p.product_name}>
                              {p.product_name}
                              {isTop && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                  Top Driver
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                              {p.category || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                              {formatValue(p.previous_demand, forecast.unit)}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                              {formatValue(p.predicted_demand, forecast.unit)}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  p.expected_change > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : p.expected_change < 0
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {p.expected_change >= 0 ? '+' : ''}
                                {p.expected_change}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Product-Level Rankings Unavailable</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    This dataset does not contain an identified product or SKU column. The forecasting model generates total demand aggregates shown in the main chart above.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 5. FORECASTING METHODS (EXACTLY TWO) */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Model Architecture
              </span>
              <h2 className="text-lg font-bold text-slate-900">Forecasting Methods & Model Comparison</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluation results comparing the statistical moving average baseline with gradient boosted regression.
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Method 1: Moving Average (Baseline) */}
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-800">1. Moving Average (Baseline)</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      Baseline
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Uses recent historical values to estimate future demand. It provides a simple baseline for comparison.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/80 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">MAE</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {forecast.evaluation?.baseline?.mae?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">RMSE</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {forecast.evaluation?.baseline?.rmse?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">R² Score</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {forecast.evaluation?.baseline?.r2?.toFixed(3) ?? '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Method 2: Time-Series Machine Learning Model (XGBoost) */}
              <div className="border border-indigo-200 rounded-xl p-5 bg-indigo-50/30 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 rounded-bl-full pointer-events-none opacity-40"></div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-indigo-950">2. XGBoost Machine Learning Model</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white shadow-2xs">
                      Primary Model
                    </span>
                  </div>
                  <p className="text-xs text-indigo-900/80 leading-relaxed mb-4">
                    Learns patterns from historical observations to estimate future demand. It captures non-linear relationships and temporal lag features when suitable data is available.
                  </p>
                </div>

                <div className="pt-3 border-t border-indigo-200/80 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">MAE</span>
                    <span className="font-bold text-indigo-950 mt-0.5 block">
                      {forecast.evaluation?.xgboost?.mae?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">RMSE</span>
                    <span className="font-bold text-indigo-950 mt-0.5 block">
                      {forecast.evaluation?.xgboost?.rmse?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">R² Score</span>
                    <span
                      className={`font-bold mt-0.5 block ${
                        (forecast.evaluation?.xgboost?.r2 ?? 0) >= 0.7
                          ? 'text-emerald-700'
                          : (forecast.evaluation?.xgboost?.r2 ?? 0) >= 0.3
                          ? 'text-indigo-950'
                          : 'text-amber-700'
                      }`}
                    >
                      {forecast.evaluation?.xgboost?.r2?.toFixed(3) ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. BUSINESS INSIGHTS & RECOMMENDED ACTIONS */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Executive Briefing
              </span>
              <h2 className="text-lg font-bold text-slate-900">Business Insights & Recommended Actions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Practical operational guidance derived from model evaluations and projected volume shifts.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {businessInsights.map((insight, idx) => (
                <div key={idx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4.5 flex items-start space-x-3.5">
                  <div className="mt-0.5">
                    {insight.type === 'growth' && (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    )}
                    {insight.type === 'warning' && (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      </div>
                    )}
                    {insight.type === 'product' && (
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    {insight.type === 'risk' && (
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    )}
                    {insight.type !== 'growth' && insight.type !== 'warning' && insight.type !== 'product' && insight.type !== 'risk' && (
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900">{insight.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{insight.evidence}</p>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs">
                      <strong className="text-slate-800 font-semibold">Recommended Action:</strong>{' '}
                      <span className="text-slate-600">{insight.action}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom Navigation */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={goBack}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-2xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              onClick={goNext}
              className="w-full sm:w-auto inline-flex justify-center items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-2xs text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Continue to Risk Detection
              <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Column: Integrated AI Business Assistant (~28%) */}
        <div className="lg:col-span-4 sticky top-20">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[780px] overflow-hidden">
            {/* Assistant Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-2xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">AI Business Assistant</h3>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] text-slate-500">Grounded in Demand Forecasts</span>
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
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Ask Questions About Future Demand
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Query predicted SKU volumes, revenue trajectories, or stock risks grounded in <strong>{selectedDataset.name}</strong>.
                    </p>
                  </div>

                  {/* 8 Suggested Prompts */}
                  <div className="space-y-1.5 text-left max-h-[340px] overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Suggested Questions
                    </span>
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(null, q)}
                        disabled={isChatLoading}
                        className="w-full text-left text-xs bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 rounded-lg px-3 py-2 transition-colors shadow-2xs leading-snug"
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
                            ? 'bg-indigo-600 text-white rounded-br-xs shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${
                            msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
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
                                <summary className="cursor-pointer font-semibold text-slate-700 hover:text-indigo-600">
                                  Forecast Evidence ({msg.data.evidence.length})
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
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        <span className="ml-2 text-[11px] font-medium text-slate-400">Consulting forecast models...</span>
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
                  placeholder="Ask about SKU demand, stock risks..."
                  disabled={isChatLoading}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isChatLoading}
                  className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0 shadow-2xs"
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

export default Forecasting;
