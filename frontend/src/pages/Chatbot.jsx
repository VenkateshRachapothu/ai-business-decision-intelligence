import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';

const Chatbot = () => {
  const { selectedDataset, goBack, goNext } = useOutletContext();
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setChatHistory([]);
  }, [selectedDataset?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  if (!selectedDataset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-lg font-medium text-slate-600">Please select or upload a dataset first.</p>
      </div>
    );
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    const userMsg = { role: 'user', content: question };
    setChatHistory(prev => [...prev, userMsg]);
    setQuestion("");
    setIsLoading(true);

    try {
      const res = await api.post('/chat/', {
        dataset_id: selectedDataset.id,
        question: userMsg.content
      });
      setChatHistory(prev => [...prev, { role: 'agent', data: res.data }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'agent', error: 'Failed to get answer: ' + (err.response?.data?.detail || err.message) }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-150px)]">
      {/* Prominent Business Chatbot Agent Heading */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Chatbot Agent</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Data Assistant Chatbot
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                RAG-powered conversational assistant grounded in your dataset trends, models, and risk analysis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full mr-2 bg-emerald-500 animate-pulse"></span>
              Active Agent
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 flex items-start">
        <svg className="w-5 h-5 text-brand-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-brand-800 leading-relaxed">
          <strong>How this works:</strong> This conversational agent utilizes Retrieval-Augmented Generation (RAG). When you ask a question, it searches the computed business trends, forecasting model evaluations, risk caveats, and raw dataset structure to synthesize an evidence-backed answer.
        </p>
      </div>
      
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-h-[400px]">
        {/* Chat Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-6">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">Ask a business question regarding <strong>{selectedDataset.name}</strong>.</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                <button onClick={() => setQuestion("What are the main risks associated with this data?")} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-100 text-slate-600 transition-colors">What are the main risks?</button>
                <button onClick={() => setQuestion("Can you summarize the forecasting results?")} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-100 text-slate-600 transition-colors">Summarize forecasting</button>
                <button onClick={() => setQuestion("What products are underperforming?")} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-100 text-slate-600 transition-colors">Underperforming products?</button>
              </div>
            </div>
          )}
          
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
              }`}>
                <div className={`text-xs font-medium mb-1 uppercase tracking-wider ${
                  msg.role === 'user' ? 'text-indigo-200' : 'text-slate-500'
                }`}>
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </div>
                
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : msg.error ? (
                  <div className="text-sm text-red-600 flex items-start">
                    <svg className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{msg.error}</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.data.answer}</p>
                    
                    {msg.data.evidence?.length > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded p-3 mt-4 text-xs">
                        <p className="font-semibold text-slate-700 mb-2 flex items-center">
                          <svg className="w-3.5 h-3.5 mr-1.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Evidence Context
                        </p>
                        <ul className="space-y-1.5 text-slate-600 pl-5 list-disc marker:text-slate-300">
                          {msg.data.evidence.map((e, ei) => <li key={ei}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                      <div className="inline-flex items-center bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">
                        <span className="font-medium mr-1">Confidence:</span> 
                        <span className={(msg.data.confidence ?? 0) > 0.8 ? 'text-emerald-600 font-semibold' : 'text-slate-600'}>
                          {((msg.data.confidence ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      {msg.data.limitations?.length > 0 && (
                        <div className="inline-flex items-center text-xs text-slate-500 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                          <svg className="w-3 h-3 mr-1 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="truncate max-w-[200px]" title={msg.data.limitations.join("; ")}>
                            {msg.data.limitations[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex space-x-2 items-center">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSend} className="flex gap-3">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)} 
                placeholder="Ask a question about the data analysis..." 
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                disabled={isLoading}
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || !question.trim()} 
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
          </form>
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
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
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          Continue to Vision Analytics
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Chatbot;
