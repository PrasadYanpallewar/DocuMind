import { useAuth } from '../context/AuthContext';
import {
  DashboardIcon,
  DocumentIcon,
  SparklesIcon,
  CollectionsIcon,
  AnalyticsIcon,
  SettingsIcon,
  LogoutIcon,
  CloseIcon,
  BrainIcon,
} from './icons/Icons';

export default function Sidebar({
  activeNav,
  setActiveNav,
  isOpen,
  setIsOpen,
  documentCount = 0,
}) {
  const { user, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'DM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(user?.name);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, badge: null },
    { id: 'documents', label: 'My Documents', icon: DocumentIcon, badge: documentCount },
    { id: 'ai-assistant', label: 'AI Assistant', icon: SparklesIcon, badge: 'RAG', isPro: true },
    { id: 'collections', label: 'Collections', icon: CollectionsIcon, badge: null },
    { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon, badge: null },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, badge: null },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen h-[100dvh] w-72 flex-col justify-between border-r border-slate-800/80 bg-[#0d121f] p-4 transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 flex-shrink-0 overflow-y-auto overflow-x-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-6 flex-shrink-0">
          {/* Logo & Platform Name */}
          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 shadow-lg shadow-purple-500/20">
                <BrainIcon className="h-6 w-6 text-white" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
                </span>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Docu<span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Mind</span>
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-purple-400/80">
                  Document Intelligence
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5 pt-2">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Core Platform
            </div>
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.id);
                    if (window.innerWidth < 1024) setIsOpen(false);
                  }}
                  className={`group relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/20 to-indigo-600/10 text-white shadow-sm border border-purple-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`transition-colors duration-200 ${
                        isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {/* Badge */}
                  {item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.isPro
                          ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-purple-400 to-indigo-500 shadow-sm shadow-purple-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: AI Engine Status & User Profile */}
        <div className="flex flex-col gap-4 border-t border-slate-800/80 pt-4 flex-shrink-0">
          {/* Gemini AI Status Box */}
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-purple-950/30 to-slate-900/40 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                <SparklesIcon className="h-3.5 w-3.5 text-cyan-400" />
                Gemini 3.5 Flash Lite
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              pgvector indexing & RAG semantic chat active.
            </p>
          </div>

          {/* User Profile Section */}
          <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 border border-slate-800/60">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative flex-shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 text-sm font-bold text-white shadow-md">
                  {initials}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0d121f] bg-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{user?.name || 'User'}</p>
                <p className="truncate text-xs text-slate-400">{user?.email || ''}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
