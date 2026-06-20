import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function StatsWidget({ onClose, user }) {
  const fetchedData = useQuery(api.stats.getStats, user ? undefined : "skip");
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (fetchedData !== undefined) {
      setLoading(false);
    }
  }, [fetchedData, user]);

  const stats = useMemo(() => {
    if (!fetchedData) return null;

    const dataMap = {};
    fetchedData.forEach(d => {
      dataMap[d.date] = d.totalMs;
    });

    const dRef = new Date();
    dRef.setTime(dRef.getTime() - 4 * 60 * 60 * 1000); // shift 4 hours for logical day

    let thisWeekMs = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      thisWeekMs += dataMap[dateStr] || 0;
    }

    let lastWeekMs = 0;
    for (let i = 7; i < 14; i++) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      lastWeekMs += dataMap[dateStr] || 0;
    }

    const thisWeekHours = (thisWeekMs / 3600000).toFixed(1);
    const lastWeekHours = (lastWeekMs / 3600000).toFixed(1);

    let percentChange = 0;
    if (lastWeekMs > 0) {
      percentChange = Math.round(((thisWeekMs - lastWeekMs) / lastWeekMs) * 100);
    } else if (thisWeekMs > 0) {
      percentChange = 100;
    }

    const heatmapDays = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(dRef);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      heatmapDays.push({
        date: dateStr,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalMs: dataMap[dateStr] || 0
      });
    }

    return {
      thisWeekHours,
      lastWeekHours,
      percentChange,
      heatmapDays
    };
  }, [fetchedData]);

  const getIntensityClass = (totalMs) => {
    if (totalMs === 0) return 'bg-white/10';
    if (totalMs < 3600000) return 'bg-primary/30'; // < 1h
    if (totalMs < 10800000) return 'bg-primary/60'; // < 3h
    return 'bg-primary'; // >= 3h
  };

  const formatTime = (ms) => {
    const totalMins = Math.round(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="absolute bottom-20 right-0 w-[420px] glass-panel rounded-2xl p-6 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4 origin-bottom-right">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-h2 text-lg text-primary">Focus Stats</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      
      {!user ? (
        <div className="flex-grow flex items-center justify-center text-on-surface-variant text-sm py-10">
          Please login to view your focus statistics.
        </div>
      ) : loading || !stats ? (
        <div className="flex-grow flex items-center justify-center text-primary py-10">
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface/50 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center text-center">
              <div className="text-on-surface-variant text-xs mb-1 uppercase tracking-wider font-semibold">This Week</div>
              <div className="text-3xl font-bold text-on-surface">{stats.thisWeekHours}h</div>
              <div className={`text-xs mt-1 font-medium ${stats.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange}% {stats.percentChange >= 0 ? '📈' : '📉'}
              </div>
            </div>
            <div className="bg-surface/50 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center text-center">
              <div className="text-on-surface-variant text-xs mb-1 uppercase tracking-wider font-semibold">Last Week</div>
              <div className="text-3xl font-bold text-on-surface">{stats.lastWeekHours}h</div>
            </div>
          </div>

          {/* Focus Heatmap */}
          <div>
            <div className="text-on-surface-variant text-xs mb-3 uppercase tracking-wider font-semibold">Last 90 Days</div>
            <div className="flex justify-center">
              <div className="grid grid-rows-7 grid-flow-col gap-1.5 pb-2">
                {stats.heatmapDays.map((day) => (
                  <div 
                    key={day.date} 
                    className={`w-3 h-3 rounded-sm ${getIntensityClass(day.totalMs)} group relative cursor-pointer hover:ring-2 hover:ring-white/50 transition-all`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface text-on-surface text-xs rounded border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                      {day.displayDate}: {formatTime(day.totalMs)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
