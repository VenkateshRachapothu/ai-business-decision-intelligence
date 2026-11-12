import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';

const DataUnderstanding = () => {
  const { selectedDataset, fetchDatasets, goBack, goNext } = useOutletContext();

  // State management
  const [understanding, setUnderstanding] = useState(null);
  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewVersion, setPreviewVersion] = useState('auto'); // 'auto' | 'cleaned' | 'original'

  const [isUnderstandingLoading, setIsUnderstandingLoading] = useState(true);
  const [understandingError, setUnderstandingError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState('');
  const [cleanNotice, setCleanNotice] = useState('');

  // Helper to fetch rich dataset understanding (Analysis Agent)
  const fetchUnderstandingData = async (datasetId, isMounted = true) => {
    if (!datasetId) return;
    setIsUnderstandingLoading(true);
    setUnderstandingError('');
    try {
      const uRes = await api.get(`/datasets/${datasetId}/understanding`);
      if (!isMounted) return;
      setUnderstanding(uRes.data);
    } catch (err) {
      if (!isMounted) return;
      console.warn('Understanding endpoint warning:', err);
      setUnderstandingError(err.response?.data?.detail || 'Failed to inspect dataset schema and quality. Please try again.');
    } finally {
      if (isMounted) setIsUnderstandingLoading(false);
    }
  };

  // Helper to fetch preview with version toggle
  const fetchPreviewData = (datasetId, version = 'auto', isMounted = true) => {
    setIsPreviewLoading(true);
    api.get(`/datasets/${datasetId}/preview`, { params: { limit: 20, version } })
      .then((pRes) => {
        if (!isMounted) return;
        setPreview(pRes.data);
        setPreviewVersion(pRes.data?.version_used || version);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Preview loading warning:', err);
      })
      .finally(() => {
        if (isMounted) setIsPreviewLoading(false);
      });
  };

  // Initial data loading on dataset selection
  useEffect(() => {
    if (!selectedDataset?.id) {
      setIsUnderstandingLoading(false);
      setIsPreviewLoading(false);
      return;
    }

    let isMounted = true;
    setError('');
    setCleanNotice('');

    // 1. Fetch Cleaning Summary (checks if already cleaned)
    api.get(`/datasets/${selectedDataset.id}/cleaning-summary`)
      .then((sRes) => {
        if (!isMounted) return;
        if (sRes.data && sRes.data.status === 'cleaned') {
          setSummary(sRes.data);
        } else {
          setSummary(null);
        }
      })
      .catch(() => {
        if (isMounted) setSummary(null);
      });

    // 2. Fetch Rich Understanding (Analysis Agent findings)
    fetchUnderstandingData(selectedDataset.id, isMounted);

    // 3. Fetch Bounded 20-Record Preview
    fetchPreviewData(selectedDataset.id, 'auto', isMounted);

    return () => {
      isMounted = false;
    };
  }, [selectedDataset?.id]);

  // User-triggered cleaning action
  const handleClean = async () => {
    if (!selectedDataset?.id || isCleaning) return;
    setIsCleaning(true);
    setError('');
    setCleanNotice('');

    try {
      const cleanRes = await api.post(`/datasets/${selectedDataset.id}/clean`);
      setSummary(cleanRes.data);
      setCleanNotice('Dataset cleaned successfully! Quality issues resolved and verified.');

      // Refresh understanding data so quality metrics reflect cleaned state
      await fetchUnderstandingData(selectedDataset.id);

      // Re-fetch preview to display cleaned records by default
      fetchPreviewData(selectedDataset.id, 'cleaned');

      // Update parent list in layout
      if (fetchDatasets) {
        await fetchDatasets();
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Data cleaning failed. Please try again.');
    } finally {
      setIsCleaning(false);
    }
  };

  // Toggle preview version between cleaned and original
  const handleTogglePreviewVersion = (ver) => {
    if (!selectedDataset?.id || isPreviewLoading || ver === previewVersion) return;
    fetchPreviewData(selectedDataset.id, ver);
  };

  if (!selectedDataset) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-4 shadow-xs">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800">No Dataset Selected</h2>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
          Please select or upload a business dataset first to view data understanding and quality metrics.
        </p>
        <button
          onClick={goBack}
          className="mt-6 inline-flex items-center px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl shadow-sm shadow-purple-200 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Go Back to Upload Dataset
        </button>
      </div>
    );
  }

  const isDatasetCleaned = !!summary || selectedDataset.processing_status === 'cleaned';
  const displayRows = summary?.cleaned_row_count ?? understanding?.rows ?? selectedDataset.row_count;
  const displayCols = understanding?.columns ?? selectedDataset.column_count;

  // Analysis status
  const analysisStatus = isUnderstandingLoading
    ? 'Analyzing Dataset...'
    : understandingError
    ? 'Analysis Failed'
    : understanding
    ? 'Analysis Completed'
    : 'Ready to Analyze';

  // Cleaning status
  const cleaningStatus = isCleaning
    ? 'Cleaning Dataset...'
    : isDatasetCleaned
    ? 'Cleaned & Ready'
    : 'Action Required';

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Simple Page Heading & Dataset Identity Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Understand Your Data
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600">
            See what your business data contains and how AI prepares it for analysis.
          </p>
        </div>

        {/* Dataset Identity Strip */}
        <div className="inline-flex flex-wrap items-center bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs gap-3 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-bold text-slate-800 truncate max-w-[200px]" title={selectedDataset.name}>
              {selectedDataset.name}
            </span>
          </div>

          <span className="text-slate-300">•</span>

          <span className="text-slate-600 font-medium">
            <strong className="text-slate-800 font-bold mr-1">
              {displayRows != null && displayRows > 0 ? displayRows.toLocaleString() : '—'}
            </strong>
            rows
          </span>

          <span className="text-slate-300">•</span>

          <span className="text-slate-600 font-medium">
            <strong className="text-slate-800 font-bold mr-1">{displayCols ?? '—'}</strong>
            columns
          </span>

          <span className="text-slate-300">•</span>

          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
            isDatasetCleaned
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isDatasetCleaned ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {isDatasetCleaned ? 'Cleaned' : 'Uploaded'}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-sm text-red-800">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold ml-2">×</button>
        </div>
      )}

      {cleanNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-sm text-emerald-800">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1 font-medium">{cleanNotice}</div>
          <button onClick={() => setCleanNotice('')} className="text-emerald-400 hover:text-emerald-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Main Workspace: TWO SIDE-BY-SIDE AGENT PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
        {/* ========================================================= */}
        {/* LEFT PANEL — DATASET ANALYSIS AGENT                       */}
        {/* ========================================================= */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            {/* Agent Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Dataset Analysis Agent</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Understands what your business dataset contains and derives business intelligence.</p>
                </div>
              </div>

              {/* Status Indicator */}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isUnderstandingLoading
                  ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                  : understandingError
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : understanding
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isUnderstandingLoading ? 'bg-blue-500' : understandingError ? 'bg-red-500' : understanding ? 'bg-emerald-500' : 'bg-slate-400'
                }`}></span>
                {analysisStatus}
              </span>
            </div>

            {/* Error State */}
            {understandingError && !isUnderstandingLoading && (
              <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 mb-5 text-xs text-red-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Analysis Error</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchUnderstandingData(selectedDataset.id)}
                    className="inline-flex items-center px-2 py-1 bg-white border border-red-300 rounded text-red-700 hover:bg-red-50 font-semibold text-[11px] cursor-pointer"
                  >
                    Retry Analysis
                  </button>
                </div>
                <p className="mt-1.5 text-slate-600">{understandingError}</p>
              </div>
            )}

            {/* Loading Skeleton State */}
            {isUnderstandingLoading && (
              <div className="space-y-4 animate-pulse mb-5">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-blue-200 rounded w-1/3"></div>
                    <div className="h-4 bg-blue-200 rounded w-20"></div>
                  </div>
                  <div className="space-y-2 mt-3">
                    <div className="h-3 bg-blue-100 rounded w-full"></div>
                    <div className="h-3 bg-blue-100 rounded w-4/5"></div>
                  </div>
                </div>
                <div className="text-center py-6 text-xs text-blue-600 font-medium">
                  Dataset Analysis Agent is inspecting columns, calculating unique entities, and deriving business domain...
                </div>
              </div>
            )}

            {/* Analysis Findings (When loaded) */}
            {understanding && !isUnderstandingLoading && (
              <div className="space-y-4">
                {/* 1. Dataset Business Profile & Plain-Language Summary */}
                <div className="bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-white border border-blue-200/80 rounded-xl p-4 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-100">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                          Inferred Domain Identity
                        </span>
                        {understanding.confidence != null && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                            {Math.round(understanding.confidence * 100)}% Confidence
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                        {understanding.dataset_title || understanding.domain || 'Dataset Profile'}
                      </h3>
                    </div>

                    {understanding.domain && (
                      <span className="text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs self-start sm:self-center">
                        {understanding.domain}
                      </span>
                    )}
                  </div>

                  {/* Business Summary Text */}
                  <div className="mt-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center">
                      <svg className="w-3.5 h-3.5 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Business Intelligence Summary
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                      {understanding.summary_text}
                    </p>
                  </div>

                  {/* Feasible Downstream Analyses Chips */}
                  {understanding.feasible_analyses?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-100/70">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Downstream AI Capabilities
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {understanding.feasible_analyses.map((item, idx) => (
                          <span
                            key={idx}
                            title={item.reason}
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              item.feasible
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through decoration-slate-400'
                            }`}
                          >
                            <span className="mr-1">{item.feasible ? '✓' : '✕'}</span>
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANEL — DATA CLEANING AGENT                         */}
        {/* ========================================================= */}
        <div className={`bg-white border rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between ${
          isDatasetCleaned ? 'border-emerald-200' : 'border-purple-200'
        }`}>
          <div>
            {/* Agent Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
              <div className="flex items-center space-x-3.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs border ${
                  isDatasetCleaned 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : 'bg-purple-50 text-purple-600 border-purple-200'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Data Cleaning Agent</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Finds data-quality problems and prepares reliable data for analysis.</p>
                </div>
              </div>

              {/* Status Indicator */}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isCleaning
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                  : isDatasetCleaned
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isCleaning ? 'bg-amber-500' : isDatasetCleaned ? 'bg-emerald-500' : 'bg-purple-500'
                }`}></span>
                {cleaningStatus}
              </span>
            </div>

            {/* Quality Checks & Findings */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center">
                <svg className="w-3.5 h-3.5 mr-1.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Quality Inspection Findings (Original Dataset)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Check 1: Duplicates */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                  <span className="text-slate-400 font-medium">Duplicate Records:</span>
                  <div className="text-base font-bold mt-0.5">
                    {understanding ? (
                      understanding.quality.duplicates > 0 ? (
                        <span className="text-amber-700">{understanding.quality.duplicates.toLocaleString()} found</span>
                      ) : (
                        <span className="text-emerald-700">0 found</span>
                      )
                    ) : (
                      <span className="text-slate-400">Inspecting...</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">Row-level duplicates</span>
                </div>

                {/* Check 2: Missing Values */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                  <span className="text-slate-400 font-medium">Missing Values:</span>
                  <div className="text-base font-bold mt-0.5">
                    {understanding ? (
                      understanding.quality.total_missing > 0 ? (
                        <span className="text-amber-700">{understanding.quality.total_missing.toLocaleString()} values</span>
                      ) : (
                        <span className="text-emerald-700">0 missing</span>
                      )
                    ) : (
                      <span className="text-slate-400">Inspecting...</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">Across all columns</span>
                </div>

                {/* Check 3: Format Normalization */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 font-medium">Format Standard:</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    Whitespace Trim
                  </div>
                  <span className="text-[11px] text-slate-500">Text columns sanitized</span>
                </div>
              </div>
            </div>

            {/* Cleaning Actions List */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
                <svg className="w-3.5 h-3.5 mr-1.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Real Cleaning Rules Executed
              </h3>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <span className="flex items-center font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2"></span>
                    Deduplication: Remove identical duplicate rows
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isDatasetCleaned ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {isDatasetCleaned ? 'Applied' : 'Available'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <span className="flex items-center font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2"></span>
                    Whitespace Normalization: Trim leading/trailing spaces
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isDatasetCleaned ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {isDatasetCleaned ? 'Applied' : 'Available'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <span className="flex items-center font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2"></span>
                    Missing Value Quantification: Isolate & index null records
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isDatasetCleaned ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {isDatasetCleaned ? 'Applied' : 'Available'}
                  </span>
                </div>
              </div>
            </div>

            {/* When not cleaned yet: guidance notice */}
            {!isDatasetCleaned && (
              <div className="mb-5 bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 text-xs text-purple-900 flex items-start space-x-2.5">
                <svg className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="leading-relaxed">
                  Execute data cleaning to remove duplicate rows, normalize text spacing, and prepare verified records for downstream analytics and forecasting.
                </p>
              </div>
            )}

            {/* Before and After Comparison Table (When Cleaned) */}
            {isDatasetCleaned && summary && (
              <div className="mb-5 bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Cleaning Results: Verified Before & After
                </h4>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-emerald-200 text-slate-500">
                        <th className="py-1.5 font-semibold">Metric</th>
                        <th className="py-1.5 font-semibold text-center">Before Cleaning</th>
                        <th className="py-1.5 font-semibold text-center">After Cleaning</th>
                        <th className="py-1.5 font-semibold text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100 text-slate-800">
                      <tr>
                        <td className="py-1.5 font-medium">Total Records</td>
                        <td className="py-1.5 text-center">{summary.original_row_count?.toLocaleString()}</td>
                        <td className="py-1.5 text-center font-bold text-emerald-700">{summary.cleaned_row_count?.toLocaleString()}</td>
                        <td className="py-1.5 text-right text-emerald-700 font-semibold">
                          {summary.duplicates_removed > 0 ? `-${summary.duplicates_removed.toLocaleString()} dups` : 'Intact'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium">Duplicate Records</td>
                        <td className="py-1.5 text-center text-amber-700">{summary.duplicates_removed?.toLocaleString()}</td>
                        <td className="py-1.5 text-center font-bold text-emerald-700">0</td>
                        <td className="py-1.5 text-right text-emerald-700 font-semibold">Removed</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium">Missing Values</td>
                        <td className="py-1.5 text-center text-amber-700">
                          {summary.original_missing_values != null ? summary.original_missing_values.toLocaleString() : (understanding?.quality.total_missing ?? '—')}
                        </td>
                        <td className="py-1.5 text-center text-slate-700">
                          {summary.remaining_missing_values != null ? summary.remaining_missing_values.toLocaleString() : (understanding?.quality.total_missing ?? '0')}
                        </td>
                        <td className="py-1.5 text-right text-slate-500 font-medium">
                          {summary.missing_values_handled > 0 ? `${summary.missing_values_handled} filled` : '0 filled (Preserved)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium">Whitespace Normalization</td>
                        <td className="py-1.5 text-center text-slate-400">Raw spacing</td>
                        <td className="py-1.5 text-center font-bold text-emerald-700">Trimmed</td>
                        <td className="py-1.5 text-right text-emerald-700 font-semibold">Applied</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="mt-2 text-[11px] text-emerald-800 italic">
                  ✓ Verified: All duplicate rows removed and text whitespace trimmed. Missing values are quantified and preserved to maintain data integrity for modeling.
                </p>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClean}
              disabled={isCleaning}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center shadow-sm cursor-pointer ${
                isCleaning
                  ? 'bg-purple-400 text-white cursor-not-allowed'
                  : isDatasetCleaned
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-200'
                  : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-200 hover:shadow-md'
              }`}
            >
              {isCleaning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Cleaning Dataset...</span>
                </>
              ) : isDatasetCleaned ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Dataset Cleaned (Re-run Cleaning)</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Run Data Cleaning</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Compact Data Preview (Up to 20 Real Records) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">Explore Your Data</h3>
            <p className="text-xs text-slate-500 mt-0.5">Preview actual records from your selected dataset.</p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Version Toggle (Cleaned vs Original) */}
            {preview?.has_cleaned_version && (
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleTogglePreviewVersion('cleaned')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    previewVersion === 'cleaned'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cleaned Data
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePreviewVersion('original')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    previewVersion === 'original'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Original Data
                </button>
              </div>
            )}

            <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {preview?.rows ? `Showing ${preview.rows.length} of ${displayRows?.toLocaleString() || '—'} records` : '20 Record Preview'}
            </span>
          </div>
        </div>

        {/* Loading Spinner for Preview */}
        {isPreviewLoading && (
          <div className="py-12 flex items-center justify-center space-x-2 text-sm text-slate-500">
            <svg className="animate-spin h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading preview records...</span>
          </div>
        )}

        {/* Table View */}
        {!isPreviewLoading && preview && preview.columns && preview.rows && (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-12 text-center">
                    #
                  </th>
                  {preview.columns.map((col) => (
                    <th key={col} scope="col" className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs text-slate-700">
                {preview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-purple-50/20 transition-colors">
                    <td className="px-3.5 py-2 text-[11px] font-mono text-slate-400 text-center bg-slate-50/40">
                      {i + 1}
                    </td>
                    {preview.columns.map((col) => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap">
                        {row[col] !== null && row[col] !== '' ? (
                          String(row[col])
                        ) : (
                          <span className="text-slate-300 italic">null</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Bottom Navigation Bar */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Upload Dataset
        </button>

        <div className="text-xs sm:text-sm text-slate-500 text-center flex items-center space-x-2">
          {isDatasetCleaned ? (
            <span className="flex items-center text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 flex-shrink-0"></span>
              Dataset cleaned and ready for business analytics.
            </span>
          ) : (
            <span className="flex items-center text-slate-500">
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-2 flex-shrink-0"></span>
              Run data cleaning in the right panel to proceed to analytics.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={!isDatasetCleaned}
          className={`w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 ${
            isDatasetCleaned
              ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-200 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-80'
          }`}
        >
          <span>Continue to Business Analytics</span>
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DataUnderstanding;
