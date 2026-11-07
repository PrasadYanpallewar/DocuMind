import { useState, useEffect, useMemo, useRef } from 'react';
import documentService from '../services/documentService';
import MarkdownRenderer from './MarkdownRenderer';
import {
  SparklesIcon,
  ChatBubbleIcon,
  DocumentIcon,
  RefreshCwIcon,
  CloseIcon,
  CheckCircleIcon,
  LightbulbIcon,
  CopyIcon,
  CheckIcon,
  PlusIcon,
  UserIcon,
} from './icons/Icons';

/**
 * Returns normalized document type ('PDF', 'DOCX', 'TXT', etc.)
 */
const getDocType = (doc) => {
  if (!doc) return 'PDF';
  const name = doc.filename || doc.name || '';
  const ext = name.split('.').pop().toLowerCase();
  if (doc.mime_type?.includes('pdf') || ext === 'pdf') return 'PDF';
  if (
    doc.mime_type?.includes('word') ||
    doc.mime_type?.includes('officedocument') ||
    ext === 'docx' ||
    ext === 'doc'
  )
    return 'DOCX';
  if (doc.mime_type?.includes('text') || ext === 'txt') return 'TXT';
  return ext.toUpperCase() || 'DOC';
};

/**
 * Returns Tailwind badge styling for file types
 */
const getDocTypeBadge = (type) => {
  switch (type) {
    case 'PDF':
      return 'border-red-500/30 bg-red-500/15 text-red-400';
    case 'DOCX':
      return 'border-blue-500/30 bg-blue-500/15 text-blue-400';
    case 'TXT':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-400';
    default:
      return 'border-slate-700 bg-slate-800 text-slate-300';
  }
};

export default function DocumentChat({
  document: initialDoc,
  allDocuments = [],
  onSelectDocument,
  onClose,
}) {
  const [docsList, setDocsList] = useState(allDocuments);
  const [activeDoc, setActiveDoc] = useState(initialDoc || allDocuments[0] || null);
  const [messages, setMessages] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isNewChatSession, setIsNewChatSession] = useState(false);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedSources, setExpandedSources] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatContainerRef = useRef(null);
  const lastUserMessageRef = useRef(null);
  const prevSendingRef = useRef(false);
  const prevMsgCountRef = useRef(0);

  // Compute index of the last user message to attach ref for precision viewport positioning
  const lastUserIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return i;
    }
    return -1;
  }, [messages]);

  // Sync docsList when parent allDocuments updates
  useEffect(() => {
    if (allDocuments && allDocuments.length > 0) {
      setDocsList(allDocuments);
    }
  }, [allDocuments]);

  // Load fresh documents from backend on mount
  useEffect(() => {
    let isMounted = true;
    const fetchFreshDocuments = async () => {
      try {
        const response = await documentService.getDocuments();
        if (isMounted && response?.data?.documents) {
          const fetched = response.data.documents;
          setDocsList(fetched);

          // Restore saved document selection from localStorage if available
          if (!activeDoc && fetched.length > 0) {
            const savedId = localStorage.getItem('documind_active_doc_id');
            const matched = fetched.find((d) => d.id === savedId);
            const chosen = matched || initialDoc || fetched[0];
            setActiveDoc(chosen);
            onSelectDocument?.(chosen);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch documents for selector:', err.message);
      }
    };

    fetchFreshDocuments();
    return () => {
      isMounted = false;
    };
  }, []);

  // Merge and deduplicate all documents to ensure the selector ALWAYS has options
  const combinedDocs = useMemo(() => {
    const map = new Map();
    if (activeDoc?.id) {
      map.set(activeDoc.id, activeDoc);
    }
    (allDocuments || []).forEach((d) => {
      if (d?.id) map.set(d.id, { ...(map.get(d.id) || {}), ...d });
    });
    (docsList || []).forEach((d) => {
      if (d?.id) map.set(d.id, { ...(map.get(d.id) || {}), ...d });
    });
    return Array.from(map.values());
  }, [activeDoc, allDocuments, docsList]);

  // Handle document switching from parent
  useEffect(() => {
    if (initialDoc && initialDoc.id !== activeDoc?.id) {
      setActiveDoc(initialDoc);
      setActiveConversationId(null);
      setIsNewChatSession(false);
      setMessages([]);
      setErrorMsg('');
      setExpandedSources({});
      setCopiedId(null);
      localStorage.setItem('documind_active_doc_id', initialDoc.id);
    }
  }, [initialDoc]);

  // If active document was deleted, clear selection safely
  useEffect(() => {
    if (activeDoc?.id && allDocuments.length > 0) {
      const exists = allDocuments.some((d) => d.id === activeDoc.id);
      if (!exists) {
        setActiveDoc(null);
        setActiveConversationId(null);
        setMessages([]);
        localStorage.removeItem('documind_active_doc_id');
      }
    }
  }, [allDocuments, activeDoc?.id]);

  // Precision scroll: scrolls inner container so the latest question is at the top with AI answer directly below
  const scrollToLatestConversation = (behavior = 'smooth') => {
    const container = chatContainerRef.current;
    if (!container) return;

    const userEl = lastUserMessageRef.current;
    if (!userEl) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const userRect = userEl.getBoundingClientRect();
    const relativeTop = userRect.top - containerRect.top + container.scrollTop;

    // Position user's question 16px below top sticky header
    const targetScroll = Math.max(0, relativeTop - 16);
    container.scrollTo({ top: targetScroll, behavior });
  };

  // Scroll listener to toggle the "Jump to latest" floating button
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    setShowScrollBottom(isUp);
  };

  // Load chat history whenever active document changes
  const loadChatHistory = async (docId) => {
    if (!docId) return;
    setIsLoadingHistory(true);
    setErrorMsg('');

    try {
      const response = await documentService.getChatHistory(docId);
      const data = response?.data;

      if (data) {
        setActiveConversationId(data.conversation_id || null);
        // Ensure strictly sorted in ascending chronological order
        const rawMessages = data.messages || [];
        const sorted = rawMessages.slice().sort((a, b) => {
          const tA = new Date(a.created_at || 0).getTime();
          const tB = new Date(b.created_at || 0).getTime();
          return tA - tB;
        });
        setMessages(sorted);
        setIsNewChatSession(false);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setErrorMsg(
        err.response?.data?.message || 'Failed to load previous conversations for this document.'
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeDoc?.id && !isNewChatSession) {
      loadChatHistory(activeDoc.id);
    }
  }, [activeDoc?.id]);

  // Precision conversation scrolling: keeps user's question visible while exposing the answer
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container || messages.length === 0) return;

    const prevSending = prevSendingRef.current;
    const prevCount = prevMsgCountRef.current;

    prevSendingRef.current = isSending;
    prevMsgCountRef.current = messages.length;

    // Case 1: User just submitted a question (isSending became true) -> scroll to bottom to show question + spinner
    if (isSending && !prevSending) {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      });
      return;
    }

    // Case 2: AI response completed (isSending transitioned from true to false) -> scroll to align question at top
    if (!isSending && prevSending) {
      const timer = setTimeout(() => {
        scrollToLatestConversation('smooth');
      }, 50);
      return () => clearTimeout(timer);
    }

    // Case 3: Initial chat history load (messages populated from 0 while not sending) -> instant scroll to latest
    if (!isSending && prevCount === 0 && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToLatestConversation('auto');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [messages, isSending]);

  // Handle switching to a different document
  const handleSwitchDocument = (docId) => {
    const found = combinedDocs.find((d) => d.id === docId);
    if (found && found.id !== activeDoc?.id) {
      setActiveDoc(found);
      onSelectDocument?.(found);
      setActiveConversationId(null);
      setIsNewChatSession(false);
      setMessages([]);
      setErrorMsg('');
      setExpandedSources({});
      setCopiedId(null);
      localStorage.setItem('documind_active_doc_id', found.id);
    }
  };

  // Handle "New Chat" button click
  const handleNewChat = () => {
    setActiveConversationId(null);
    setIsNewChatSession(true);
    setMessages([]);
    setErrorMsg('');
    setExpandedSources({});
    setCopiedId(null);
  };

  // Copy answer text to clipboard
  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSendMessage = async (customQuestion) => {
    const questionText = (customQuestion || inputQuestion).trim();
    if (!questionText || isSending || !activeDoc?.id) return;

    setErrorMsg('');
    setInputQuestion('');
    setIsSending(true);

    // Optimistically add user message to UI
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: questionText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await documentService.chatWithDocument(
        activeDoc.id,
        questionText,
        5,
        activeConversationId,
        isNewChatSession
      );

      const data = response?.data;
      if (data) {
        if (data.conversation_id) {
          setActiveConversationId(data.conversation_id);
          setIsNewChatSession(false);
        }

        const assistantMsg = data.assistant_message || {
          id: `resp-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          sources: data.source_chunks || [],
          created_at: new Date().toISOString(),
        };

        // Replace optimistic list with confirmed backend messages
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          const confirmedUser = data.user_message || tempUserMsg;
          return [...filtered, confirmedUser, assistantMsg];
        });
      }
    } catch (err) {
      console.error('Failed to send question:', err);
      const errText =
        err.response?.data?.message ||
        err.message ||
        'AI is temporarily busy. Please try again in a moment.';
      setErrorMsg(errText);

      // Rollback temporary user message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInputQuestion(questionText);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleSources = (msgId) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const activeDocType = getDocType(activeDoc);

  const suggestedQuestions = [
    'What are the key points in this document?',
    'Summarize this document briefly.',
    'What important dates, numbers, or details are mentioned?',
  ];

  return (
    <div className="flex flex-col flex-1 h-full min-h-[520px] rounded-3xl border border-slate-800 bg-[#0d121f] shadow-2xl overflow-hidden relative">
      {/* Ambient glow decorations */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-600/10 blur-3xl" />

      {/* Top Header: Permanently visible Document Selector & Chat Actions */}
      <header className="sticky top-0 z-30 flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 bg-[#0f1422]/95 px-4 sm:px-6 py-3 backdrop-blur-md">
        {/* Left: Document Selector Dropdown & Format Badge */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <DocumentIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Document Selector Dropdown - ALWAYS VISIBLE AT ALL TIMES */}
              <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                <select
                  id="ai-document-selector"
                  value={activeDoc?.id || ''}
                  onChange={(e) => handleSwitchDocument(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 cursor-pointer max-w-[210px] sm:max-w-xs md:max-w-sm truncate"
                  title="Switch active document"
                  aria-label="Switch active document"
                >
                  {combinedDocs.length === 0 ? (
                    <option value="" disabled>
                      No documents available
                    </option>
                  ) : (
                    <>
                      {!activeDoc && <option value="">-- Choose a Document --</option>}
                      {combinedDocs.map((doc) => {
                        const type = getDocType(doc);
                        return (
                          <option key={doc.id} value={doc.id} className="bg-slate-900 text-white">
                            [{type}] {doc.filename || doc.name}
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>

                {/* Format Badge */}
                {activeDoc && (
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${getDocTypeBadge(
                      activeDocType
                    )}`}
                  >
                    {activeDocType}
                  </span>
                )}
              </div>

              {/* Status Badge */}
              {activeDoc && (
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 flex-shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {activeDoc.status || 'Processed'}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
              <span>RAG Document Q&A</span>
              <span>•</span>
              <span className="text-cyan-400 font-medium">Gemini 3.5 Flash Lite</span>
              {isNewChatSession && (
                <>
                  <span>•</span>
                  <span className="text-purple-300 font-semibold">New Chat Session</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: New Chat, Reload, and Close Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
          {/* New Chat Button */}
          {activeDoc && (
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-600/20 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
              title="Start a new chat session for this document"
            >
              <PlusIcon className="h-3.5 w-3.5 text-cyan-300" />
              <span>New Chat</span>
            </button>
          )}

          {/* Reload Chat History Button */}
          {activeDoc && (
            <button
              type="button"
              onClick={() => loadChatHistory(activeDoc.id)}
              title="Reload Chat History"
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RefreshCwIcon className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Return to Dashboard */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Return to Dashboard"
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Chat Messages Body */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 z-10 scroll-smooth"
      >
        {/* Loading skeleton */}
        {isLoadingHistory ? (
          <div className="flex flex-col gap-4 py-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse" />
              <div className="h-10 w-64 rounded-2xl bg-slate-800/60 animate-pulse" />
            </div>
            <div className="flex items-center justify-end gap-3">
              <div className="h-10 w-72 rounded-2xl bg-purple-950/40 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse" />
              <div className="h-20 w-80 rounded-2xl bg-slate-800/60 animate-pulse" />
            </div>
          </div>
        ) : !activeDoc && combinedDocs.length === 0 ? (
          /* Empty state: No documents exist */
          <div className="flex flex-col items-center justify-center h-full py-12 text-center max-w-md mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 mb-4 shadow-lg">
              <DocumentIcon className="h-7 w-7 text-purple-300" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Documents Available</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              Upload a PDF, Word (.docx), or Text (.txt) document to start grounded AI Q&A with Google Gemini.
            </p>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500 transition-all"
              >
                <span>Go to Document Upload</span>
              </button>
            )}
          </div>
        ) : !activeDoc && combinedDocs.length > 0 ? (
          /* Empty state: Documents available but none currently selected */
          <div className="flex flex-col items-center justify-center h-full py-12 text-center max-w-md mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600/20 to-cyan-600/20 border border-purple-500/30 text-purple-400 mb-4 shadow-lg">
              <SparklesIcon className="h-7 w-7 text-cyan-300" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Select a Document to Begin</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              Choose any document from the dropdown above or click one below to query its content with Gemini.
            </p>
            <div className="w-full space-y-2">
              {combinedDocs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSwitchDocument(d.id)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-left text-xs text-slate-300 hover:border-purple-500/50 hover:bg-purple-950/20 hover:text-white transition-all"
                >
                  <span className="truncate">{d.filename || d.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${getDocTypeBadge(
                      getDocType(d)
                    )}`}
                  >
                    {getDocType(d)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* Empty state for active document (New Chat or No Previous Messages) */
          <div className="flex flex-col items-center justify-center h-full py-12 text-center max-w-md mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600/20 to-cyan-600/20 border border-purple-500/30 text-purple-400 mb-4 shadow-lg">
              <SparklesIcon className="h-7 w-7 text-cyan-300" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              Ask Gemini About This Document
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              Grounded strictly in <span className="font-semibold text-purple-300">{activeDoc.filename || activeDoc.name}</span> using pgvector cosine similarity search.
            </p>

            <div className="w-full space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Suggested Prompts
              </p>
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="w-full flex items-center rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-left text-xs text-slate-300 hover:border-purple-500/50 hover:bg-purple-950/20 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <LightbulbIcon className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    <span>{q}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLastUser = idx === lastUserIdx;
              const sources = Array.isArray(msg.sources) ? msg.sources : [];
              const isExpanded = !!expandedSources[msg.id || idx];

              return (
                <div
                  key={msg.id || idx}
                  ref={isLastUser ? lastUserMessageRef : null}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} transition-opacity duration-200`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-md leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 text-white rounded-tr-xs border border-purple-400/30 shadow-purple-900/25'
                        : 'bg-[#131a2c] text-slate-200 border border-slate-800/90 rounded-tl-xs shadow-slate-950/40'
                    }`}
                  >
                    {/* Header badge for User Question */}
                    {isUser && (
                      <div className="flex items-center justify-end gap-1.5 mb-1.5 pb-1 border-b border-purple-400/20">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-200/90">
                          You
                        </span>
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500/40 text-purple-200">
                          <UserIcon className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    )}

                    {/* Header badge for Assistant with Copy button */}
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/70">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                            <SparklesIcon className="h-3 w-3" />
                          </div>
                          <span>Gemini Assistant</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id || idx)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-700/60"
                          title="Copy answer to clipboard"
                          aria-label="Copy answer"
                        >
                          {copiedId === (msg.id || idx) ? (
                            <>
                              <CheckIcon className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium text-[10px]">Copied!</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon className="h-3 w-3 text-slate-400" />
                              <span className="text-[10px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Content (Formatted Markdown for AI Assistant, plain text for user) */}
                    {isUser ? (
                      <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}

                    {/* Source Citations Accordion (Assistant only) */}
                    {!isUser && sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => toggleSources(msg.id || idx)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <DocumentIcon className="h-3 w-3" />
                          <span>
                            {isExpanded ? 'Hide' : 'View'} {sources.length} Grounded Source{' '}
                            {sources.length === 1 ? 'Chunk' : 'Chunks'}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {sources.map((src, sIdx) => (
                              <div
                                key={sIdx}
                                className="rounded-xl border border-slate-800/90 bg-[#090d16] p-2.5 text-[11px] text-slate-300"
                              >
                                <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400">
                                  <span className="font-semibold text-purple-300">
                                    {src.page_number
                                      ? `Page ${src.page_number} • Chunk #${src.chunk_index ?? sIdx}`
                                      : `Chunk #${src.chunk_index ?? sIdx}`}
                                  </span>
                                  {src.similarity_score !== undefined && (
                                    <span className="rounded bg-purple-500/10 px-1.5 py-0.2 text-purple-300 font-mono">
                                      Score: {(src.similarity_score * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <p className="italic text-slate-300 leading-snug line-clamp-3">
                                  "{src.content}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div
                      className={`text-[10px] mt-1.5 ${
                        isUser ? 'text-purple-200/70 text-right' : 'text-slate-500'
                      }`}
                    >
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Awaiting response spinner */}
            {isSending && (
              <div className="flex flex-col items-start">
                <div className="rounded-2xl rounded-tl-xs border border-slate-800 bg-[#131a2c] px-4 py-3 text-xs text-slate-300 shadow-md flex items-center gap-2.5">
                  <SparklesIcon className="h-4 w-4 text-cyan-400 animate-spin" />
                  <span className="text-slate-300">
                    Retrieving document chunks & generating answer...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-6 mb-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center justify-between z-10 flex-shrink-0">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-red-400 hover:text-white"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Floating Jump to Latest Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToLatestConversation('smooth')}
          className="absolute bottom-24 right-8 z-20 flex items-center gap-1.5 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white px-3.5 py-2 text-xs font-semibold shadow-lg shadow-purple-900/50 backdrop-blur-sm border border-purple-400/40 transition-all hover:scale-105 active:scale-95"
          title="Jump to latest exchange"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>Jump to latest</span>
        </button>
      )}

      {/* Chat Input Bar */}
      <footer className="border-t border-slate-800/80 bg-[#0f1422]/90 p-4 sm:p-5 backdrop-blur-md z-10 flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || !activeDoc}
            placeholder={
              activeDoc
                ? `Ask Gemini about ${activeDoc.filename || activeDoc.name}...`
                : 'Please select a document above to ask questions...'
            }
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputQuestion.trim() || isSending || !activeDoc}
            className="flex h-11 w-11 sm:h-auto sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] transition-all disabled:opacity-40 flex-shrink-0"
          >
            {isSending ? (
              <SparklesIcon className="h-4 w-4 animate-spin text-white" />
            ) : (
              <span>Ask AI</span>
            )}
          </button>
        </form>
        <p className="text-center text-[11px] text-slate-500 mt-2">
          Strictly grounded in {activeDoc?.filename || 'your document'} • Powered by Google Gemini
        </p>
      </footer>
    </div>
  );
}
