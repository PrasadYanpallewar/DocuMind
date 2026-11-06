import { DocumentIcon, CheckCircleIcon, ClockIcon, DatabaseIcon, TrendingUpIcon } from './icons/Icons';

export default function StatsCards({ stats }) {
  const defaultStats = [
    {
      id: 'total',
      title: 'Total Documents',
      value: stats?.total ?? 128,
      subtext: '+12% from last month',
      trend: 'positive',
      icon: DocumentIcon,
      accent: 'from-purple-500/20 to-indigo-500/10',
      iconColor: 'text-purple-400',
      borderGlow: 'hover:border-purple-500/40',
    },
    {
      id: 'processed',
      title: 'Processed Documents',
      value: stats?.processed ?? 114,
      subtext: '89.1% completion rate',
      trend: 'positive',
      icon: CheckCircleIcon,
      accent: 'from-emerald-500/20 to-teal-500/10',
      iconColor: 'text-emerald-400',
      borderGlow: 'hover:border-emerald-500/40',
    },
    {
      id: 'pending',
      title: 'Pending Documents',
      value: stats?.pending ?? 14,
      subtext: 'Average queue: 45 sec',
      trend: 'neutral',
      icon: ClockIcon,
      accent: 'from-amber-500/20 to-orange-500/10',
      iconColor: 'text-amber-400',
      borderGlow: 'hover:border-amber-500/40',
    },
    {
      id: 'storage',
      title: 'Storage Used',
      value: stats?.storageUsed ?? '1.42 GB',
      subtext: '28.4% of 5.0 GB limit',
      progress: 28.4,
      icon: DatabaseIcon,
      accent: 'from-cyan-500/20 to-blue-500/10',
      iconColor: 'text-cyan-400',
      borderGlow: 'hover:border-cyan-500/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {defaultStats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.id}
            className={`group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0f1422] p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 ${item.borderGlow}`}
          >
            {/* Ambient background glow on hover */}
            <div
              className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${item.accent} opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-75`}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {item.title}
              </span>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800/80 ${item.iconColor} shadow-inner group-hover:scale-105 transition-transform`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {item.value}
              </span>
            </div>

            {/* Storage Progress bar or Trend subtext */}
            {item.progress !== undefined ? (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span>Usage</span>
                  <span className="font-medium text-slate-300">{item.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                {item.trend === 'positive' && (
                  <span className="inline-flex items-center gap-0.5 font-medium text-emerald-400">
                    <TrendingUpIcon className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="text-slate-400">{item.subtext}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
