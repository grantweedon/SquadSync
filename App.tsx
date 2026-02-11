
import React, { useState, useMemo, useEffect } from 'react';
import { WeekendAvailability, AvailabilityStatus, FriendName, SquadInsight } from './types';
import { INITIAL_WEEKENDS, FRIENDS } from './constants';
import StatusBadge from './components/StatusBadge';
import { getSquadInsight } from './services/geminiService';

const App: React.FC = () => {
  const [weekends, setWeekends] = useState<WeekendAvailability[]>(INITIAL_WEEKENDS);
  const [insight, setInsight] = useState<SquadInsight | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Persistence Simulation (Local Storage)
  useEffect(() => {
    const saved = localStorage.getItem('squad_sync_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Re-hydrate dates and update if the length changed significantly (20 vs 12)
        if (parsed.length !== 20) {
           // If the count changed, we reset to the new 20-row format
           return; 
        }
        setWeekends(parsed.map((w: any) => ({ ...w, date: new Date(w.date) })));
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('squad_sync_data', JSON.stringify(weekends));
  }, [weekends]);

  const toggleStatus = (weekendId: string, name: FriendName) => {
    setWeekends(prev => prev.map(w => {
      if (w.id === weekendId) {
        return {
          ...w,
          status: {
            ...w.status,
            [name]: w.status[name] === AvailabilityStatus.FREE 
              ? AvailabilityStatus.BUSY 
              : AvailabilityStatus.FREE
          }
        };
      }
      return w;
    }));
  };

  const shortlist = useMemo(() => {
    return weekends.filter(w => 
      Object.values(w.status).every(s => s === AvailabilityStatus.FREE)
    );
  }, [weekends]);

  const generateInsight = async () => {
    setIsSyncing(true);
    try {
      const data = await getSquadInsight(weekends);
      setInsight(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <i className="fas fa-calendar-check text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">SquadSync</h1>
              <p className="text-xs text-slate-500 font-medium">Availability Coordinator</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={generateInsight}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
              Squad Insight
            </button>
            <div className="hidden md:flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Cloud Sync Active</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Weekend List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i className="fas fa-list text-slate-400"></i>
              Upcoming Weekends
            </h2>
            <span className="text-xs font-semibold text-slate-400 bg-slate-200 px-2 py-1 rounded">Next 20 Weeks</span>
          </div>

          <div className="space-y-3">
            {weekends.map(weekend => (
              <div 
                key={weekend.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 w-12 h-12 rounded-lg flex flex-col items-center justify-center border border-slate-200 group-hover:border-indigo-200 transition-colors">
                      <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                        {weekend.date.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-slate-800 leading-none">
                        {weekend.date.getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {weekend.date.toLocaleDateString('en-US', { weekday: 'long' })}, {weekend.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">Click a name to toggle availability</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FRIENDS.map(name => (
                      <StatusBadge 
                        key={name}
                        name={name}
                        status={weekend.status[name]}
                        onClick={() => toggleStatus(weekend.id, name)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Shortlist & Insights */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* AI Insight Box */}
          {insight && (
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
              <i className="fas fa-sparkles absolute -top-4 -right-4 text-white/10 text-8xl"></i>
              <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                <i className="fas fa-brain"></i>
                Squad Insights
              </h3>
              <p className="text-sm text-indigo-100 mb-4 leading-relaxed italic">
                "{insight.summary}"
              </p>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Recommendation</p>
                <p className="text-sm font-medium">{insight.recommendation}</p>
              </div>
            </div>
          )}

          {/* Shortlist Card */}
          <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-100">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <i className="fas fa-trophy"></i>
              The Shortlist
            </h3>
            
            {shortlist.length > 0 ? (
              <div className="space-y-3">
                {shortlist.map(w => (
                  <div key={w.id} className="bg-white/10 p-3 rounded-xl border border-white/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <i className="fas fa-star text-yellow-300"></i>
                       <div>
                         <p className="font-bold text-sm">{w.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                         <p className="text-[10px] text-emerald-100 font-medium uppercase">Perfect Match</p>
                       </div>
                    </div>
                    <i className="fas fa-chevron-right text-emerald-300"></i>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-emerald-700/50 rounded-xl border border-emerald-400/30">
                <i className="fas fa-calendar-xmark text-3xl mb-3 opacity-50"></i>
                <p className="text-sm font-medium opacity-80">No full-squad dates found yet.</p>
                <p className="text-[10px] mt-1 opacity-60">Try coordinating with the guys!</p>
              </div>
            )}
          </div>

          {/* User Guide */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Guide</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center text-[10px] text-white">
                  <i className="fas fa-check"></i>
                </div>
                <p className="text-xs text-slate-600 leading-tight">Green means you are 100% free to hang out.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0 flex items-center justify-center text-[10px] text-white">
                  <i className="fas fa-times"></i>
                </div>
                <p className="text-xs text-slate-600 leading-tight">Red means you have plans or work commitments.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center text-[10px] text-white">
                  <i className="fas fa-bolt"></i>
                </div>
                <p className="text-xs text-slate-600 leading-tight">Shortlist updates automatically when everyone is green.</p>
              </li>
            </ul>
          </div>

        </div>
      </main>

      {/* Persistence Note Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 z-50">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
             SquadSync v1.0.5 <span className="mx-2">•</span> Cloud Firestore Prototype
           </p>
           <div className="flex gap-4">
             <i className="fab fa-google text-slate-300"></i>
             <i className="fab fa-github text-slate-300"></i>
             <i className="fas fa-shield-halved text-slate-300"></i>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
