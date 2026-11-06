import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  SearchIcon,
  BellIcon,
  MenuIcon,
  SparklesIcon,
  UserIcon,
  SettingsIcon,
  LogoutIcon,
} from './icons/Icons';

export default function Navbar({
  onToggleSidebar,
  searchQuery,
  setSearchQuery,
  title = "Dashboard",
}) {
  const { user, logout } = useAuth();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'DM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(user?.name);

  const notifications = [
    { id: 1, title: 'Analysis Complete', desc: 'Q3_Financial_Report.pdf processed with 14 insights', time: '10m ago' },
    { id: 2, title: 'pgvector Synced', desc: '98 text chunks indexed with Gemini Embeddings', time: '1h ago' },
    { id: 3, title: 'Upload Successful', desc: 'Vendor_Agreement_v2.docx ready for Q&A', time: '3h ago' },
  ];

  // Outside click and escape key handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check notification panel
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      // Check profile dropdown
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setIsProfileOpen(false);
      }
    };

    // Use document pointer events for outside click detection
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listeners
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-18 w-full flex-shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#0b0f19]/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
      {/* Left: Mobile hamburger & Dashboard title */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            {title}
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300 border border-purple-500/20">
              <SparklesIcon className="h-3 w-3 text-purple-400" />
              v1.0
            </span>
          </h1>
          <p className="hidden md:block text-xs text-slate-400">
            Intelligent document parsing, vector indexing & Gemini AI
          </p>
        </div>
      </div>

      {/* Middle & Right: Search bar & User Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Search Bar */}
        <div className="relative w-40 sm:w-64 md:w-80">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents or insights..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-10 text-sm text-slate-100 placeholder-slate-400 transition-all focus:border-purple-500/50 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
        </div>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setIsProfileOpen(false);
              setHasUnreadNotifications(false);
            }}
            aria-expanded={showNotifications}
            aria-label="View notifications"
            className={`relative rounded-xl border p-2 transition-all duration-200 ${
              showNotifications
                ? 'border-purple-500/50 bg-purple-500/10 text-white'
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BellIcon className="h-5 w-5" />
            {hasUnreadNotifications && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            )}
          </button>

          {/* Notifications Flyout with smooth opening/closing transition */}
          <div
            className={`absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-800/90 bg-[#0f1523] p-3 shadow-2xl shadow-purple-950/40 z-50 transition-all duration-200 ease-out origin-top-right ${
              showNotifications
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 px-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <span className="text-xs text-purple-400 font-medium cursor-pointer hover:underline">
                Mark all read
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-2.5 hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-200">{item.title}</p>
                    <span className="text-[10px] text-slate-400">{item.time}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Avatar with Profile Dropdown */}
        <div className="relative pl-1 border-l border-slate-800/80" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setIsProfileOpen((prev) => !prev);
              setShowNotifications(false);
            }}
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
            aria-label="User profile settings"
            className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-xs font-bold text-white ring-2 transition-all shadow-md active:scale-95 ${
              isProfileOpen
                ? 'ring-purple-400 shadow-purple-500/30'
                : 'ring-purple-500/30 hover:ring-purple-500'
            }`}
          >
            {initials}
          </button>

          {/* Profile Flyout with smooth opening/closing transition */}
          <div
            className={`absolute right-0 mt-2.5 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-800/90 bg-[#0f1523] p-2 shadow-2xl shadow-black/60 z-50 transition-all duration-200 ease-out origin-top-right ${
              isProfileOpen
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            }`}
          >
            {/* User Profile Header */}
            <div className="flex items-center gap-3 border-b border-slate-800/80 px-3 py-2.5 mb-1">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-xs font-bold text-white shadow">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{user?.name || 'User'}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email || ''}</p>
              </div>
            </div>

            {/* Menu Options */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors text-left"
              >
                <UserIcon className="h-4 w-4 text-purple-400" />
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors text-left"
              >
                <SettingsIcon className="h-4 w-4 text-cyan-400" />
                <span>Account Settings</span>
              </button>

              <div className="my-1 border-t border-slate-800/80" />

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left"
              >
                <LogoutIcon className="h-4 w-4 text-red-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
