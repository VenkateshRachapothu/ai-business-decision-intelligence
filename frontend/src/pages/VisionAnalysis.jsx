import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';

const VisionAnalysis = () => {
  const { selectedDataset, goBack } = useOutletContext();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!imageFile) return;
    setIsLoading(true);
    setResult(null);
    setError("");

    const formData = new FormData();
    formData.append('image', imageFile);
    if (question) formData.append('question', question);
    if (selectedDataset) formData.append('dataset_id', selectedDataset.id);

    try {
      const res = await api.post('/vision/analyze', formData);
      setResult(res.data);
    } catch (err) {
      setError('Analysis failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Prominent Vision Analysis Agent Heading */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vision Analysis Agent</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Chart & Image Understanding
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Multi-modal AI vision model interpreting business charts, dashboards, and visual metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${
              result?.status === 'SUCCESS'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : result?.status === 'VISION_ANALYSIS_FAILED'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${
                result?.status === 'SUCCESS' ? 'bg-emerald-500 animate-pulse' : result?.status === 'VISION_ANALYSIS_FAILED' ? 'bg-amber-500' : 'bg-slate-400'
              }`}></span>
              {result?.status === 'SUCCESS' ? 'Active Agent' : result?.status === 'VISION_ANALYSIS_FAILED' ? 'Service Unavailable' : 'Standby'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 flex items-start">
        <svg className="w-5 h-5 text-brand-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-brand-800 leading-relaxed">
          <strong>How this works:</strong> This agent uses multi-modal Generative AI (Llama Vision) to analyze the structure and contents of visual data. It attempts to correlate the visual trends with your uploaded dataset context to identify anomalies and provide strategic insights.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Upload Form */}
        <div className="lg:w-1/3 flex flex-col">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm sticky top-6">
            <form onSubmit={handleAnalyze} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Choose Image</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-indigo-400 transition-colors bg-slate-50">
                  <div className="space-y-2 text-center">
                    {imagePreview ? (
                       <img src={imagePreview} alt="Preview" className="mx-auto max-h-32 object-contain rounded" />
                    ) : (
                      <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} required />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Optional Question</label>
                <input 
                  type="text" 
                  value={question} 
                  onChange={e => setQuestion(e.target.value)} 
                  placeholder="e.g. What does this chart show?" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                />
              </div>

              <button 
                type="submit" 
                disabled={isLoading || !imageFile} 
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : 'Analyze Image'}
              </button>
            </form>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 flex items-start">
                  <svg className="h-5 w-5 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:w-2/3 flex flex-col">
          {result ? (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex-1">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="text-base font-semibold text-slate-900">Analysis Result</h3>
                {result.chart_type && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {result.chart_type}
                  </span>
                )}
              </div>
              
              <div className="p-6 space-y-6">
                <div className={`${result.status === 'VISION_ANALYSIS_FAILED' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'} border p-4 rounded-lg`}>
                  <h4 className={`text-sm font-semibold mb-2 ${result.status === 'VISION_ANALYSIS_FAILED' ? 'text-amber-900' : 'text-slate-900'}`}>Executive Summary</h4>
                  <p className={`text-sm leading-relaxed ${result.status === 'VISION_ANALYSIS_FAILED' ? 'text-amber-800' : 'text-slate-700'}`}>{result.summary}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-200 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Observations
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      {result.observations?.map((o, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-slate-400 mr-2 mt-0.5">•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="border border-slate-200 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Trends
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      {result.trends?.map((t, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-slate-400 mr-2 mt-0.5">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="border border-slate-200 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Anomalies
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      {result.anomalies?.map((a, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-slate-400 mr-2 mt-0.5">•</span>
                          <span>{a}</span>
                        </li>
                      ))}
                      {(!result.anomalies || result.anomalies.length === 0) && (
                        <li className="text-slate-400 italic">No significant anomalies detected.</li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="border border-red-100 bg-red-50 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Risks
                    </h4>
                    <ul className="space-y-2 text-sm text-red-700">
                      {result.risks?.map((r, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-red-400 mr-2 mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                      {(!result.risks || result.risks.length === 0) && (
                        <li className="text-red-400 italic">No risks identified in this view.</li>
                      )}
                    </ul>
                  </div>
                </div>
                
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center">
                     <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                     </svg>
                     Strategic Recommendations
                  </h4>
                  <ul className="space-y-2 text-sm text-indigo-800">
                    {result.recommendations?.map((r, i) => (
                      <li key={i} className="flex items-start bg-white p-2 rounded border border-indigo-100">
                        <span className="text-indigo-400 mr-2 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
                  <div>
                    <p className="mb-1"><span className="font-medium text-slate-700">Confidence:</span> <span className={(result.confidence ?? 0) > 0.8 ? 'text-emerald-600' : 'text-amber-600'}>{((result.confidence ?? 0) * 100).toFixed(0)}%</span></p>
                    <p><span className="font-medium text-slate-700">Limitations:</span> {result.limitations?.join('; ') || 'None'}</p>
                  </div>
                  <div className="sm:text-right">
                    {selectedDataset && <p className="mt-1 sm:mt-0"><span className="font-medium text-slate-700">Dataset Context:</span> {selectedDataset.name}</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 text-slate-500 py-20 min-h-[400px]">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium text-slate-600">No Image Analyzed</p>
              <p className="text-sm mt-1">Upload a business chart to see the AI interpretation here.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
        <button 
          onClick={goBack} 
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        

      </div>
    </div>
  );
};

export default VisionAnalysis;
