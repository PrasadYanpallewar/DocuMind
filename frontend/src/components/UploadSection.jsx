import { useState, useRef } from 'react';
import documentService from '../services/documentService';
import { UploadCloudIcon, CheckCircleIcon, SparklesIcon, DocumentIcon, CloseIcon } from './icons/Icons';

export default function UploadSection({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

  const handleFileSelected = (file) => {
    if (!file) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setSelectedFile(null);
      setUploadError('Unsupported file type. Please upload a PDF (.pdf), Word (.docx), or Text (.txt) file.');
      setUploadStatus('error');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setUploadError('File size exceeds maximum allowed limit of 10 MB.');
      setUploadStatus('error');
      return;
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadError('');
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(15);
    setUploadError('');

    try {
      const result = await documentService.uploadDocument(selectedFile, (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(Math.min(pct, 95));
        }
      });

      setUploadProgress(100);
      setUploadStatus('success');

      if (onUploadComplete && result?.data?.document) {
        onUploadComplete(result.data.document);
      }

      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
        setUploadError('');
      }, 2500);
    } catch (err) {
      console.error('Upload failed:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Upload failed. Please ensure the backend is running and the file is a valid PDF, DOCX, or TXT document.';
      setUploadError(msg);
      setUploadStatus('error');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0f1422] p-5 sm:p-6 shadow-xl shadow-black/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            Document Ingestion & AI Vectorization
          </h2>
          <p className="text-xs text-slate-400">
            Upload files to parse text, compute embeddings, and store in PostgreSQL pgvector
          </p>
        </div>

        {/* Format Badges */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400">
            PDF
          </span>
          <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400">
            DOCX
          </span>
          <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
            TXT
          </span>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-300 ${
          isDragging
            ? 'border-purple-400 bg-purple-950/20 shadow-inner'
            : selectedFile
            ? 'border-indigo-500/60 bg-indigo-950/20'
            : 'border-slate-800 bg-slate-900/40 hover:border-purple-500/50 hover:bg-slate-900/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2 max-w-md w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
              <DocumentIcon className="h-6 w-6" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-sm">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-400">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI extraction
              </p>
            </div>

            {/* Upload Progress Bar if uploading */}
            {uploadStatus === 'uploading' && (
              <div className="w-full mt-3">
                <div className="flex justify-between text-xs text-purple-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <SparklesIcon className="h-3.5 w-3.5 text-purple-400 animate-spin" />
                    Extracting & Indexing...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success state */}
            {uploadStatus === 'success' && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 mt-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <CheckCircleIcon className="h-4 w-4" />
                Successfully indexed into pgvector & Gemini ready!
              </div>
            )}

            {/* Error state */}
            {uploadError && (
              <div className="flex items-center justify-between text-xs font-medium text-red-400 mt-2 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/30 w-full text-left">
                <span>{uploadError}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadError('');
                  }}
                  className="text-red-400 hover:text-white ml-2"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-purple-400 group-hover:scale-110 group-hover:bg-purple-600/20 transition-all duration-300 border border-slate-700/60">
              <UploadCloudIcon className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">
                <span className="text-purple-400 font-semibold underline underline-offset-2">
                  Click to browse
                </span>{' '}
                or drag and drop your document here
              </p>
              <p className="text-xs text-slate-400">
                Supports PDF, DOCX, and TXT files up to 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          <span>Automatic semantic chunking & metadata enrichment enabled</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {selectedFile && uploadStatus === 'idle' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
              className="w-1/2 sm:w-auto rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            disabled={uploadStatus === 'uploading'}
            onClick={(e) => {
              e.stopPropagation();
              if (!selectedFile) {
                fileInputRef.current?.click();
              } else {
                handleStartUpload();
              }
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <SparklesIcon className="h-4 w-4" />
            {selectedFile
              ? uploadStatus === 'uploading'
                ? 'Processing...'
                : 'Upload & Process'
              : 'Select Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
