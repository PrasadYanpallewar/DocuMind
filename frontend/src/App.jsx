import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DocumentChat from './components/DocumentChat';
import RecentDocuments from './components/RecentDocuments';
import UploadSection from './components/UploadSection';
import documentService from './services/documentService';
import {
  SparklesIcon,
  DocumentIcon,
  CollectionsIcon,
  AnalyticsIcon,
  SettingsIcon,
  BrainIcon,
} from './components/icons/Icons';

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [activeDocForChat, setActiveDocForChat] = useState(null);
  const isFetchingRef = useRef(false);

  // Load user documents without duplicate calls or unnecessary skeleton resets
  const fetchUserDocuments = useCallback(async (isInitial = false) => {
    if (!isAuthenticated || isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Only activate skeleton loader on initial fetch when no documents are in memory
    setDocuments((currentDocs) => {
      if (isInitial && currentDocs.length === 0) {
        setIsLoadingDocs(true);
      }
      return currentDocs;
    });
    setDocsError('');

    try {
      const response = await documentService.getDocuments();
      const docs = response?.data?.documents || [];
      setDocuments(docs);

      // Auto-select first document for chat if none selected yet
      setActiveDocForChat((prev) => {
        if (!prev && docs.length > 0) return docs[0];
        if (prev) {
          const matched = docs.find((d) => d.id === prev.id);
          return matched || (docs.length > 0 ? docs[0] : null);
        }
        return null;
      });
    } catch (err) {
      console.warn('Failed to fetch user documents:', err.message);
      setDocsError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      setIsLoadingDocs(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated]);

  // Initial load only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserDocuments(true);
    }
  }, [isAuthenticated, fetchUserDocuments]);

  // Loading state while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-3 shadow-xl shadow-purple-500/25">
            <BrainIcon className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Loading DocuMind...</p>
        </div>
      </div>
    );
  }

  // Protected Route: Show Auth Page if not logged in
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Handle switching to document chat directly from any card or list
  const handleOpenChat = (doc) => {
    setActiveDocForChat(doc);
    setActiveNav('ai-assistant');
  };

  // Handle document deletion and synchronize dashboard state
  const handleDeleteDocument = async (docId) => {
    try {
      await documentService.deleteDocument(docId);
      // If the deleted document was currently active in AI Assistant, clear it
      setActiveDocForChat((prev) => (prev?.id === docId ? null : prev));
      // Refetch user documents to update statistics and tables
      await fetchUserDocuments(false);
    } catch (err) {
      console.error('Failed to delete document:', err);
      throw err;
    }
  };

  const getNavTitle = () => {
    switch (activeNav) {
      case 'dashboard':
        return 'Dashboard';
      case 'documents':
        return 'My Documents';
      case 'ai-assistant':
        return 'AI Assistant';
      case 'collections':
        return 'Collections';
      case 'analytics':
        return 'Analytics';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-[#090d16] text-slate-100 font-sans antialiased selection:bg-purple-500/30 selection:text-purple-200">
      {/* Reusable Sidebar Navigation */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        documentCount={documents.length}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 h-screen h-[100dvh] overflow-hidden w-full">
        {/* Top Navbar */}
        <Navbar
          title={getNavTitle()}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* Viewport Body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full">
            {activeNav === 'dashboard' ? (
              <Dashboard
                searchQuery={searchQuery}
                onOpenChat={handleOpenChat}
                documents={documents}
                isLoading={isLoadingDocs}
                error={docsError}
                onRefresh={() => fetchUserDocuments(false)}
                onDeleteDocument={handleDeleteDocument}
              />
            ) : activeNav === 'ai-assistant' ? (
              <DocumentChat
                document={activeDocForChat}
                allDocuments={documents}
                onSelectDocument={(doc) => setActiveDocForChat(doc)}
                onClose={() => setActiveNav('dashboard')}
              />
            ) : activeNav === 'documents' ? (
              <div className="space-y-6 pb-12">
                <div id="upload-section">
                  <UploadSection onUploadComplete={() => fetchUserDocuments(false)} />
                </div>
                <RecentDocuments
                  documents={documents}
                  searchQuery={searchQuery}
                  isLoading={isLoadingDocs}
                  error={docsError}
                  onSelectDocument={handleOpenChat}
                  onRetry={() => fetchUserDocuments(false)}
                  onDeleteDocument={handleDeleteDocument}
                />
              </div>
            ) : (
              /* Informative placeholder view for other sidebar links */
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#0f1422] p-12 text-center shadow-xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 mb-4">
                  {activeNav === 'collections' && <CollectionsIcon className="h-8 w-8" />}
                  {activeNav === 'analytics' && <AnalyticsIcon className="h-8 w-8" />}
                  {activeNav === 'settings' && <SettingsIcon className="h-8 w-8" />}
                </div>

                <h2 className="text-xl font-bold text-white mb-2">
                  {getNavTitle()} Module
                </h2>
                <p className="max-w-md text-sm text-slate-400 mb-6 leading-relaxed">
                  The {getNavTitle()} module is prepared for advanced enterprise features. Return to the dashboard to test document ingestion and Gemini AI Q&A.
                </p>

                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/25 hover:bg-purple-500 transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
