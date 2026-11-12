import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';

const NAV_GROUPS = [
  {
    title: "WORKSPACE",
    items: [
      { name: "Upload Dataset", path: "/app/upload" },
      { name: "Data Understanding", path: "/app/understanding" },
    ]
  },
  {
    title: "ANALYTICS",
    items: [
      { name: "Business Analytics", path: "/app/analytics" },
      { name: "Trends & Outliers", path: "/app/trends" },
      { name: "Demand Forecasting", path: "/app/forecasting" },
      { name: "Risk Detection", path: "/app/risks" },
    ]
  },
  {
    title: "DECISION",
    items: [
      { name: "AI Decision", path: "/app/decision" },
      { name: "Verification", path: "/app/verification" },
    ]
  },
  {
    title: "ASSISTANT",
    items: [
      { name: "Business Chatbot", path: "/app/chatbot" },
      { name: "Chart / Image Understanding", path: "/app/vision" }
    ]
  }
];

// Flat list for "next/back" navigation
const PAGES = NAV_GROUPS.flatMap(group => group.items);

const DashboardLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [graphContext, setGraphContext] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await api.get('/datasets');
      setDatasets(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleSelectDatasetId = useCallback((id) => {
    setSelectedDatasetId(id);
    setGraphContext(null);
  }, []);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);
  const currentIndex = PAGES.findIndex(p => location.pathname === p.path);
  
  const currentPage = PAGES.find(p => p.path === location.pathname);
  const currentGroup = NAV_GROUPS.find(g => g.items.some(i => i.path === location.pathname));

  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < PAGES.length - 1) {
      navigate(PAGES[currentIndex + 1].path);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      navigate(PAGES[currentIndex - 1].path);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand-200 selection:text-brand-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 flex flex-col shadow-[2px_0_15px_-3px_rgba(0,0,0,0.05)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col">
            <h1 className="text-base font-bold bg-gradient-to-r from-brand-700 to-ai-600 bg-clip-text text-transparent truncate tracking-tight">Business Decision</h1>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Intelligence</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((page, index) => {
                  const isCurrent = location.pathname === page.path;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        navigate(page.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative ${
                        isCurrent 
                          ? 'bg-brand-50 text-brand-700' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-600 rounded-r-md"></div>
                      )}
                      <span className="truncate ml-1">{page.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-ai-500 flex items-center justify-center text-white font-bold mr-3 shadow-sm">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.username}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm relative z-10 sticky top-0">
          <div className="flex items-center">
            <button 
              className="md:hidden mr-4 text-slate-500 hover:text-slate-700"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden sm:flex flex-col">
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                {currentPage?.name || 'Workspace'}
              </h2>
              {currentGroup && (
                <div className="flex items-center text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <span>Workspace</span>
                  <span className="mx-1.5 opacity-50">/</span>
                  <span className="text-brand-600">{currentGroup.title}</span>
                  <span className="mx-1.5 opacity-50">/</span>
                  <span className="truncate">{currentPage?.name}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedDataset ? (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                <svg className="w-4 h-4 mr-2 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">
                  {selectedDataset.name}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-500 italic hidden sm:block bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                No dataset selected
              </span>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto min-h-full flex flex-col">
            <Outlet context={{
              datasets, 
              fetchDatasets, 
              selectedDataset, 
              setSelectedDatasetId: handleSelectDatasetId, 
              goNext, 
              goBack,
              graphContext,
              setGraphContext
            }} />
          </div>
        </main>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
