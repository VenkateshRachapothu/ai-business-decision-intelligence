import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import api from '../api';

const RiskDetection = () => {
  const { selectedDataset, goBack, goNext } = useOutletContext();
  const [risks, setRisks] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(Boolean(selectedDataset));
  const [error, setError] = useState('');

  // Selected Risk State (index in prioritizedRisks array)
  const [selectedRiskIdx, setSelectedRiskIdx] = useState(0);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Risk Assistant State
  const [chatHistory, setChatHistory] = useState([]);
  const [chatQuestion, setChatQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const messagesEndRef = useRef(null);

  // Suggested questions from user requirements
  const suggestedQuestions = [
    'What is the biggest risk?',
    'Why is this product high risk?',
    'Which products have declining demand?',
    'What evidence supports this risk?',
    'What could happen if this trend continues?',
    'What action should I take first?',
    'Are there any significant risks?',
    "Why couldn't the system detect a stock-out risk?"
  ];

  const [prevDatasetId, setPrevDatasetId] = useState(selectedDataset?.id);

  if (selectedDataset?.id !== prevDatasetId) {
    setPrevDatasetId(selectedDataset?.id);
    setLoading(true);
    setError('');
    setSelectedRiskIdx(0);
  }

  // Fetch risks and companion analytics data
  useEffect(() => {
    if (!selectedDataset) return;
    let isCurrent = true;

    Promise.all([
      api.get(`/risks/${selectedDataset.id}`),
      api.get(`/analytics/${selectedDataset.id}`).catch(() => null)
    ])
      .then(([riskRes, analyticsRes]) => {
        if (!isCurrent) return;

        if (riskRes.data.status === 'success') {
          setRisks(riskRes.data.data.risks || []);
        } else {
          setError(riskRes.data.message || 'Risk detection failed.');
        }

        if (analyticsRes && analyticsRes.data) {
          setAnalyticsData(analyticsRes.data);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Risk detection loading error:', err);
        setError(err.response?.data?.detail || err.message || 'Unable to load risk detection results.');
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDataset]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  // Deterministic Prioritization of Risks:
  // High -> Medium -> Low; within severity by confidence descending
  const prioritizedRisks = useMemo(() => {
    if (!risks || !Array.isArray(risks)) return [];
    const severityRank = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    return [...risks].map((item, originalIndex) => ({
      ...item,
      originalIndex,
      cleanEvidence: Array.isArray(item.evidence) ? item.evidence : [item.evidence].filter(Boolean)
    })).sort((a, b) => {
      const scoreA = severityRank[a.severity] || 0;
      const scoreB = severityRank[b.severity] || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }, [risks]);

  // 4 Reconciled Summary Counts
  const summaryCounts = useMemo(() => {
    if (!risks || !Array.isArray(risks)) {
      return { total: 0, high: 0, medium: 0, low: 0, status: 'No Data' };
    }
    const total = risks.length;
    const high = risks.filter((r) => r.severity === 'High' || r.severity === 'Critical').length;
    const medium = risks.filter((r) => r.severity === 'Medium').length;
    const low = risks.filter((r) => r.severity === 'Low').length;

    let status = 'No Significant Risks';
    let statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
    if (high > 0) {
      status = 'Attention Required';
      statusColor = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (medium > 0) {
      status = 'Monitor Closely';
      statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (low > 0) {
      status = 'Low Exposure';
      statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    return { total, high, medium, low, status, statusColor };
  }, [risks]);

  // Available unique risk types for filter dropdown
  const uniqueRiskTypes = useMemo(() => {
    if (!risks) return [];
    const types = new Set(risks.map((r) => r.risk_type).filter(Boolean));
    return Array.from(types);
  }, [risks]);

  // Filtered risks for the table
  const filteredRisks = useMemo(() => {
    return prioritizedRisks.filter((r) => {
      if (severityFilter !== 'All' && r.severity !== severityFilter) {
        return false;
      }
      if (typeFilter !== 'All' && r.risk_type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const product = (r.affected_product || '').toLowerCase();
        const type = (r.risk_type || '').toLowerCase();
        const exp = (r.explanation || '').toLowerCase();
        return product.includes(q) || type.includes(q) || exp.includes(q);
      }
      return true;
    });
  }, [prioritizedRisks, severityFilter, typeFilter, searchQuery]);

  // Currently Selected Risk for Priority Panel
  const selectedRisk = useMemo(() => {
    if (prioritizedRisks.length === 0) return null;
    if (selectedRiskIdx >= 0 && selectedRiskIdx < prioritizedRisks.length) {
      return prioritizedRisks[selectedRiskIdx];
    }
    return prioritizedRisks[0];
  }, [prioritizedRisks, selectedRiskIdx]);

  // Context-aware Evidence Chart Data
  const evidenceChartData = useMemo(() => {
    if (!selectedRisk) return null;

    const rType = selectedRisk.risk_type || '';
    const evidenceList = selectedRisk.cleanEvidence || [];
    const evidenceText = evidenceList.join(' ');

    // 1. Sudden Demand Change: "Demand went from 120 to 45 in the last period (-62.5%)"
    const suddenMatch = evidenceText.match(/went from\s+([\d.]+)\s+to\s+([\d.]+)/i);
    if (suddenMatch) {
      const prevVal = parseFloat(suddenMatch[1]);
      const currVal = parseFloat(suddenMatch[2]);
      if (!isNaN(prevVal) && !isNaN(currVal)) {
        return {
          type: 'bar',
          title: 'Period-over-Period Demand Comparison',
          subtitle: 'Actual units recorded in consecutive reporting intervals',
          data: [
            { period: 'Preceding Period', value: prevVal, role: 'baseline', color: '#64748b' },
            { period: 'Recent Period', value: currVal, role: 'current', color: currVal < prevVal ? '#e11d48' : '#0284c7' }
          ],
          unit: 'Units'
        };
      }
    }

    // 2. Low Demand: "Total demand is 14, well below the average of 245.50"
    const lowMatch = evidenceText.match(/Total demand is\s+([\d.]+).*?average of\s+([\d.]+)/i);
    if (lowMatch) {
      const prodVal = parseFloat(lowMatch[1]);
      const avgVal = parseFloat(lowMatch[2]);
      if (!isNaN(prodVal) && !isNaN(avgVal)) {
        return {
          type: 'bar',
          title: 'SKU Demand vs Catalog Average',
          subtitle: 'Cumulative historical sales comparison against catalog benchmark',
          data: [
            { period: 'This Product', value: prodVal, role: 'product', color: '#f59e0b' },
            { period: 'Catalog Average', value: avgVal, role: 'average', color: '#64748b' }
          ],
          unit: 'Units'
        };
      }
    }

    // 3. Unusual Sales / Outlier: "Value: 12.00 vs Expected: 75.00 to 225.00"
    const outlierMatch = evidenceText.match(/Value:\s*([\d.]+)\s*vs\s*Expected:\s*([\d.]+)\s*to\s*([\d.]+)/i);
    if (outlierMatch) {
      const val = parseFloat(outlierMatch[1]);
      const expLow = parseFloat(outlierMatch[2]);
      const expHigh = parseFloat(outlierMatch[3]);
      if (!isNaN(val) && !isNaN(expLow) && !isNaN(expHigh)) {
        return {
          type: 'bar',
          title: 'Observed Anomaly vs Statistical Normal Range',
          subtitle: 'Z-score 3-sigma tolerance boundaries for this metric',
          data: [
            { period: 'Expected Lower', value: expLow, role: 'bound', color: '#cbd5e1' },
            { period: 'Observed Value', value: val, role: 'outlier', color: '#e11d48' },
            { period: 'Expected Upper', value: expHigh, role: 'bound', color: '#cbd5e1' }
          ],
          unit: 'Value'
        };
      }
    }

    // 4. Possible Stock-Out: "Forecasted demand increases from 100.0 to 180.0"
    const stockMatch = evidenceText.match(/increases from\s+([\d.]+)\s+to\s+([\d.]+)/i);
    if (stockMatch) {
      const startVal = parseFloat(stockMatch[1]);
      const endVal = parseFloat(stockMatch[2]);
      if (!isNaN(startVal) && !isNaN(endVal)) {
        return {
          type: 'bar',
          title: 'Projected Demand Acceleration',
          subtitle: 'Expected volume increase over upcoming forecast horizon',
          data: [
            { period: 'Horizon Start', value: startVal, role: 'start', color: '#0284c7' },
            { period: 'Projected Peak', value: endVal, role: 'peak', color: '#f59e0b' }
          ],
          unit: 'Units'
        };
      }
    }

    // 5. Declining Demand: Historical Series from analytics
    if (rType.includes('Declining') && analyticsData && Array.isArray(analyticsData.sales_over_time) && analyticsData.sales_over_time.length >= 3) {
      const series = analyticsData.sales_over_time.slice(-12).map((pt) => ({
        period: pt.date || pt.period || 'Period',
        value: pt.value !== undefined ? pt.value : pt.quantity !== undefined ? pt.quantity : pt.revenue
      }));
      return {
        type: 'line',
        title: 'Historical Demand Trajectory',
        subtitle: 'Recent periods showing persistent downward trend',
        data: series,
        unit: analyticsData.sales_over_time[0]?.unit || 'Units'
      };
    }

    return null;
  }, [selectedRisk, analyticsData]);

  // Domain Grounded Potential Impact & Recommended Action
  const businessImplications = useMemo(() => {
    if (!selectedRisk) {
      return {
        impact: '',
        primaryAction: '',
        checklist: []
      };
    }

    const type = selectedRisk.risk_type || '';

    if (type.includes('Sudden Demand Change (Drop)')) {
      return {
        impact: 'A sudden collapse in sales volume within a single period signals possible stock exhaustion, digital listing suppression, or loss of key customer accounts.',
        primaryAction: 'Audit recent transaction logs and investigate whether channel disruption or inventory shortages occurred.',
        checklist: [
          'Verify if the SKU was unintentionally unlisted or marked out of stock in sales channels.',
          'Check if large recurring B2B orders were deferred or cancelled during this period.',
          'Verify ingestion pipeline integrity for the most recent reporting batch.'
        ]
      };
    }

    if (type.includes('Sudden Demand Change (Spike)')) {
      return {
        impact: 'An unexpected volume surge risks stock exhaustion, backlog delays, and supplier lead-time friction unless buffer levels are adjusted promptly.',
        primaryAction: 'Verify whether the surge reflects sustained demand expansion or an isolated bulk transaction.',
        checklist: [
          'Identify whether a single bulk customer or temporary campaign drove the volume increase.',
          'Check current warehouse stock on hand and supplier reorder lead times.',
          'Adjust safety buffer levels if demand momentum is projected to continue.'
        ]
      };
    }

    if (type.includes('Declining Demand')) {
      return {
        impact: 'A sustained downward trajectory threatens category revenue, compresses gross margins, and risks dead-stock accumulation if replenishment orders are not tapered.',
        primaryAction: 'Review replenishment schedules and conduct a pricing/promotions audit to stimulate velocity.',
        checklist: [
          'Analyze whether the decline is concentrated in specific customer tiers or regions.',
          'Assess competitor pricing and promotion campaigns over the analyzed periods.',
          'Temporarily reduce safety stock buffer to prevent holding excess dead inventory.'
        ]
      };
    }

    if (type.includes('Low Demand')) {
      return {
        impact: 'This SKU underperforms catalog benchmarks, tying up working capital and warehouse space with minimal margin contribution.',
        primaryAction: 'Evaluate product rationalization, markdown strategies, or bundling with high-velocity items.',
        checklist: [
          'Audit unit holding costs and storage duration for this inventory item.',
          'Test targeted promotional bundles or seasonal discounts to accelerate inventory turn.',
          'Consider delisting or replacing with higher-margin alternatives if velocity does not improve.'
        ]
      };
    }

    if (type.includes('Unusual Sales') || type.includes('Outlier')) {
      return {
        impact: 'Extreme statistical deviation indicates either operational friction (such as fulfillment bottlenecks or logging discrepancies) or an uncharacteristic single-period event.',
        primaryAction: 'Inspect raw transaction records to validate whether the outlier represents genuine demand or an operational anomaly.',
        checklist: [
          'Cross-reference order records with customer billing and returns data.',
          'Rule out data entry errors, decimal displacements, or return cancellations.',
          'Document the root cause to avoid skewing downstream forecasting and planning models.'
        ]
      };
    }

    if (type.includes('Stock-Out')) {
      return {
        impact: 'Accelerating projected demand without verified warehouse stock headroom risks inventory shortages, lost orders, and customer dissatisfaction.',
        primaryAction: 'Reconcile on-hand inventory levels against upcoming delivery schedules and expedite replenishment if needed.',
        checklist: [
          'Confirm current warehouse stock balances and work-in-progress supplier purchase orders.',
          'Calculate supplier fulfillment lead times against projected demand growth.',
          'Prioritize stock allocation for high-priority contract commitments.'
        ]
      };
    }

    return {
      impact: 'Identified variance warrants business oversight to prevent potential operational friction or margin leakage.',
      primaryAction: 'Review transaction logs and operational parameters associated with this business entity.',
      checklist: [
        'Inspect source data integrity and recent transaction volume.',
        'Validate operating assumptions with category merchandise managers.',
        'Monitor future periods to confirm if the variance persists.'
      ]
    };
  }, [selectedRisk]);

  // Chatbot Handler: send prompt to /api/chat/
  const handleSendChat = async (e, textToSend = null) => {
    if (e) e.preventDefault();
    const query = (textToSend || chatQuestion).trim();
    if (!query || !selectedDataset || isChatLoading) return;

    const userMessage = { role: 'user', content: query };
    setChatHistory((prev) => [...prev, userMessage]);
    setChatQuestion('');
    setIsChatLoading(true);
    setChatError('');

    try {
      const res = await api.post('/chat/', {
        dataset_id: selectedDataset.id,
        question: query
      });

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          data: res.data
        }
      ]);
    } catch (err) {
      console.error('AI Risk Assistant chat error:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Unable to generate risk answer.';
      setChatError(errMsg);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
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

  // Helper for formatting numeric values
  const formatNum = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = Number(val);
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Render: No Active Dataset Selected
  if (!selectedDataset) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-16 shadow-xs">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Dataset Selected</h2>
        <p className="text-sm text-slate-500 mb-6">
          Please select or upload a cleaned dataset to analyze business vulnerabilities and operational risks.
        </p>
        <button
          onClick={goBack}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
        >
          Select Dataset
        </button>
      </div>
    );
  }

  // Render: Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-3 border-amber-100 border-t-amber-600 animate-spin"></div>
        </div>
        <p className="text-base font-semibold text-slate-800">Evaluating Commercial Vulnerabilities & Risks...</p>
        <p className="text-xs text-slate-500 mt-1">Cross-referencing demand trends, statistical anomalies, and forecast horizons</p>
      </div>
    );
  }

  // Render: Error State
  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Risk Detection</h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Identify business risks, understand the evidence, and prioritize actions.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
          <div className="flex items-start">
            <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mr-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-900">Risk Analysis Unavailable</h3>
              <p className="text-sm text-rose-700 mt-1">
                The Risk Detection Agent could not complete automated verification for this dataset.
              </p>
              <div className="mt-3 p-3 bg-white rounded-lg border border-rose-200 text-xs font-medium text-slate-700">
                <strong className="text-slate-900">Diagnosis:</strong> {error}
              </div>
            </div>
          </div>
        </div>

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
            Continue to AI Decision
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-12">
      {/* 1. Page Header & Agent Status */}
      <header className="border-b border-slate-200/80 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Risk Detection</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  Risk Detection Agent
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Identify business risks, understand the evidence, and prioritize actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]" title={selectedDataset.name}>
                {selectedDataset.original_filename || selectedDataset.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Agent
              </span>
            </div>

            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${summaryCounts.statusColor}`}>
              {summaryCounts.status}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Four Compact Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card A: Total Risks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Risks</span>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          </div>
          <div className="mt-2 flex items-baseline">
            <h2 className="text-2xl font-bold text-slate-900">{summaryCounts.total}</h2>
            <span className="ml-2 text-xs text-slate-500 font-medium">identified</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Distinct verified business risks</p>
        </div>

        {/* Card B: High / Critical Risks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">High / Critical</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="mt-2 flex items-baseline">
            <h2 className="text-2xl font-bold text-rose-700">{summaryCounts.high}</h2>
            <span className="ml-2 text-xs text-rose-600 font-medium">immediate focus</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Requires immediate managerial intervention</p>
        </div>

        {/* Card C: Medium Risks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Medium Risks</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="mt-2 flex items-baseline">
            <h2 className="text-2xl font-bold text-amber-700">{summaryCounts.medium}</h2>
            <span className="ml-2 text-xs text-amber-600 font-medium">monitor closely</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Emerging patterns under active surveillance</p>
        </div>

        {/* Card D: Low Risks */}
        <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Low Risks</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-2 flex items-baseline">
            <h2 className="text-2xl font-bold text-emerald-700">{summaryCounts.low}</h2>
            <span className="ml-2 text-xs text-emerald-600 font-medium">standard track</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Minor variances within acceptable variance</p>
        </div>
      </section>

      {/* 3. Main Dashboard Grid: Left & Center (Priority Panel + Table) & Right (AI Risk Assistant) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left & Middle Area: 8 Columns */}
        <div className="lg:col-span-8 space-y-6">
          {/* A. Top Priority Risk Panel */}
          {selectedRisk ? (
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {selectedRiskIdx === 0 ? 'Top Priority Focus' : 'Selected Risk Inspection'}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">
                      {selectedRisk.risk_type}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedRiskIdx !== 0 && (
                    <button
                      onClick={() => setSelectedRiskIdx(0)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 font-medium transition-colors"
                    >
                      Reset to Top Priority
                    </button>
                  )}
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${
                      selectedRisk.severity === 'High' || selectedRisk.severity === 'Critical'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : selectedRisk.severity === 'Medium'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {selectedRisk.severity} Severity
                  </span>
                </div>
              </div>

              {/* Panel Body */}
              <div className="p-6 space-y-6">
                {/* Identity Metadata Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Affected Target</span>
                    <span className="font-semibold text-slate-900 truncate block mt-0.5" title={selectedRisk.affected_product || 'All Products (Aggregate)'}>
                      {selectedRisk.affected_product || 'All Products (Aggregate)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location / Scope</span>
                    <span className="font-semibold text-slate-700 block mt-0.5">
                      {selectedRisk.affected_location || 'Catalog-Wide'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reliability Metric</span>
                    <div className="flex items-center gap-1.5 mt-0.5" title="Heuristic indicator derived from algorithmic rules, not a calibrated Bayesian probability.">
                      <span className="font-semibold text-slate-800">
                        {(selectedRisk.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.2 rounded bg-slate-200/70">
                        Rule Heuristic
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supporting Evidence Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Observed Trigger Evidence
                  </h3>
                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                    <p className="text-xs font-medium text-slate-800 leading-relaxed">
                      {selectedRisk.explanation}
                    </p>
                    {selectedRisk.cleanEvidence.map((ev, i) => (
                      <div key={i} className="flex items-start text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 mr-2.5 flex-shrink-0"></span>
                        <span className="font-mono text-slate-700 text-[11px] leading-relaxed">{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence Visualization Chart */}
                {evidenceChartData && (
                  <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/40">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{evidenceChartData.title}</h4>
                        <p className="text-[11px] text-slate-500">{evidenceChartData.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
                        {evidenceChartData.unit}
                      </span>
                    </div>

                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {evidenceChartData.type === 'bar' ? (
                          <BarChart data={evidenceChartData.data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNum(v)} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-white p-2.5 rounded-lg shadow-md border border-slate-200 text-xs">
                                      <p className="font-semibold text-slate-800">{d.period}</p>
                                      <p className="text-slate-600 mt-0.5 font-mono">
                                        Value: <strong className="text-slate-900">{formatNum(d.value)}</strong> {evidenceChartData.unit}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={55}>
                              {evidenceChartData.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || '#4f46e5'} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <LineChart data={evidenceChartData.data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNum(v)} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-white p-2.5 rounded-lg shadow-md border border-slate-200 text-xs">
                                      <p className="font-semibold text-slate-800">{d.period}</p>
                                      <p className="text-slate-600 mt-0.5 font-mono">
                                        Volume: <strong className="text-slate-900">{formatNum(d.value)}</strong> {evidenceChartData.unit}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line type="monotone" dataKey="value" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 3, fill: '#e11d48' }} />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Potential Business Impact & Recommended Action Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Potential Impact */}
                  <div className="bg-amber-50/50 rounded-xl border border-amber-200/80 p-4.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Potential Business Impact</span>
                      </div>
                      <p className="text-xs text-amber-950/80 leading-relaxed">
                        {businessImplications.impact}
                      </p>
                    </div>
                    <span className="text-[10px] text-amber-700/80 mt-3 pt-2 border-t border-amber-200/60 block italic">
                      Projected risk outcome if historical trajectory remains unmitigated.
                    </span>
                  </div>

                  {/* Recommended Action */}
                  <div className="bg-indigo-50/50 rounded-xl border border-indigo-200/80 p-4.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span>Recommended Business Action</span>
                      </div>
                      <p className="text-xs font-semibold text-indigo-950 mb-2 leading-relaxed">
                        {businessImplications.primaryAction}
                      </p>
                      <ul className="space-y-1.5 text-xs text-indigo-900/80">
                        {businessImplications.checklist.map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 mr-2 flex-shrink-0"></span>
                            <span className="text-[11px] leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Significant Business Risks Detected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                The Risk Detection Agent evaluated demand trajectories, statistical volume outliers, and forecast headroom across this dataset. No severe operational vulnerabilities exceeded critical thresholds.
              </p>
            </div>
          )}

          {/* B. Detected Business Risks Table */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Controls & Filter Bar */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Detected Business Risks</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any risk row to inspect underlying empirical evidence and operational actions.
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-medium bg-white px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
                  Showing <strong className="text-slate-900">{filteredRisks.length}</strong> of {prioritizedRisks.length} risks
                </div>
              </div>

              {/* Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search */}
                <div>
                  <label htmlFor="risk-search" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Search Product / Keyword
                  </label>
                  <input
                    id="risk-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by SKU, metric, or term..."
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Severity Filter */}
                <div>
                  <label htmlFor="severity-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Filter by Severity
                  </label>
                  <select
                    id="severity-filter"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Severities</option>
                    <option value="High">High Severity</option>
                    <option value="Medium">Medium Severity</option>
                    <option value="Low">Low Severity</option>
                  </select>
                </div>

                {/* Risk Type Filter */}
                <div>
                  <label htmlFor="risk-type-filter" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Filter by Risk Type
                  </label>
                  <select
                    id="risk-type-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Risk Types</option>
                    {uniqueRiskTypes.map((t, idx) => (
                      <option key={idx} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              {filteredRisks.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">
                    <tr>
                      <th scope="col" className="px-5 py-3">Risk Type</th>
                      <th scope="col" className="px-5 py-3">Target / SKU</th>
                      <th scope="col" className="px-5 py-3">Severity</th>
                      <th scope="col" className="px-5 py-3">Key Evidence</th>
                      <th scope="col" className="px-5 py-3">Reliability</th>
                      <th scope="col" className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-xs">
                    {filteredRisks.map((r) => {
                      const isSelected = selectedRisk && selectedRisk.originalIndex === r.originalIndex;
                      return (
                        <tr
                          key={r.originalIndex}
                          onClick={() => {
                            const foundIdx = prioritizedRisks.findIndex((pr) => pr.originalIndex === r.originalIndex);
                            if (foundIdx !== -1) setSelectedRiskIdx(foundIdx);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/40 border-l-4 border-indigo-600'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                            {r.risk_type}
                          </td>
                          <td className="px-5 py-3.5 text-slate-700 max-w-[180px] truncate" title={r.affected_product || 'All Products'}>
                            {r.affected_product || 'All Products'}
                            {r.affected_location ? ` / ${r.affected_location}` : ''}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                                r.severity === 'High' || r.severity === 'Critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : r.severity === 'Medium'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {r.severity}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 max-w-xs">
                            <p className="truncate text-slate-800 font-medium">{r.explanation}</p>
                            <p className="truncate text-[11px] text-slate-400 mt-0.5">
                              {r.cleanEvidence.join(' • ')}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">
                                {(r.confidence * 100).toFixed(0)}%
                              </span>
                              <span className="text-[10px] text-slate-400">Heuristic</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const foundIdx = prioritizedRisks.findIndex((pr) => pr.originalIndex === r.originalIndex);
                                if (foundIdx !== -1) setSelectedRiskIdx(foundIdx);
                              }}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isSelected ? 'Active' : 'Inspect'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <p className="text-sm font-medium">No detected risks match your filter criteria.</p>
                  <button
                    onClick={() => {
                      setSeverityFilter('All');
                      setTypeFilter('All');
                      setSearchQuery('');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 font-semibold"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Area: AI Risk Assistant (4 Columns) */}
        <aside className="lg:col-span-4 sticky top-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[740px] overflow-hidden">
            {/* Chatbot Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-2xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">AI Risk Assistant</h3>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] text-slate-500">Grounded in Risk Records</span>
                  </div>
                </div>
              </div>

              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  className="text-xs text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Chat Stream / Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/40">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col justify-between py-2 text-center">
                  <div className="my-auto px-1">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-2.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Ask Questions About Business Risks
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Query evidence, investigate specific product vulnerabilities, or get prioritized actions grounded in <strong>{selectedDataset.name}</strong>.
                    </p>
                  </div>

                  {/* 8 Suggested Question Chips */}
                  <div className="space-y-1.5 text-left max-h-[360px] overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Suggested Risk Inquiries
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
                        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
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
                          {msg.role === 'user' ? 'You' : 'AI Risk Assistant'}
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
                          <div className="space-y-2">
                            <p className="whitespace-pre-wrap text-slate-700">{msg.data?.answer}</p>

                            {/* Evidence Citation */}
                            {msg.data?.evidence?.length > 0 && (
                              <details className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                <summary className="cursor-pointer font-semibold text-slate-700 select-none">
                                  Cited Evidence ({msg.data.evidence.length})
                                </summary>
                                <ul className="mt-1.5 space-y-1 list-disc list-inside">
                                  {msg.data.evidence.map((ev, i) => (
                                    <li key={i} className="text-[10px] text-slate-600 font-mono">{ev}</li>
                                  ))}
                                </ul>
                              </details>
                            )}

                            {/* Data Limitations */}
                            {msg.data?.limitations?.length > 0 && (
                              <div className="text-[10px] text-amber-700 bg-amber-50/70 p-1.5 rounded border border-amber-200/50">
                                <span className="font-semibold">Caveat:</span> {msg.data.limitations.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-3.5 py-2 text-xs text-slate-500 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                        <span>Grounding response in risk evidence...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChat} className="p-3 border-t border-slate-200 bg-white">
              {chatError && (
                <div className="mb-2 text-[11px] text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-200">
                  {chatError}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  placeholder="Ask a question about business risks..."
                  disabled={isChatLoading}
                  className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatQuestion.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-xs font-semibold shadow-2xs transition-colors flex items-center"
                >
                  <span>Send</span>
                  <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </aside>
      </div>

      {/* 4. Bottom Flow Navigation */}
      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <button
          onClick={goBack}
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-2xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <button
          onClick={goNext}
          className="w-full sm:w-auto inline-flex justify-center items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-2xs text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Continue to AI Decision
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default RiskDetection;
