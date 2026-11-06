import { useState } from 'react';
import {
  SparklesIcon,
  BrainIcon,
  LightbulbIcon,
  TagIcon,
  ShieldAlertIcon,
  CheckSquareIcon,
  ActivityIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  RefreshCwIcon,
} from './icons/Icons';

export default function AIInsights() {
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'findings' | 'keywords' | 'trends' | 'recommendations'
  const [appliedRecommendations, setAppliedRecommendations] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const documentAnalyses = [
    {
      id: 'doc-1',
      name: 'Q3_Financial_Report.pdf',
      type: 'PDF',
      size: '4.2 MB',
      processedAt: 'Today at 09:42 AM',
      model: 'Gemini 1.5 Pro',
      confidence: 99.4,
      pages: 34,
      vectorChunks: 142,
      summary:
        'DocuMind analyzed Q3 performance across all business units. Consolidated operating revenue expanded 23.4% YoY ($48.2M vs $39.1M) propelled by enterprise cloud contracts. Gross margin rose to 76.8% due to automated infrastructure optimization, while international tax liability provision requires closer fiscal audit.',
      keyFindings: [
        {
          id: 'kf-1',
          type: 'metric',
          label: 'Revenue Growth',
          badge: 'Strong Positive',
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          detail: 'SaaS recurring revenue reached 82% of total receipts, exceeding previous forecast by 4.2%.',
        },
        {
          id: 'kf-2',
          type: 'risk',
          label: 'Fiscal Tax Variance',
          badge: 'Needs Review',
          badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          detail: 'Unresolved $1.2M foreign tax credit offset in EU jurisdiction flagged for FY2026 reconciliation.',
        },
        {
          id: 'kf-3',
          type: 'efficiency',
          label: 'Cost Optimization',
          badge: 'Operational Gain',
          badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
          detail: 'Cloud infrastructure expenditure decreased by 6.8% despite a 40% surge in query volume.',
        },
      ],
      keywords: [
        { word: 'Net Revenue Retention', category: 'Metric', score: 98 },
        { word: 'Operating Margin', category: 'Finance', score: 95 },
        { word: 'Foreign Tax Credit', category: 'Tax & Compliance', score: 91 },
        { word: 'Enterprise ARR', category: 'Sales', score: 89 },
        { word: 'Infrastructure Cost', category: 'Operations', score: 86 },
        { word: 'Cash Flow Surplus', category: 'Liquidity', score: 84 },
      ],
      trends: {
        sentiment: { positive: 78, neutral: 14, risk: 8 },
        topicBreakdown: [
          { topic: 'Revenue & Sales', percent: 46, color: 'bg-purple-500' },
          { topic: 'Tax & Compliance', percent: 28, color: 'bg-amber-500' },
          { topic: 'Infrastructure Costs', percent: 26, color: 'bg-cyan-400' },
        ],
        velocity: '+28% faster closing than Q2',
        vectorDensity: '100% chunks embedded (768-dim)',
      },
      recommendations: [
        {
          id: 'rec-1',
          priority: 'High',
          priorityColor: 'text-red-400 bg-red-500/10 border-red-500/25',
          action: 'Audit EU foreign tax jurisdiction offset provisions before end of month.',
          impact: 'Mitigate estimated $340k potential penalty interest.',
        },
        {
          id: 'rec-2',
          priority: 'Medium',
          priorityColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
          action: 'Lock in multi-year compute reservations based on sustained 6.8% cost curve.',
          impact: 'Further reduce annual cloud OPEX by an estimated $180k.',
        },
        {
          id: 'rec-3',
          priority: 'Proactive',
          priorityColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
          action: 'Generate automated executive slide deck for board presentation.',
          impact: 'Save ~6 analyst hours with pre-synthesized Gemini summaries.',
        },
      ],
    },
    {
      id: 'doc-2',
      name: 'Vendor_Agreement_v2.docx',
      type: 'DOCX',
      size: '1.8 MB',
      processedAt: 'Today at 07:15 AM',
      model: 'Gemini 1.5 Pro',
      confidence: 98.7,
      pages: 18,
      vectorChunks: 74,
      summary:
        'Legal review of enterprise master services agreement. Mutual indemnification in Section 9.4 lacks an explicit carve-out for indirect damages. Termination without cause stipulates 60-day notice with SLA rebate penalties, while confidentiality and IP assignment clauses conform to standard policy.',
      keyFindings: [
        {
          id: 'kf-4',
          type: 'risk',
          label: 'Ambiguous Indemnity',
          badge: 'High Legal Risk',
          badgeColor: 'text-red-400 bg-red-500/10 border-red-500/20',
          detail: 'Uncapped consequential damages in Subsection 9.4.2 pose disproportionate vendor liability exposure.',
        },
        {
          id: 'kf-5',
          type: 'compliance',
          label: 'Data Residency',
          badge: 'Compliant',
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          detail: 'Primary storage designated strictly in US-East/EU-Central with encryption in transit & rest.',
        },
        {
          id: 'kf-6',
          type: 'commercial',
          label: 'Payment Terms',
          badge: 'Standard Net 45',
          badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
          detail: 'Invoicing on 30-day cadence; 1.5% monthly late fee applies after 45 days past due.',
        },
      ],
      keywords: [
        { word: 'Mutual Indemnification', category: 'Legal', score: 99 },
        { word: 'Limitation of Liability', category: 'Risk', score: 96 },
        { word: 'Data Processor Agreement', category: 'Privacy', score: 92 },
        { word: 'Termination for Convenience', category: 'Contract', score: 88 },
        { word: 'SLA Availability (99.9%)', category: 'Operations', score: 85 },
      ],
      trends: {
        sentiment: { positive: 45, neutral: 35, risk: 20 },
        topicBreakdown: [
          { topic: 'Liability & Indemnity', percent: 52, color: 'bg-red-500' },
          { topic: 'Data Security & SLA', percent: 30, color: 'bg-cyan-400' },
          { topic: 'Commercial Terms', percent: 18, color: 'bg-purple-500' },
        ],
        velocity: 'Negotiation Turnaround: 4.2 days',
        vectorDensity: '98.8% semantic match density',
      },
      recommendations: [
        {
          id: 'rec-4',
          priority: 'High',
          priorityColor: 'text-red-400 bg-red-500/10 border-red-500/25',
          action: 'Insert standard 2x aggregate annual contract value cap in Section 9.4.',
          impact: 'Eliminates open-ended financial exposure in litigation scenarios.',
        },
        {
          id: 'rec-5',
          priority: 'Medium',
          priorityColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
          action: 'Align termination without cause notice period to reciprocal 30 days.',
          impact: 'Provides vendor parity with internal procurement policy.',
        },
      ],
    },
    {
      id: 'doc-3',
      name: 'Architecture_Spec_v2.pdf',
      type: 'PDF',
      size: '6.1 MB',
      processedAt: 'Yesterday at 04:30 PM',
      model: 'Gemini 1.5 Pro',
      confidence: 97.9,
      pages: 42,
      vectorChunks: 198,
      summary:
        'Technical architectural blueprint for DocuMind RAG pipeline. PostgreSQL pgvector index tuned with HNSW algorithm (m=16, ef_construction=64). Asynchronous FastAPI pipeline handles multi-modal document extraction and semantic similarity retrieval with sub-110ms latency.',
      keyFindings: [
        {
          id: 'kf-7',
          type: 'architecture',
          label: 'Vector Search Benchmark',
          badge: 'Exceeds SLA',
          badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
          detail: 'HNSW similarity query latency verified at 84ms p95 under 100k test document chunks.',
        },
        {
          id: 'kf-8',
          type: 'scalability',
          label: 'FastAPI Worker Pool',
          badge: 'Horizontal Scaling',
          badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          detail: 'Asynchronous event loop decoupled via Redis job queue for resilient document chunking.',
        },
        {
          id: 'kf-9',
          type: 'model',
          label: 'Gemini Integration',
          badge: 'Active Engine',
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          detail: 'Utilizing text-embedding-004 with 768 dimensions and dynamic token sliding window.',
        },
      ],
      keywords: [
        { word: 'pgvector HNSW', category: 'Database', score: 99 },
        { word: 'FastAPI Workers', category: 'Backend', score: 94 },
        { word: 'Cosine Distance', category: 'Algorithm', score: 92 },
        { word: 'Sliding Window Chunking', category: 'NLP', score: 89 },
        { word: 'P95 Latency 84ms', category: 'Performance', score: 87 },
      ],
      trends: {
        sentiment: { positive: 88, neutral: 10, risk: 2 },
        topicBreakdown: [
          { topic: 'Vector DB & Storage', percent: 45, color: 'bg-cyan-400' },
          { topic: 'FastAPI Microservice', percent: 35, color: 'bg-purple-500' },
          { topic: 'LLM Embeddings', percent: 20, color: 'bg-emerald-400' },
        ],
        velocity: 'Throughput: 1,200 chunks/sec',
        vectorDensity: '100% indexed in pgvector',
      },
      recommendations: [
        {
          id: 'rec-6',
          priority: 'Medium',
          priorityColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
          action: 'Evaluate increase of ef_construction from 64 to 128 as chunk count surpasses 500k.',
          impact: 'Preserves >98% recall accuracy at large-scale production volume.',
        },
        {
          id: 'rec-7',
          priority: 'Proactive',
          priorityColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
          action: 'Enable batch embedding ingestion for files over 20MB.',
          impact: 'Reduces peak FastAPI memory pressure by ~35%.',
        },
      ],
    },
  ];

  const currentDoc = documentAnalyses[selectedDocIndex];

  const handleRefreshInsights = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleApplyRec = (id) => {
    setAppliedRecommendations((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-[#0c101d] p-5 sm:p-7 shadow-2xl shadow-black/40 relative overflow-hidden">
      {/* Decorative ambient gradient backdrop */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-600/25">
              <BrainIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Dedicated AI Document Insights
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                  <SparklesIcon className="h-3 w-3 text-cyan-400" />
                  Gemini 1.5 Pro
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Automated synthesis, semantic extraction, keyword mapping, and prescriptive recommendations
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleRefreshInsights}
            className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-purple-500/40 hover:text-white transition-all ${
              isRefreshing ? 'opacity-70' : ''
            }`}
            title="Re-run Gemini analysis"
          >
            <RefreshCwIcon className={`h-3.5 w-3.5 text-purple-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Re-analyze</span>
          </button>

          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300">
            {currentDoc.confidence}% Confidence
          </div>
        </div>
      </div>

      {/* Document Selector Pills */}
      <div className="relative z-10 mt-5 flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
            Analyzed File:
          </span>
          {documentAnalyses.map((doc, idx) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedDocIndex(idx)}
              className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                selectedDocIndex === idx
                  ? 'bg-gradient-to-r from-purple-600/30 to-cyan-500/20 text-white border border-purple-500/50 shadow-md shadow-purple-900/20'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800/80 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  selectedDocIndex === idx ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="font-semibold text-slate-200 truncate max-w-[130px] sm:max-w-none">
                {doc.name}
              </span>
              <span className="text-[10px] text-purple-400/80 uppercase">
                {doc.type}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="relative z-10 mt-5 flex border-b border-slate-800/80 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Summary', icon: SparklesIcon },
          { id: 'findings', label: 'Key Findings', icon: LightbulbIcon, badge: currentDoc.keyFindings.length },
          { id: 'keywords', label: 'Important Keywords', icon: TagIcon, badge: currentDoc.keywords.length },
          { id: 'trends', label: 'Document Trends', icon: ActivityIcon },
          { id: 'recommendations', label: 'Recommendations', icon: CheckSquareIcon, badge: currentDoc.recommendations.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'border-purple-400 text-purple-300 bg-purple-500/5'
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? 'bg-purple-600/30 text-purple-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Display */}
      <div className="relative z-10 mt-6 space-y-6">
        {/* 1. DOCUMENT SUMMARY (Shown in Overview & Summary Tab or by Default) */}
        {(activeTab === 'overview' || activeTab === 'all') && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                  <SparklesIcon className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Executive AI Summary
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{currentDoc.pages} Pages</span>
                <span>•</span>
                <span className="text-cyan-400">{currentDoc.vectorChunks} pgvector Chunks</span>
                <span>•</span>
                <span>{currentDoc.processedAt}</span>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-200">
              {currentDoc.summary}
            </p>

            {/* Quick Context Highlights */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60">
              <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                  Source Authenticity
                </span>
                <p className="text-sm font-bold text-white mt-0.5">High Confidence</p>
                <p className="text-[11px] text-slate-400">Zero hallucination markers detected</p>
              </div>

              <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                  Vector Retrieval
                </span>
                <p className="text-sm font-bold text-white mt-0.5">HNSW Indexed</p>
                <p className="text-[11px] text-slate-400">Sub-100ms similarity recall ready</p>
              </div>

              <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  Semantic Clarity
                </span>
                <p className="text-sm font-bold text-white mt-0.5">{currentDoc.confidence}%</p>
                <p className="text-[11px] text-slate-400">Evaluated against domain lexicon</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. KEY FINDINGS */}
        {(activeTab === 'findings' || activeTab === 'overview') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <LightbulbIcon className="h-4 w-4 text-purple-400" />
                Key Findings & Critical Items
              </h3>
              <span className="text-xs text-slate-400">
                Extracted by Gemini semantic parser
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {currentDoc.keyFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#111728]/80 p-4 transition-all hover:border-purple-500/40 hover:bg-[#131b30]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        {finding.type === 'risk' ? (
                          <ShieldAlertIcon className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        ) : (
                          <CheckCircleIcon className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                        )}
                        <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                          {finding.label}
                        </span>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${finding.badgeColor}`}>
                        {finding.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {finding.detail}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-cyan-400 pt-2 border-t border-slate-800/60">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Verified via Document Citations</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. IMPORTANT KEYWORDS & ENTITIES */}
        {(activeTab === 'keywords' || activeTab === 'overview') && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Important Keywords & Semantic Entities
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Scored by embedding salience & cross-corpus frequency
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {currentDoc.keywords.map((kw, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0c1220] px-3 py-1.5 hover:border-purple-500/40 hover:bg-purple-950/20 transition-all cursor-default"
                >
                  <span className="text-xs font-semibold text-slate-200">
                    {kw.word}
                  </span>
                  <span className="rounded-md bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                    {kw.category}
                  </span>
                  <span className="text-[10px] font-bold text-cyan-400">
                    {kw.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. DOCUMENT TRENDS */}
        {(activeTab === 'trends' || activeTab === 'overview') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sentiment & Tone Gauge */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4 text-purple-400" />
                  Sentiment & Tone Distribution
                </h4>
                <span className="text-xs text-slate-400">Corpus Analysis</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-medium">Positive / Confident</span>
                    <span className="text-slate-300 font-bold">{currentDoc.trends.sentiment.positive}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${currentDoc.trends.sentiment.positive}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Neutral / Factual</span>
                    <span className="text-slate-300 font-bold">{currentDoc.trends.sentiment.neutral}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-500 transition-all duration-500"
                      style={{ width: `${currentDoc.trends.sentiment.neutral}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-red-400 font-medium">Risk / Cautionary</span>
                    <span className="text-slate-300 font-bold">{currentDoc.trends.sentiment.risk}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all duration-500"
                      style={{ width: `${currentDoc.trends.sentiment.risk}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
                <span>Velocity: <strong className="text-white">{currentDoc.trends.velocity}</strong></span>
                <span className="text-cyan-400 font-medium">{currentDoc.trends.vectorDensity}</span>
              </div>
            </div>

            {/* Topic Distribution Cluster */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUpIcon className="h-4 w-4 text-cyan-400" />
                  Semantic Topic Clusters
                </h4>
                <span className="text-xs text-slate-400">Top Themes</span>
              </div>

              <div className="space-y-3.5">
                {currentDoc.trends.topicBreakdown.map((topicItem, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-200 font-medium">{topicItem.topic}</span>
                      <span className="text-slate-300 font-bold">{topicItem.percent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${topicItem.color} transition-all duration-500`}
                        style={{ width: `${topicItem.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-purple-950/20 p-2.5 border border-purple-500/20 text-xs text-purple-300">
                <BrainIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                <span>Indexed into 768-dimension vector spaces with cosine similarity clustering.</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. RECOMMENDATIONS */}
        {(activeTab === 'recommendations' || activeTab === 'overview') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <CheckSquareIcon className="h-4 w-4 text-cyan-400" />
                AI Prescriptive Recommendations
              </h3>
              <span className="text-xs text-slate-400">
                Actionable next steps generated from document insights
              </span>
            </div>

            <div className="space-y-3">
              {currentDoc.recommendations.map((rec) => {
                const isApplied = appliedRecommendations[rec.id];

                return (
                  <div
                    key={rec.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border p-4 transition-all ${
                      isApplied
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-slate-800/80 bg-[#101524] hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${rec.priorityColor}`}>
                          {rec.priority}
                        </span>
                      </div>
                      <div>
                        <p className={`text-xs sm:text-sm font-semibold text-white ${isApplied ? 'line-through text-slate-400' : ''}`}>
                          {rec.action}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <strong className="text-purple-300">Projected Impact:</strong> {rec.impact}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApplyRec(rec.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          isApplied
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Applied
                          </>
                        ) : (
                          <span>Apply Action</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
