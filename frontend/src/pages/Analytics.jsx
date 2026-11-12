import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

const getStorageKey = (userId, datasetId) => `analytics_chat_sessions_${userId || 'guest'}_${datasetId}`;

const Analytics = () => {
  const { selectedDataset, goBack, goNext } = useOutletContext();
  const { user } = useContext(AuthContext);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Business Insights State
  const [trendMetric, setTrendMetric] = useState('revenue'); // 'revenue' | 'orders'
  const [highlightedChart, setHighlightedChart] = useState(null); // 'trend' | 'category' | 'products' | 'location'

  // AI Business Chat State
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch Analytics data for the selected dataset
  useEffect(() => {
    if (!selectedDataset?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    api.get(`/analytics/${selectedDataset.id}`)
      .then((res) => {
        setAnalytics(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Unable to compute business analytics for this dataset.');
        setLoading(false);
      });
  }, [selectedDataset]);

  // Construct initial greeting message
  const createInitialGreeting = (ds, data) => {
    const fileName = ds?.original_filename || ds?.name || 'your dataset';
    const available = [];
    if (data?.summary?.total_revenue != null) available.push('monetary revenue');
    if (data?.summary?.total_orders != null) available.push('order transactions');
    if (data?.summary?.total_quantity != null) available.push('item quantities');
    if (data?.sales_over_time?.length > 0) available.push('temporal trends');
    if (data?.top_products?.length > 0) available.push('top item rankings');
    if (data?.sales_by_category?.length > 0) available.push('category distribution');
    if (data?.sales_by_location?.length > 0) available.push('geographic breakdown');
    if (data?.categorical_distributions?.length > 0) available.push('categorical segment distributions');

    const capText = available.length > 0 ? `I can answer questions regarding ${available.join(', ')}.` : '';

    return {
      id: `msg_${Date.now()}_greeting`,
      role: 'agent',
      answer: `Hello! I am your AI Business Analytics Agent for "${fileName}". ${capText} Ask any question about your data or choose from the suggested prompts below.`,
      evidence: [
        `Dataset: ${fileName}`,
        `Status: ${ds?.processing_status || 'Cleaned'}`,
        `Records: ${(data?.summary?.total_rows || ds?.row_count || 0).toLocaleString()}`,
        `Primary Measure: ${data?.summary?.primary_label || 'Frequency Count'}`
      ],
      confidence: 1.0,
      source: 'system',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Load chat sessions from localStorage when dataset or user changes
  useEffect(() => {
    if (!selectedDataset?.id || !analytics) return;

    const storageKey = getStorageKey(user?.id, selectedDataset.id);
    let loadedSessions = [];

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedSessions = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved chat sessions:', e);
    }

    if (loadedSessions.length === 0) {
      const initialGreeting = createInitialGreeting(selectedDataset, analytics);
      const newInitialSession = {
        id: `session_${Date.now()}`,
        title: 'Initial Analytics Inquiry',
        createdAt: Date.now(),
        messages: [initialGreeting]
      };
      loadedSessions = [newInitialSession];
      try {
        localStorage.setItem(storageKey, JSON.stringify(loadedSessions));
      } catch (e) {
        console.warn('Failed to save initial chat session:', e);
      }
    }

    setSessions(loadedSessions);
    setActiveSessionId(loadedSessions[0].id);
  }, [selectedDataset, analytics, user?.id]);

  // Current active session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;
  }, [sessions, activeSessionId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isAsking]);

  // Suggested questions based strictly on actual dataset fields
  const suggestedQuestions = useMemo(() => {
    if (!analytics) return [];
    const list = [];

    if (analytics.top_products && analytics.top_products.length > 0) {
      list.push('Which products have the highest sales?');
    }
    if (analytics.sales_over_time && analytics.sales_over_time.length > 0) {
      list.push('How have sales changed over time?');
    }
    if (analytics.sales_by_category && analytics.sales_by_category.length > 0) {
      list.push('Which product category performs best?');
    }
    if (analytics.summary?.total_revenue != null || analytics.summary?.total_orders != null) {
      list.push('What are the most important business insights?');
    }
    if (analytics.sales_by_location && analytics.sales_by_location.length > 0) {
      list.push('Which locations generate the most revenue?');
    }

    return list.slice(0, 4);
  }, [analytics]);

  // Save sessions helper
  const persistSessions = (newSessions) => {
    setSessions(newSessions);
    if (selectedDataset?.id) {
      const storageKey = getStorageKey(user?.id, selectedDataset.id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSessions));
      } catch (e) {
        console.warn('Failed to save chat sessions:', e);
      }
    }
  };

  // Start a New Chat
  const handleNewChat = () => {
    if (!selectedDataset) return;
    const greeting = createInitialGreeting(selectedDataset, analytics);
    const newSession = {
      id: `session_${Date.now()}`,
      title: `Conversation ${sessions.length + 1}`,
      createdAt: Date.now(),
      messages: [greeting]
    };
    const updated = [newSession, ...sessions];
    persistSessions(updated);
    setActiveSessionId(newSession.id);
    setIsHistoryDrawerOpen(false);
  };

  // Delete a Conversation Session
  const handleDeleteSession = (sessionIdToDelete, e) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionIdToDelete);
    if (remaining.length === 0) {
      const greeting = createInitialGreeting(selectedDataset, analytics);
      const freshSession = {
        id: `session_${Date.now()}`,
        title: 'Initial Analytics Inquiry',
        createdAt: Date.now(),
        messages: [greeting]
      };
      persistSessions([freshSession]);
      setActiveSessionId(freshSession.id);
    } else {
      persistSessions(remaining);
      if (activeSessionId === sessionIdToDelete) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // Grounded Deterministic Answering Engine
  const generateDeterministicAnswer = (q, data, fileName) => {
    const text = q.toLowerCase();
    const summary = data?.summary || {};
    const topProducts = data?.top_products || [];
    const categories = data?.sales_by_category || [];
    const timeline = data?.sales_over_time || [];
    const locations = data?.sales_by_location || [];
    const isMonetary = summary.total_revenue != null;
    const formatVal = (val, rev) => {
      if (rev != null) return `$${rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (summary.primary_unit === '$') return `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `${Number(val || 0).toLocaleString()} ${summary.primary_unit || 'items'}`;
    };

    // Category questions
    if (text.includes('categor') || text.includes('department') || text.includes('dept') || text.includes('segment')) {
      if (categories.length > 0) {
        const topCat = categories[0];
        const totalCatVal = categories.reduce((acc, c) => acc + (c.revenue ?? c.value ?? 0), 0);
        const topCatVal = topCat.revenue ?? topCat.value ?? 0;
        const share = totalCatVal > 0 ? ((topCatVal / totalCatVal) * 100).toFixed(1) : '0';
        const formattedTop = formatVal(topCat.value, topCat.revenue);
        const runnerUp = categories[1]
          ? ` Following category is "${categories[1].category}" with ${formatVal(categories[1].value, categories[1].revenue)}.`
          : '';

        return {
          answer: `The top-performing category is "${topCat.category}", accounting for ${formattedTop} (${share}% of all categorized data).${runnerUp}`,
          evidence: [
            `Top Category: ${topCat.category} (${formattedTop})`,
            `Total Categorized: ${isMonetary ? `$${totalCatVal.toLocaleString()}` : `${totalCatVal.toLocaleString()} ${summary.primary_unit || 'items'}`}`,
            `Evaluated ${categories.length} distinct categories from ${fileName}`
          ],
          confidence: 0.98,
          chartRef: 'category',
          limitations: isMonetary ? [] : ['Values represent item frequency/quantities, as monetary columns were not present.']
        };
      } else {
        return {
          answer: `Category comparisons cannot be produced because this dataset lacks a recognized 'category' or 'department' column.`,
          evidence: [`Dataset: ${fileName}`, `Field 'category' is missing`],
          confidence: 0.95,
          chartRef: null,
          limitations: ['Missing category column in dataset.']
        };
      }
    }

    // Trend / Over time questions
    if (text.includes('time') || text.includes('trend') || text.includes('chang') || text.includes('month') || text.includes('date') || text.includes('history') || text.includes('order over time')) {
      if (timeline.length > 0) {
        const first = timeline[0];
        const last = timeline[timeline.length - 1];
        const sorted = [...timeline].sort((a, b) => (b.revenue ?? b.value ?? 0) - (a.revenue ?? a.value ?? 0));
        const peak = sorted[0];
        const peakVal = formatVal(peak.value, peak.revenue);

        return {
          answer: `Temporal progression spans from ${first.date} through ${last.date} across ${timeline.length} period(s). Peak period activity occurred during ${peak.date} at ${peakVal} with ${peak.orders ?? 'N/A'} orders/records.`,
          evidence: [
            `Date range: ${first.date} to ${last.date}`,
            `Peak Period: ${peak.date} (${peakVal})`,
            `Recent Period: ${last.date} (${formatVal(last.value, last.revenue)})`
          ],
          confidence: 0.97,
          chartRef: 'trend',
          limitations: []
        };
      } else {
        return {
          answer: `Temporal trends cannot be computed because no valid date or timestamp column was detected in this dataset.`,
          evidence: [`Dataset: ${fileName}`, `Date column unavailable`],
          confidence: 0.95,
          chartRef: null,
          limitations: ['Missing date field in dataset.']
        };
      }
    }

    // Product questions
    if (text.includes('product') || text.includes('item') || text.includes('sku') || text.includes('highest sales') || text.includes('best sell') || text.includes('top sell')) {
      if (topProducts.length > 0) {
        const best = topProducts[0];
        const top3 = topProducts.slice(0, 3);
        const top3List = top3.map((p, i) => `${i + 1}. ${p.name} (${formatVal(p.value, p.revenue)})`).join(', ');

        return {
          answer: `The highest-performing item is "${best.name}" with ${formatVal(best.value, best.revenue)}. Top item performers: ${top3List}.`,
          evidence: top3.map((p, i) => `#${i + 1} ${p.name}: ${formatVal(p.value, p.revenue)}`),
          confidence: 0.98,
          chartRef: 'products',
          limitations: isMonetary ? [] : ['Rankings based on recorded quantity or count rather than monetary revenue.']
        };
      } else {
        return {
          answer: `Item rankings cannot be generated because this dataset does not contain an explicit product or item identifier.`,
          evidence: [`Dataset: ${fileName}`, `Product column unavailable`],
          confidence: 0.95,
          chartRef: null,
          limitations: ['Missing product or item column in dataset.']
        };
      }
    }

    // Location / Regional questions
    if (text.includes('location') || text.includes('region') || text.includes('country') || text.includes('city') || text.includes('where') || text.includes('geographic') || text.includes('state')) {
      if (locations.length > 0) {
        const topLoc = locations[0];
        const top3Loc = locations.slice(0, 3).map((l, i) => `${i + 1}. ${l.location} (${formatVal(l.value, l.revenue)})`).join(', ');

        return {
          answer: `The leading geographical segment is "${topLoc.location}" with ${formatVal(topLoc.value, topLoc.revenue)}. Top locations: ${top3Loc}.`,
          evidence: locations.slice(0, 3).map((l) => `${l.location}: ${formatVal(l.value, l.revenue)}`),
          confidence: 0.97,
          chartRef: 'location',
          limitations: []
        };
      } else {
        return {
          answer: `Geographic breakdown is unavailable because no region, country, or city field was detected in this dataset.`,
          evidence: [`Dataset: ${fileName}`, `Location column unavailable`],
          confidence: 0.95,
          chartRef: null,
          limitations: ['Missing geographic column in dataset.']
        };
      }
    }

    // Default Summary / Important Insights
    const points = [];
    if (summary.total_revenue != null) {
      points.push(`Total revenue is $${summary.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
    } else {
      points.push(`Total dataset volume comprises ${(summary.total_rows || 0).toLocaleString()} records.`);
    }
    if (summary.total_orders != null) {
      points.push(`Total order/transaction volume is ${summary.total_orders.toLocaleString()}.`);
    }
    if (summary.total_quantity != null) {
      points.push(`Total recorded quantity is ${summary.total_quantity.toLocaleString()} units.`);
    }
    if (summary.aov != null) {
      points.push(`Average order value (AOV) is $${summary.aov.toFixed(2)}.`);
    }
    if (topProducts.length > 0) {
      points.push(`Top item is "${topProducts[0].name}" (${formatVal(topProducts[0].value, topProducts[0].revenue)}).`);
    }
    if (categories.length > 0) {
      points.push(`Top category is "${categories[0].category}" (${formatVal(categories[0].value, categories[0].revenue)}).`);
    }
    if (locations.length > 0) {
      points.push(`Leading location is "${locations[0].location}" (${formatVal(locations[0].value, locations[0].revenue)}).`);
    }

    return {
      answer: `Key business insights from ${fileName}:\n• ${points.join('\n• ')}`,
      evidence: [
        summary.total_revenue != null ? `Total Revenue: $${summary.total_revenue.toLocaleString()}` : `Total Records: ${(summary.total_rows || 0).toLocaleString()}`,
        summary.total_orders != null ? `Orders: ${summary.total_orders.toLocaleString()}` : 'Orders: N/A',
        `Primary Measure: ${summary.primary_label || 'Frequency Count'}`
      ],
      confidence: 0.96,
      chartRef: topProducts.length > 0 ? 'products' : (timeline.length > 0 ? 'trend' : 'category'),
      limitations: isMonetary ? [] : ['Non-monetary dataset: metrics represent record volumes and categorical frequencies.']
    };
  };

  // Helper to determine chart reference from text
  const detectChartRef = (question, answer) => {
    const combined = (question + ' ' + answer).toLowerCase();
    if (combined.includes('product') || combined.includes('item') || combined.includes('highest sales') || combined.includes('top sell')) return 'products';
    if (combined.includes('categor') || combined.includes('department')) return 'category';
    if (combined.includes('month') || combined.includes('trend') || combined.includes('time') || combined.includes('date')) return 'trend';
    if (combined.includes('location') || combined.includes('region') || combined.includes('city') || combined.includes('country')) return 'location';
    return null;
  };

  // Handle Send question
  const handleSend = async (questionText) => {
    const q = (questionText || inputQuery).trim();
    if (!q || isAsking || !activeSession) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: q,
      timestamp: currentTime
    };

    // Update session title if default
    let newTitle = activeSession.title;
    if (activeSession.title.startsWith('Conversation') || activeSession.title === 'Initial Analytics Inquiry') {
      newTitle = q.length > 28 ? q.substring(0, 28) + '...' : q;
    }

    const sessionWithUser = {
      ...activeSession,
      title: newTitle,
      messages: [...activeSession.messages, userMsg]
    };

    const updatedSessionsWithUser = sessions.map((s) => (s.id === activeSession.id ? sessionWithUser : s));
    persistSessions(updatedSessionsWithUser);
    setInputQuery('');
    setIsAsking(true);

    const fileName = selectedDataset?.original_filename || selectedDataset?.name || 'Dataset';

    try {
      const res = await api.post('/chat/', {
        dataset_id: selectedDataset.id,
        question: q
      });

      let agentMsg;
      if (res.data && res.data.answer && !res.data.answer.includes('currently unavailable')) {
        const detectedRef = detectChartRef(q, res.data.answer);
        agentMsg = {
          id: `msg_agent_${Date.now()}`,
          role: 'agent',
          answer: res.data.answer,
          evidence: res.data.evidence || [],
          confidence: res.data.confidence,
          limitations: res.data.limitations || [],
          source: 'llm',
          chartRef: detectedRef,
          timestamp: currentTime
        };
      } else {
        const fallback = generateDeterministicAnswer(q, analytics, fileName);
        agentMsg = {
          id: `msg_agent_${Date.now()}`,
          role: 'agent',
          answer: fallback.answer,
          evidence: fallback.evidence,
          confidence: fallback.confidence,
          limitations: fallback.limitations,
          source: 'deterministic',
          chartRef: fallback.chartRef,
          timestamp: currentTime
        };
      }

      const sessionWithAgent = {
        ...sessionWithUser,
        messages: [...sessionWithUser.messages, agentMsg]
      };
      persistSessions(sessions.map((s) => (s.id === activeSession.id ? sessionWithAgent : s)));
    } catch (err) {
      console.warn('Chat API error, using deterministic analytics fallback:', err);
      const fallback = generateDeterministicAnswer(q, analytics, fileName);
      const agentMsg = {
        id: `msg_agent_${Date.now()}`,
        role: 'agent',
        answer: fallback.answer,
        evidence: fallback.evidence,
        confidence: fallback.confidence,
        limitations: fallback.limitations,
        source: 'deterministic',
        chartRef: fallback.chartRef,
        timestamp: currentTime
      };
      const sessionWithAgent = {
        ...sessionWithUser,
        messages: [...sessionWithUser.messages, agentMsg]
      };
      persistSessions(sessions.map((s) => (s.id === activeSession.id ? sessionWithAgent : s)));
    } finally {
      setIsAsking(false);
    }
  };

  // Chart highlight handler
  const handleHighlightChart = (chartId) => {
    setHighlightedChart(chartId);
    const element = document.getElementById(`chart-container-${chartId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedChart(null);
    }, 3500);
  };

  // Helper for human-readable chart names
  const getChartLabel = (ref) => {
    switch (ref) {
      case 'trend':
        return 'Sales & Revenue Trend';
      case 'category':
        return 'Category Performance';
      case 'products':
        return 'Top Products';
      case 'location':
        return 'Geographic Performance';
      default:
        return 'Analytics Visual';
    }
  };

  // Empty dataset state
  if (!selectedDataset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center min-h-[60vh]">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Dataset Selected</h2>
        <p className="text-slate-500 max-w-md">Please select or upload a dataset first to view business analytics and interact with the AI Analytics Agent.</p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-slate-700 font-medium">Computing business analytics & loading AI agent...</p>
        <p className="text-xs text-slate-400 mt-1">Analyzing metrics for {selectedDataset.original_filename || selectedDataset.name}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 my-6 shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0 bg-red-100 p-2 rounded-full">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-base font-bold text-red-800">Analytics Error</h3>
            <div className="mt-1 text-sm text-red-600">
              <p>{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const summary = analytics.summary || {};
  const topProducts = analytics.top_products || [];
  const categories = analytics.sales_by_category || [];
  const timeline = analytics.sales_over_time || [];
  const locations = analytics.sales_by_location || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Two-Panel AI Workspace Grid: ~60% Left (Business Insights) & ~40% Right (AI Business Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT WORKSPACE: Business Insights — Analytics Agent (60%) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Prominent Business Analytics Agent Heading */}
          <div className="border-b border-slate-200 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Analytics Agent</h1>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      Business Insights
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Evaluates commercial metrics, dynamic breakdowns, and distribution patterns from your dataset.
                  </p>
                </div>
              </div>

              {/* Status and Dataset Name Badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 text-xs shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-slate-700 font-mono truncate max-w-[180px]" title={selectedDataset.original_filename || selectedDataset.name}>
                  {selectedDataset.original_filename || selectedDataset.name}
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide">
                  Active Agent
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Metric 1: Total Revenue or Total Dataset Records */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {summary.total_revenue != null ? 'Total Revenue' : 'Total Records'}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 truncate">
                {summary.total_revenue != null
                  ? `$${summary.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (summary.total_rows || selectedDataset.row_count || 0).toLocaleString()}
              </div>
            </div>

            {/* Metric 2: Total Orders or Unique Entities */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {summary.total_orders != null && analytics.column_mapping?.order ? 'Total Orders' : 'Unique Entities'}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 truncate">
                {(summary.total_orders != null ? summary.total_orders : (summary.total_rows || 0)).toLocaleString()}
              </div>
            </div>

            {/* Metric 3: Quantity Sold or Categories/Items */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500"></div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {summary.total_quantity != null ? 'Quantity Sold' : (categories.length > 0 ? 'Categories' : 'Distinct Items')}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 truncate">
                {summary.total_quantity != null
                  ? summary.total_quantity.toLocaleString()
                  : (categories.length > 0 ? categories.length.toLocaleString() : topProducts.length.toLocaleString())}
              </div>
            </div>

            {/* Metric 4: Avg Order Value or Primary Measure */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {summary.aov != null ? 'Avg Order Value' : 'Primary Measure'}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 truncate">
                {summary.aov != null
                  ? `$${summary.aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (summary.primary_label || 'Categorical')}
              </div>
            </div>
          </div>

          {/* Dynamic Visualizations Grid — Guaranteed No Empty Boxes */}
          {(() => {
            // Build the dynamic list of charts that have real data
            const displayCharts = [];

            // 1. Temporal Trend Chart
            if (timeline.length > 0) {
              const hasRev = timeline.some((t) => t.revenue != null);
              const hasOrders = timeline.some((t) => t.orders != null);
              displayCharts.push(
                <div
                  key="chart-trend"
                  id="chart-container-trend"
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all duration-300 ${
                    highlightedChart === 'trend'
                      ? 'ring-2 ring-indigo-500 border-indigo-400 shadow-md scale-[1.01]'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {trendMetric === 'revenue' && hasRev ? 'Sales & Revenue Trend' : 'Activity Trend Over Time'}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Monthly progression ({timeline.length} periods)
                      </p>
                    </div>

                    {hasRev && hasOrders && (
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                        <button
                          onClick={() => setTrendMetric('revenue')}
                          className={`px-2 py-0.5 rounded-md transition ${
                            trendMetric === 'revenue' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Revenue ($)
                        </button>
                        <button
                          onClick={() => setTrendMetric('orders')}
                          className={`px-2 py-0.5 rounded-md transition ${
                            trendMetric === 'orders' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Orders (#)
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeline} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tickFormatter={(val) =>
                            trendMetric === 'revenue' && hasRev
                              ? val >= 1000
                                ? `$${(val / 1000).toFixed(0)}k`
                                : `$${val}`
                              : val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : val
                          }
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value) => [
                            trendMetric === 'revenue' && hasRev
                              ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${Number(value).toLocaleString()} ${hasOrders ? 'orders' : 'records'}`,
                            trendMetric === 'revenue' && hasRev ? 'Revenue' : (hasOrders ? 'Orders' : 'Volume')
                          ]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey={trendMetric === 'revenue' && hasRev ? 'revenue' : (hasOrders ? 'orders' : 'value')}
                          stroke={trendMetric === 'revenue' && hasRev ? '#6366f1' : '#3b82f6'}
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: trendMetric === 'revenue' && hasRev ? '#6366f1' : '#3b82f6' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            // 2. Category Performance Chart
            if (categories.length > 0) {
              const isMonetary = categories[0].revenue != null;
              displayCharts.push(
                <div
                  key="chart-category"
                  id="chart-container-category"
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all duration-300 ${
                    highlightedChart === 'category'
                      ? 'ring-2 ring-emerald-500 border-emerald-400 shadow-md scale-[1.01]'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Category Performance
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {summary.primary_label || 'Performance'} across {categories.length} categories
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 truncate max-w-[150px]">
                      Top: {categories[0].category}
                    </span>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categories.slice(0, 5)} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tickFormatter={(val) =>
                            isMonetary
                              ? val >= 1000
                                ? `$${(val / 1000).toFixed(0)}k`
                                : `$${val}`
                              : val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : val
                          }
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value) => [
                            isMonetary
                              ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${Number(value).toLocaleString()} ${categories[0].unit || 'items'}`,
                            categories[0].measure_label || (isMonetary ? 'Revenue' : 'Count')
                          ]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            // 3. Top Performing Products / Items Chart
            if (topProducts.length > 0) {
              const isMonetary = topProducts[0].revenue != null;
              displayCharts.push(
                <div
                  key="chart-products"
                  id="chart-container-products"
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all duration-300 ${
                    highlightedChart === 'products'
                      ? 'ring-2 ring-blue-500 border-blue-400 shadow-md scale-[1.01]'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Top Performing Items
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Ranked by {topProducts[0].measure_label || (isMonetary ? 'Revenue' : 'Volume')}
                      </p>
                    </div>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                      Top 5 items
                    </span>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 20, left: -5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          type="number"
                          tickFormatter={(val) =>
                            isMonetary
                              ? val >= 1000
                                ? `$${(val / 1000).toFixed(0)}k`
                                : `$${val}`
                              : val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : val
                          }
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={90}
                          tick={{ fill: '#475569', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value) => [
                            isMonetary
                              ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${Number(value).toLocaleString()} ${topProducts[0].unit || 'items'}`,
                            topProducts[0].measure_label || (isMonetary ? 'Revenue' : 'Volume')
                          ]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            // 4. Geographic Distribution Chart
            if (locations.length > 0) {
              const isMonetary = locations[0].revenue != null;
              displayCharts.push(
                <div
                  key="chart-location"
                  id="chart-container-location"
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all duration-300 ${
                    highlightedChart === 'location'
                      ? 'ring-2 ring-cyan-500 border-cyan-400 shadow-md scale-[1.01]'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Geographic Distribution
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {summary.primary_label || 'Activity'} across {locations.length} location(s)
                      </p>
                    </div>
                    <span className="text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full font-semibold border border-cyan-200 truncate max-w-[150px]">
                      Top: {locations[0].location}
                    </span>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={locations.slice(0, 5)} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="location" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tickFormatter={(val) =>
                            isMonetary
                              ? val >= 1000
                                ? `$${(val / 1000).toFixed(0)}k`
                                : `$${val}`
                              : val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : val
                          }
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value) => [
                            isMonetary
                              ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${Number(value).toLocaleString()} ${locations[0].unit || 'records'}`,
                            locations[0].measure_label || (isMonetary ? 'Revenue' : 'Count')
                          ]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            // 5. Categorical Distribution Charts (e.g., Status, Customer Segment)
            if (analytics.categorical_distributions && analytics.categorical_distributions.length > 0) {
              analytics.categorical_distributions.forEach((dist, idx) => {
                displayCharts.push(
                  <div
                    key={`chart-cat-dist-${dist.column}`}
                    id={`chart-container-cat-${dist.column}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-purple-500' : 'bg-pink-500'}`}></div>
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            {dist.title}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Categorical distribution across {dist.data.length} segments
                        </p>
                      </div>
                      <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-semibold border border-purple-200">
                        {dist.data[0]?.name}: {dist.data[0]?.percentage}%
                      </span>
                    </div>

                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dist.data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(value, name, item) => [
                              `${Number(value).toLocaleString()} records (${item.payload.percentage}%)`,
                              'Frequency'
                            ]}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="count" fill={idx === 0 ? '#8b5cf6' : '#ec4899'} radius={[4, 4, 0, 0]} barSize={26} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              });
            }

            // 6. Numeric Distribution Charts (e.g., Weight spread, Shipping spread)
            if (analytics.numeric_distributions && analytics.numeric_distributions.length > 0) {
              analytics.numeric_distributions.forEach((ndist, idx) => {
                displayCharts.push(
                  <div
                    key={`chart-num-dist-${ndist.column}`}
                    id={`chart-container-num-${ndist.column}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-amber-500' : 'bg-teal-500'}`}></div>
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            {ndist.title}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Histogram spread across interval bins
                        </p>
                      </div>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                        {ndist.data.length} Bins
                      </span>
                    </div>

                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ndist.data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="bin" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(value, name, item) => [
                              `${Number(value).toLocaleString()} items (${item.payload.percentage}%)`,
                              'Observations'
                            ]}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="count" fill={idx === 0 ? '#f59e0b' : '#0d9488'} radius={[4, 4, 0, 0]} barSize={26} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              });
            }

            // If we have an odd number of charts (or fewer than 4), add a rich Schema Findings Card so space is fully utilized
            if (displayCharts.length % 2 !== 0 || displayCharts.length === 0) {
              const mapping = analytics.column_mapping || {};
              displayCharts.push(
                <div
                  key="chart-schema-insights"
                  className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-white rounded-xl border border-indigo-100 p-5 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Agent Schema Understanding
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The Business Analytics Agent dynamically mapped your dataset fields to business dimensions:
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Revenue Field</span>
                        <span className="font-semibold text-slate-800">{mapping.revenue || 'None (Non-monetary)'}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Date Field</span>
                        <span className="font-semibold text-slate-800">{mapping.date || 'None (Cross-sectional)'}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Product / Item</span>
                        <span className="font-semibold text-slate-800">{mapping.product || 'Not identified'}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Category Field</span>
                        <span className="font-semibold text-slate-800">{mapping.category || 'Not identified'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-indigo-100/60 flex items-center justify-between text-[11px] text-indigo-700 font-medium">
                    <span>Verified against {summary.total_rows || selectedDataset.row_count || 0} records</span>
                    <span className="inline-flex items-center text-emerald-600 font-semibold">
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      Real Values Grounded
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayCharts}
              </div>
            );
          })()}

          {/* Compact Aggregated Performance Table */}
          {(topProducts.length > 0 || categories.length > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {categories.length > 0 ? 'Category & Product Performance Records' : 'Top Item Records'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Aggregated metrics calculated dynamically from your dataset
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Verified Data
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">
                        {categories.length > 0 ? 'Category / Segment' : 'Product / SKU'}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {summary.primary_label || 'Value'}
                      </th>
                      <th className="px-3 py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(categories.length > 0 ? categories.slice(0, 5) : topProducts.slice(0, 5)).map((item, idx) => {
                      const name = item.category || item.name;
                      const isMonetary = item.revenue != null;
                      const val = item.revenue != null ? item.revenue : (item.value || 0);
                      const totalVal = categories.length > 0
                        ? categories.reduce((sum, c) => sum + (c.revenue ?? c.value ?? 0), 0)
                        : topProducts.reduce((sum, p) => sum + (p.revenue ?? p.value ?? 0), 0);
                      const pct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2 text-slate-400 font-medium">#{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[180px]" title={name}>
                            {name}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 font-mono">
                            {isMonetary
                              ? `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${Number(val).toLocaleString()} ${item.unit || ''}`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT WORKSPACE: AI Business Chat — Conversational Agent (40%) */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-[calc(100vh-140px)] min-h-[580px] max-h-[820px] sticky top-4">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50/70 via-purple-50/30 to-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">AI Business Chat</h2>
                  <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                    Ask questions and explore insights from your dataset.
                  </p>
                </div>
              </div>
            </div>

            {/* Header Controls: History Drawer Toggle & + New Chat */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
                title="View Conversation History"
                className={`p-1.5 text-xs rounded-lg border transition flex items-center gap-1 ${
                  isHistoryDrawerOpen
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-semibold">{sessions.length}</span>
              </button>

              <button
                onClick={handleNewChat}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Chat</span>
              </button>
            </div>
          </div>

          {/* ChatGPT-style Conversation History Slide Drawer */}
          {isHistoryDrawerOpen && (
            <div className="absolute top-[57px] left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 p-3 shadow-md max-h-56 overflow-y-auto space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Conversation History ({sessions.length})</span>
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  ✕ Close
                </button>
              </div>
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => {
                    setActiveSessionId(sess.id);
                    setIsHistoryDrawerOpen(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition ${
                    sess.id === activeSession?.id
                      ? 'bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="truncate max-w-[240px] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="truncate">{sess.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">
                      {sess.messages?.length || 0} msgs
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(sess.id, e)}
                      title="Delete conversation"
                      className="text-slate-300 hover:text-red-500 transition p-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Suggested Questions Section */}
          {suggestedQuestions.length > 0 && (
            <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-100">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center">
                <svg className="w-3 h-3 mr-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Suggested Dataset Questions:
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    disabled={isAsking}
                    className="text-[11px] bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-md px-2 py-0.5 transition text-left truncate max-w-full disabled:opacity-50 shadow-2xs"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Messages Transcript */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50/40">
            {activeSession?.messages?.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-xl px-3.5 py-2.5 shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        msg.role === 'user' ? 'text-indigo-200' : 'text-indigo-600'
                      }`}
                    >
                      {msg.role === 'user' ? 'You' : 'Analytics Agent'}
                    </span>
                    <span
                      className={`text-[10px] ${
                        msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.role === 'user' ? (
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                        {msg.answer}
                      </p>

                      {/* Supporting Evidence context from dataset */}
                      {msg.evidence && msg.evidence.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-[11px]">
                          <div className="font-semibold text-slate-700 mb-0.5 flex items-center text-[10px]">
                            <svg className="w-3 h-3 mr-1 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Key Evidence Facts:
                          </div>
                          <ul className="space-y-0.5 text-slate-600 pl-3.5 list-disc marker:text-emerald-500">
                            {msg.evidence.map((ev, ei) => (
                              <li key={ei}>{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Connect Chat to Charts: Interactive Highlight Action */}
                      {msg.chartRef && (
                        <div className="pt-1">
                          <button
                            onClick={() => handleHighlightChart(msg.chartRef)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition"
                          >
                            <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Highlight {getChartLabel(msg.chartRef)} in Insights</span>
                          </button>
                        </div>
                      )}

                      {/* Meta badges: Confidence & Source */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[9px]">
                        {msg.confidence != null && (
                          <span className="inline-flex items-center bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            Confidence: {(msg.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                          Grounded in Data
                        </span>
                        {msg.source === 'llm' && (
                          <span className="inline-flex items-center bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                            LLM Verified
                          </span>
                        )}
                        {msg.limitations && msg.limitations.length > 0 && (
                          <span className="inline-flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={msg.limitations.join('; ')}>
                            Note: {msg.limitations[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs flex items-center space-x-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <span className="text-xs text-slate-500 ml-1">Analyzing dataset values...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Composer Anchored at Bottom */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputQuery);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about sales, products, categories, or trends..."
                disabled={isAsking}
                className="flex-1 bg-slate-50 focus:bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
              />
              <button
                type="submit"
                disabled={isAsking || !inputQuery.trim()}
                className="inline-flex items-center justify-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg shadow-2xs transition disabled:cursor-not-allowed"
              >
                {isAsking ? (
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <span>Send</span>
                    <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <button
          onClick={goBack}
          className="w-full sm:w-auto inline-flex justify-center items-center px-5 py-2.5 border border-slate-300 shadow-2xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Data Understanding
        </button>


        <button
          onClick={goNext}
          className="w-full sm:w-auto inline-flex justify-center items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Continue to Trends & Outliers
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Analytics;
