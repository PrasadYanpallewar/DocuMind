import { useState } from 'react';
import documentService from '../services/documentService';
import {
  EyeIcon,
  ChatBubbleIcon,
  SparklesIcon,
  MoreVerticalIcon,
  ClockIcon,
  TrashIcon,
  CloseIcon,
} from './icons/Icons';

export default function RecentDocuments({
  documents = [],
  onSelectDocument,
  onDeleteDocument,
  searchQuery = '',
  isLoading = false,
  error = '',
  onRetry,
}) {
  const [filterType, setFilterType] = useState('ALL');
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  const handleConfirmDelete = async () => {
    if (!documentToDelete?.id) return;
    setIsDeleting(true);
    setDeleteError('');

    try {
      if (onDeleteDocument) {
        await onDeleteDocument(documentToDelete.id);
      } else {
        await documentService.deleteDocument(documentToDelete.id);
        onRetry?.();
      }
      setSuccessFeedback(`Document "${documentToDelete.name}" was successfully deleted.`);
      setDocumentToDelete(null);
      setTimeout(() => setSuccessFeedback(''), 4000);
    } catch (err) {
      console.error('Failed to delete document:', err);
      setDeleteError(
        err.response?.data?.message || err.message || 'Failed to delete document. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Normalize document properties from backend or initial state
  const formattedDocs = documents.map((doc) => {
    const name = doc.filename || doc.name || 'Untitled Document';
    const ext = name.split('.').pop().toUpperCase();
    let type = 'PDF';
    if (doc.mime_type?.includes('pdf') || ext === 'PDF') {
      type = 'PDF';
    } else if (doc.mime_type?.includes('word') || doc.mime_type?.includes('officedocument') || ext === 'DOCX' || ext === 'DOC') {
      type = 'DOCX';
    } else if (doc.mime_type?.includes('text') || ext === 'TXT') {
      type = 'TXT';
    } else {
      type = ext || 'DOC';
    }

    let size = doc.size;
    if (!size && doc.file_size) {
      const bytes = Number(doc.file_size);
      if (bytes < 1024 * 1024) {
        size = `${(bytes / 1024).toFixed(1)} KB`;
      } else {
        size = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      }
    }

    let status = doc.status;
    if (status === 'completed') status = 'Processed';
    else if (status === 'pending') status = 'Pending';
    else if (!status) status = 'Processed';

    let date = doc.date;
    if (!date && doc.created_at) {
      const d = new Date(doc.created_at);
      date = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return {
      ...doc,
      name,
      type,
      size: size || 'Unknown size',
      status,
      date: date || 'Recently',
    };
  });

  const filteredDocs = formattedDocs.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'ALL' || doc.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Processed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Processed
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            Processing
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400 border border-slate-700">
            <ClockIcon className="h-3 w-3" />
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
            {status}
          </span>
        );
    }
  };

  const getFileTypeBadge = (type) => {
    switch (type) {
      case 'PDF':
        return (
          <span className="rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[11px] font-bold text-red-400">
            PDF
          </span>
        );
      case 'DOCX':
        return (
          <span className="rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[11px] font-bold text-blue-400">
            DOCX
          </span>
        );
      case 'TXT':
        return (
          <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-400">
            TXT
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-slate-300">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0f1422] p-5 sm:p-6 shadow-xl shadow-black/30 overflow-hidden w-full">
      {/* Header and Filter pills */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            Recent Documents
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-semibold inline-flex items-center gap-1.5">
              <span>{filteredDocs.length}</span>
              {isLoading && documents.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" title="Syncing..." />
              )}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Parsed corpus with vector indices and extraction status
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          {['ALL', 'PDF', 'DOCX', 'TXT'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filterType === tab
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Success feedback toast */}
      {successFeedback && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>{successFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessFeedback('')}
            className="text-emerald-400 hover:text-white"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-all"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[620px] sm:min-w-full">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="pb-3 px-3">Document Name</th>
              <th className="pb-3 px-3">Type</th>
              <th className="pb-3 px-3">Upload Date</th>
              <th className="pb-3 px-3">Status</th>
              <th className="pb-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
            {isLoading && documents.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-3">
                    <div className="h-4 w-48 bg-slate-800 rounded mb-1" />
                    <div className="h-3 w-20 bg-slate-850 rounded" />
                  </td>
                  <td className="py-4 px-3"><div className="h-4 w-12 bg-slate-800 rounded" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                  <td className="py-4 px-3"><div className="h-4 w-16 bg-slate-800 rounded-full" /></td>
                  <td className="py-4 px-3 text-right"><div className="h-6 w-20 bg-slate-800 rounded ml-auto" /></td>
                </tr>
              ))
            ) : filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <SparklesIcon className="h-8 w-8 text-slate-600" />
                    <p className="font-medium text-slate-300">No documents found</p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Upload a PDF document above to begin semantic parsing and Gemini document Q&A.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr
                  key={doc.id}
                  className="group hover:bg-slate-800/30 transition-colors"
                >
                  {/* Name & Size */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 group-hover:border-purple-500/40 transition-colors">
                        <SparklesIcon className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate max-w-xs group-hover:text-purple-300 transition-colors">
                          {doc.name}
                        </p>
                        <p className="text-[11px] text-slate-400">{doc.size}</p>
                      </div>
                    </div>
                  </td>

                  {/* File Type */}
                  <td className="py-3.5 px-3">
                    {getFileTypeBadge(doc.type)}
                  </td>

                  {/* Upload Date */}
                  <td className="py-3.5 px-3 text-slate-400">
                    {doc.date}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3">
                    {getStatusBadge(doc.status)}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectDocument?.(doc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-600/20 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                        title="Ask Gemini AI"
                      >
                        <ChatBubbleIcon className="h-3.5 w-3.5 text-cyan-300" />
                        <span>Ask AI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDocumentToDelete(doc);
                          setDeleteError('');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        title="Delete document"
                        aria-label={`Delete ${doc.name}`}
                      >
                        <TrashIcon className="h-3.5 w-3.5 text-red-400 group-hover:text-white" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal Dialog */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d121f] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <TrashIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white">Delete Document</h3>
                <p className="text-xs text-slate-400 truncate max-w-xs">{documentToDelete.name}</p>
              </div>
            </div>

            {/* Confirmation warning text */}
            <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this document? Its chat history and indexed content will also be deleted.
            </p>

            {/* Error feedback if deletion fails */}
            {deleteError && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDocumentToDelete(null);
                  setDeleteError('');
                }}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <SparklesIcon className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
