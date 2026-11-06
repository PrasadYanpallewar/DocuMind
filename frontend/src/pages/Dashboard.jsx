import StatsCards from '../components/StatsCards';
import UploadSection from '../components/UploadSection';
import RecentDocuments from '../components/RecentDocuments';
import AIInsights from '../components/AIInsights';
import { PlusIcon, SparklesIcon } from '../components/icons/Icons';

export default function Dashboard({
  searchQuery = '',
  onOpenChat,
  documents = [],
  isLoading = false,
  error = '',
  onRefresh,
  onDeleteDocument,
}) {
  const scrollToUpload = () => {
    const uploadEl = document.getElementById('upload-section');
    if (uploadEl) {
      uploadEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const processedCount = documents.filter(
    (d) => d.status === 'completed' || d.status === 'Processed'
  ).length;
  const pendingCount = documents.filter(
    (d) => d.status === 'pending' || d.status === 'Pending'
  ).length;

  const totalBytes = documents.reduce((sum, d) => sum + (Number(d.file_size) || 0), 0);
  const storageUsed =
    totalBytes === 0
      ? '0 KB'
      : totalBytes < 1024 * 1024
      ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

  const currentStats = {
    total: documents.length,
    processed: processedCount,
    pending: pendingCount,
    storageUsed: storageUsed,
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-12 w-full max-w-full">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-[#0e1322] to-indigo-950/30 p-6 sm:p-8 shadow-2xl shadow-purple-950/20 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 border border-purple-500/30 mb-1">
            <SparklesIcon className="h-3.5 w-3.5 text-cyan-400" />
            AI Document Intelligence Engine Active
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Welcome back!
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            Your intelligent document workspace
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={scrollToUpload}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* 4 Statistics Cards */}
      <StatsCards stats={currentStats} />

      {/* Document Upload Section */}
      <div id="upload-section">
        <UploadSection onUploadComplete={() => onRefresh?.()} />
      </div>

      {/* AI Insights Section */}
      <AIInsights />

      {/* Recent Documents Table */}
      <RecentDocuments
        documents={documents}
        searchQuery={searchQuery}
        isLoading={isLoading}
        error={error}
        onRetry={onRefresh}
        onSelectDocument={(doc) => {
          onOpenChat?.(doc);
        }}
        onDeleteDocument={onDeleteDocument}
      />
    </div>
  );
}
