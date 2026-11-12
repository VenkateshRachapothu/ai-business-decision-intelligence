import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Welcome = () => {
  const { user } = useContext(AuthContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  // Primary onboarding destination based on authentication status
  const primaryActionRoute = user ? '/app/upload' : '/register';

  // Smooth scroll handler with offset consideration
  const handleScrollTo = (e, sectionId) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ScrollSpy to determine active section for subtle nav highlight
  useEffect(() => {
    const sectionIds = ['about', 'platform', 'how-it-works'];
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(sectionIds[i]);
          return;
        }
      }
      setActiveSection('');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1220] py-3 sm:py-6 md:py-8 px-2.5 sm:px-4 md:px-6 lg:px-8 font-sans selection:bg-[#B9DCFF] selection:text-[#0B1220] flex flex-col items-center">
      
      {/* Outer rounded container panel */}
      <div className="w-full max-w-[1360px] bg-gradient-to-b from-[#EAF6FF] via-[#F4FAFF] to-[#EAF6FF] rounded-[24px] sm:rounded-[32px] md:rounded-[40px] border border-white/90 shadow-[0_24px_70px_-15px_rgba(11,18,32,0.45)] relative overflow-hidden flex flex-col">
        
        {/* Subtle decorative background grid pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(22, 114, 249, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(22, 114, 249, 0.045) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
          aria-hidden="true"
        />

        {/* Soft radial blue lighting in hero top */}
        <div 
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[760px] sm:w-[960px] h-[480px] pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(185, 220, 255, 0.6) 0%, rgba(234, 246, 255, 0) 70%)'
          }}
          aria-hidden="true"
        />

        {/* Subtle abstract curve lines */}
        <svg 
          className="absolute top-10 right-0 w-80 md:w-96 h-80 pointer-events-none opacity-20 text-[#1672F9]" 
          viewBox="0 0 400 400" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M50 350C180 320 280 220 350 50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M120 370C220 340 320 250 380 120" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </svg>

        {/* ========================================================= */}
        {/* 2. NAVIGATION BAR                                         */}
        {/* ========================================================= */}
        <header className="sticky top-3 sm:top-5 z-40 px-3 sm:px-6 md:px-8 pt-2">
          <nav 
            className="w-full bg-white/75 backdrop-blur-md border border-white/80 shadow-[0_4px_24px_-4px_rgba(16,27,45,0.06)] rounded-full px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between transition-all"
            aria-label="Main Navigation"
          >
            {/* Brand Logo & Name */}
            <Link 
              to="/" 
              className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1672F9] rounded-full"
            >
              <div className="w-8 h-8 rounded-full bg-[#1672F9]/10 border border-[#1672F9]/20 flex items-center justify-center text-[#1672F9] transition-transform duration-200 group-hover:scale-105">
                {/* Blue analytics / decision intelligence icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <span className="font-semibold text-sm sm:text-base text-[#0B1220] tracking-tight whitespace-nowrap">
                Business Decision Intelligence
              </span>
            </Link>

            {/* Desktop Center Links (Exactly: About, Platform, How It Works — NO Contact) */}
            <div className="hidden md:flex items-center gap-1 sm:gap-2">
              <a
                href="#about"
                onClick={(e) => handleScrollTo(e, 'about')}
                className={`text-sm px-3.5 py-1.5 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#1672F9] ${
                  activeSection === 'about'
                    ? 'text-[#1672F9] font-semibold bg-[#B9DCFF]/30'
                    : 'text-[#506783] hover:text-[#0B1220] hover:bg-white/60 font-medium'
                }`}
              >
                About
              </a>
              <a
                href="#platform"
                onClick={(e) => handleScrollTo(e, 'platform')}
                className={`text-sm px-3.5 py-1.5 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#1672F9] ${
                  activeSection === 'platform'
                    ? 'text-[#1672F9] font-semibold bg-[#B9DCFF]/30'
                    : 'text-[#506783] hover:text-[#0B1220] hover:bg-white/60 font-medium'
                }`}
              >
                Platform
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => handleScrollTo(e, 'how-it-works')}
                className={`text-sm px-3.5 py-1.5 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#1672F9] ${
                  activeSection === 'how-it-works'
                    ? 'text-[#1672F9] font-semibold bg-[#B9DCFF]/30'
                    : 'text-[#506783] hover:text-[#0B1220] hover:bg-white/60 font-medium'
                }`}
              >
                How It Works
              </a>
            </div>

            {/* Desktop Right CTAs */}
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm font-medium text-[#101B2D] hover:text-[#1672F9] bg-white/70 hover:bg-white border border-slate-200/60 px-4 py-2 rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#1672F9]"
              >
                Sign In
              </Link>
              <Link
                to={primaryActionRoute}
                className="text-sm font-medium text-white bg-[#1672F9] hover:bg-[#125ecc] px-4 sm:px-5 py-2 rounded-full shadow-sm hover:shadow-md hover:shadow-[#1672F9]/25 transition-all duration-200 flex items-center gap-1.5 group focus-visible:outline-2 focus-visible:outline-[#1672F9]"
              >
                <span>Get Started</span>
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </Link>
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex sm:hidden items-center gap-2">
              <Link
                to={primaryActionRoute}
                className="text-xs font-semibold text-white bg-[#1672F9] px-3 py-1.5 rounded-full"
              >
                Get Started
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-full text-[#101B2D] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#1672F9]"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </nav>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 bg-white/95 backdrop-blur-lg border border-slate-200/80 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex flex-col space-y-1">
                <a
                  href="#about"
                  onClick={(e) => handleScrollTo(e, 'about')}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-[#101B2D] hover:bg-[#EAF6FF] transition-colors"
                >
                  About
                </a>
                <a
                  href="#platform"
                  onClick={(e) => handleScrollTo(e, 'platform')}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-[#101B2D] hover:bg-[#EAF6FF] transition-colors"
                >
                  Platform
                </a>
                <a
                  href="#how-it-works"
                  onClick={(e) => handleScrollTo(e, 'how-it-works')}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-[#101B2D] hover:bg-[#EAF6FF] transition-colors"
                >
                  How It Works
                </a>
              </div>
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  to="/login"
                  className="w-full text-center text-sm font-medium text-[#101B2D] bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to={primaryActionRoute}
                  className="w-full text-center text-sm font-semibold text-white bg-[#1672F9] hover:bg-[#125ecc] py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  Get Started →
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* ========================================================= */}
        {/* 3. HERO SECTION                                           */}
        {/* ========================================================= */}
        <section 
          id="hero"
          className="pt-12 sm:pt-16 md:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 md:px-8 text-center max-w-4xl mx-auto flex flex-col items-center relative z-10"
        >
          {/* Badge: Dark navy, pill-shaped badge with a small blue indicator */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#101B2D] text-white text-xs sm:text-sm font-medium shadow-sm mb-6 sm:mb-8 border border-slate-700/40">
            <span className="w-2 h-2 rounded-full bg-[#1672F9] ring-2 ring-[#B9DCFF]/40 inline-block" />
            <span>From Business Data to Verified Decisions</span>
          </div>

          {/* Headline:
              Turn Business Data Into
              Decisions You Can Verify
              with subtle light-blue background on "Business Data" and "Verify"
          */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[62px] font-extrabold text-[#0B1220] tracking-tight leading-[1.14] sm:leading-[1.12]">
            Turn{' '}
            <span className="bg-[#B9DCFF]/55 text-[#0B1220] px-2.5 sm:px-3 py-0.5 rounded-xl border border-[#B9DCFF]/80 inline-block shadow-2xs">
              Business Data
            </span>{' '}
            Into
            <br className="hidden sm:inline" />
            {' '}Decisions You Can{' '}
            <span className="bg-[#B9DCFF]/55 text-[#0B1220] px-2.5 sm:px-3 py-0.5 rounded-xl border border-[#B9DCFF]/80 inline-block shadow-2xs">
              Verify
            </span>
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg md:text-xl text-[#506783] mt-6 sm:mt-8 mb-8 sm:mb-10 max-w-2xl font-normal leading-relaxed text-center">
            Analyze trends, forecast demand, detect business risks, and turn real dataset evidence into practical recommendations.
          </p>

          {/* Hero CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto">
            {/* Explore the Platform: white bg, dark navy text, rounded pill, smooth scrolls to #platform */}
            <a
              href="#platform"
              onClick={(e) => handleScrollTo(e, 'platform')}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-[#101B2D] font-semibold text-sm sm:text-base px-7 py-3.5 rounded-full border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 text-center focus-visible:outline-2 focus-visible:outline-[#1672F9]"
            >
              Explore the Platform
            </a>

            {/* Get Started →: bright blue bg, white text, rounded pill, subtle blue shadow, opens registration/onboarding */}
            <Link
              to={primaryActionRoute}
              className="w-full sm:w-auto bg-[#1672F9] hover:bg-[#125ecc] text-white font-semibold text-sm sm:text-base px-7 py-3.5 rounded-full shadow-md shadow-[#1672F9]/30 hover:shadow-xl hover:shadow-[#1672F9]/40 hover:ring-4 hover:ring-[#1672F9]/15 transition-all duration-200 flex items-center justify-center gap-2 group text-center focus-visible:outline-2 focus-visible:outline-[#1672F9]"
            >
              <span>Get Started</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. ABOUT SECTION                                          */}
        {/* ========================================================= */}
        <section 
          id="about" 
          className="scroll-mt-28 py-16 sm:py-20 px-4 sm:px-6 md:px-12 border-t border-slate-200/60 relative"
        >
          <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-12">
            <span className="text-xs uppercase font-bold tracking-wider text-[#1672F9] bg-[#B9DCFF]/30 px-3 py-1 rounded-full border border-[#B9DCFF]/60 inline-block mb-3.5">
              About
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0B1220] tracking-tight">
              Better Decisions Start With Better Evidence
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-[#506783] mt-4 leading-relaxed max-w-3xl mx-auto">
              Business data can contain changing demand, useful patterns, unusual values, and potential risks. This platform helps users understand their data, analyze business performance, forecast future demand where possible, and evaluate recommendations using available evidence.
            </p>
          </div>

          {/* 3 Compact Capability Highlights */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            
            {/* Highlight 1: Understand Data */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_16px_-4px_rgba(16,27,45,0.04)] hover:shadow-md hover:bg-white/90 transition-all duration-200 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-[#1672F9]/10 border border-[#1672F9]/20 flex items-center justify-center text-[#1672F9] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0B1220] mb-2">Understand Data</h3>
              <p className="text-sm text-[#506783] leading-relaxed">
                Discover important columns, patterns, and data-quality issues.
              </p>
            </div>

            {/* Highlight 2: Identify Risks */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_16px_-4px_rgba(16,27,45,0.04)] hover:shadow-md hover:bg-white/90 transition-all duration-200 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-[#1672F9]/10 border border-[#1672F9]/20 flex items-center justify-center text-[#1672F9] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0B1220] mb-2">Identify Risks</h3>
              <p className="text-sm text-[#506783] leading-relaxed">
                Find unusual changes and potential business vulnerabilities.
              </p>
            </div>

            {/* Highlight 3: Verify Decisions */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_16px_-4px_rgba(16,27,45,0.04)] hover:shadow-md hover:bg-white/90 transition-all duration-200 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-[#1672F9]/10 border border-[#1672F9]/20 flex items-center justify-center text-[#1672F9] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0B1220] mb-2">Verify Decisions</h3>
              <p className="text-sm text-[#506783] leading-relaxed">
                Review supporting evidence before acting on recommendations.
              </p>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. PLATFORM SECTION                                       */}
        {/* ========================================================= */}
        <section 
          id="platform" 
          className="scroll-mt-28 py-16 sm:py-20 px-4 sm:px-6 md:px-12 border-t border-slate-200/60 bg-gradient-to-b from-transparent via-[#EAF6FF]/40 to-transparent relative"
        >
          <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-14">
            <span className="text-xs uppercase font-bold tracking-wider text-[#1672F9] bg-[#B9DCFF]/30 px-3 py-1 rounded-full border border-[#B9DCFF]/60 inline-block mb-3.5">
              Platform
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0B1220] tracking-tight">
              One Platform. A Complete Decision Workflow.
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-[#506783] mt-3 leading-relaxed max-w-2xl mx-auto">
              Move from raw business data to evidence-based decisions through one connected workflow.
            </p>
          </div>

          {/* 5 Stages Workflow: Horizontal on desktop, stacked on mobile */}
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              
              {/* Stage 01 */}
              <div className="bg-white/80 border border-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1672F9] bg-[#B9DCFF]/40 px-2 py-0.5 rounded-md">
                      Stage 01
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-[#EAF6FF] flex items-center justify-center text-[#1672F9]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Business Data</h3>
                  <p className="text-xs text-[#506783] leading-relaxed">
                    Upload a CSV or Excel file and understand the available business records.
                  </p>
                </div>
              </div>

              {/* Stage 02 */}
              <div className="bg-white/80 border border-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1672F9] bg-[#B9DCFF]/40 px-2 py-0.5 rounded-md">
                      Stage 02
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-[#EAF6FF] flex items-center justify-center text-[#1672F9]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Business Analytics</h3>
                  <p className="text-xs text-[#506783] leading-relaxed">
                    Explore important metrics, comparisons, and patterns in the dataset.
                  </p>
                </div>
              </div>

              {/* Stage 03 */}
              <div className="bg-white/80 border border-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1672F9] bg-[#B9DCFF]/40 px-2 py-0.5 rounded-md">
                      Stage 03
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-[#EAF6FF] flex items-center justify-center text-[#1672F9]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Demand Forecasting</h3>
                  <p className="text-xs text-[#506783] leading-relaxed">
                    Estimate future demand when sufficient suitable historical data is available.
                  </p>
                </div>
              </div>

              {/* Stage 04 */}
              <div className="bg-white/80 border border-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1672F9] bg-[#B9DCFF]/40 px-2 py-0.5 rounded-md">
                      Stage 04
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-[#EAF6FF] flex items-center justify-center text-[#1672F9]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Risk Detection</h3>
                  <p className="text-xs text-[#506783] leading-relaxed">
                    Identify potential business risks using evidence from the available data.
                  </p>
                </div>
              </div>

              {/* Stage 05 */}
              <div className="bg-white/80 border border-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#1672F9] bg-[#B9DCFF]/40 px-2 py-0.5 rounded-md">
                      Stage 05
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-[#EAF6FF] flex items-center justify-center text-[#1672F9]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1220] mb-1.5">Decision Verification</h3>
                  <p className="text-xs text-[#506783] leading-relaxed">
                    Review recommendations and examine the evidence supporting them.
                  </p>
                </div>
              </div>

            </div>

            {/* Clear CTA below workflow */}
            <div className="flex justify-center mt-10 sm:mt-12">
              <Link
                to={primaryActionRoute}
                className="bg-[#1672F9] hover:bg-[#125ecc] text-white font-semibold text-sm sm:text-base px-7 py-3.5 rounded-full shadow-md shadow-[#1672F9]/30 hover:shadow-lg hover:shadow-[#1672F9]/40 transition-all duration-200 flex items-center gap-2 group focus-visible:outline-2 focus-visible:outline-[#1672F9]"
              >
                <span>Explore the Platform</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 6. HOW IT WORKS SECTION                                   */}
        {/* ========================================================= */}
        <section 
          id="how-it-works" 
          className="scroll-mt-28 py-16 sm:py-20 px-4 sm:px-6 md:px-12 border-t border-slate-200/60 relative"
        >
          <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-14">
            <span className="text-xs uppercase font-bold tracking-wider text-[#1672F9] bg-[#B9DCFF]/30 px-3 py-1 rounded-full border border-[#B9DCFF]/60 inline-block mb-3.5">
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0B1220] tracking-tight">
              From Uploaded Data to Informed Decisions
            </h2>
          </div>

          {/* 4 Short Numbered Stages */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Step 01 */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#506783] tracking-wider uppercase mb-2 block">
                  Step 01
                </span>
                <h3 className="text-base font-bold text-[#0B1220] mb-2">Upload Your Data</h3>
                <p className="text-xs sm:text-sm text-[#506783] leading-relaxed">
                  Start with a CSV or Excel file containing your business records.
                </p>
              </div>
            </div>

            {/* Step 02 */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#506783] tracking-wider uppercase mb-2 block">
                  Step 02
                </span>
                <h3 className="text-base font-bold text-[#0B1220] mb-2">Understand and Analyze</h3>
                <p className="text-xs sm:text-sm text-[#506783] leading-relaxed">
                  The system examines available columns, summarizes the data, and identifies meaningful business patterns.
                </p>
              </div>
            </div>

            {/* Step 03 */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#506783] tracking-wider uppercase mb-2 block">
                  Step 03
                </span>
                <h3 className="text-base font-bold text-[#0B1220] mb-2">Forecast and Detect Risks</h3>
                <p className="text-xs sm:text-sm text-[#506783] leading-relaxed">
                  Where the data supports it, the system estimates future demand and identifies potential risks with supporting evidence.
                </p>
              </div>
            </div>

            {/* Step 04 */}
            <div className="bg-white/70 backdrop-blur-xs border border-white/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-[#506783] tracking-wider uppercase mb-2 block">
                  Step 04
                </span>
                <h3 className="text-base font-bold text-[#0B1220] mb-2">Review and Verify</h3>
                <p className="text-xs sm:text-sm text-[#506783] leading-relaxed">
                  Explore recommendations, inspect the evidence, and decide which actions are appropriate for your business.
                </p>
              </div>
            </div>

          </div>

          {/* Short note at bottom */}
          <div className="max-w-2xl mx-auto mt-10 text-center">
            <p className="text-xs sm:text-sm text-[#506783] inline-flex items-center gap-1.5 bg-white/60 px-4 py-2 rounded-full border border-slate-200/50">
              <svg className="w-4 h-4 text-[#1672F9] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Available analyses depend on the quality, structure, and history of the uploaded dataset.</span>
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 7. FINAL CTA SECTION                                      */}
        {/* ========================================================= */}
        <section 
          id="cta" 
          className="py-14 sm:py-16 px-4 sm:px-6 md:px-8 border-t border-slate-200/60 bg-gradient-to-b from-transparent to-[#B9DCFF]/20 text-center relative"
        >
          <div className="max-w-2xl mx-auto flex flex-col items-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0B1220] tracking-tight">
              Ready to Explore Your Business Data?
            </h2>
            <p className="text-sm sm:text-base text-[#506783] mt-3 mb-7 max-w-xl leading-relaxed">
              Start with your dataset and discover what the available evidence can tell you.
            </p>
            <Link
              to={primaryActionRoute}
              className="bg-[#1672F9] hover:bg-[#125ecc] text-white font-semibold text-sm sm:text-base px-8 py-3.5 rounded-full shadow-md shadow-[#1672F9]/30 hover:shadow-xl hover:shadow-[#1672F9]/40 hover:ring-4 hover:ring-[#1672F9]/15 transition-all duration-200 flex items-center gap-2 group focus-visible:outline-2 focus-visible:outline-[#1672F9]"
            >
              <span>Get Started</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </section>

        {/* Minimal copyright indicator */}
        <footer className="py-4 px-6 text-center border-t border-slate-200/40 text-[11px] sm:text-xs text-[#506783]/80">
          AI-Powered Business Decision Intelligence &amp; Demand Risk Verification System
        </footer>

      </div>
    </div>
  );
};

export default Welcome;
