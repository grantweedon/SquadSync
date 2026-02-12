
import React, { useState, useMemo, useEffect } from 'react';
import { WeekendAvailability, AvailabilityStatus, FriendName, SquadInsight } from './types.ts';
import { INITIAL_WEEKENDS, FRIENDS } from './constants.ts';
import StatusBadge from './components/StatusBadge.tsx';
import { getSquadInsight } from './services/geminiService.ts';

const App: React.FC = () => {
  const [weekends, setWeekends] = useState<WeekendAvailability[]>(INITIAL_WEEKENDS);
  const [insight, setInsight] = useState<SquadInsight | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Sync with Firestore Backend or Fallback to LocalStorage
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/weekends');
        
        // If API is missing (404), fall back to offline mode
        if (response.status === 404) {
          console.warn("Backend API not found. Falling back to Local Demo Mode.");
          setIsOfflineMode(true);
          const saved = localStorage.getItem('squad_sync_offline');
          if (saved) {
            const parsed = JSON.parse(saved);
            setWeekends(parsed.map((w: any) => ({ ...w, date: new Date(w.id) })));
          }
          return;
        }

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data && Array.isArray(data) && data.length > 0) {
          const hydrated = data.map((w: any) => ({
            ...w,
            date: new Date(w.id || w.date || Date.now())
          }));
          setWeekends(hydrated);
        } else {
          console.log("Initializing database with default schedule...");
          await fetch('/api/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(INITIAL_WEEKENDS)
          });
        }
      } catch (err) {
        console.error("Cloud Sync Error:", err);
        setIsOfflineMode(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleStatus = async (weekendId: string, name: FriendName) => {
    const updatedWeekends = weekends.map(w => {
      if (w.id === weekendId) {
        const newStatus = w.status[name] === AvailabilityStatus.FREE 
          ? AvailabilityStatus.BUSY 
          : AvailabilityStatus.FREE;
        
        const updatedWeekend = {
          ...w,
          status: { ...w.status, [name]: newStatus }
        };

        if (isOfflineMode) {
          // Save to local storage in offline mode
          const newFullList = weekends.map(item => item.id === weekendId ? updatedWeekend : item);
          localStorage.setItem('squad_sync_offline', JSON.stringify(newFullList));
        } else {
          // Persist to Firestore
          fetch('/api/weekends', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedWeekend)
          }).catch(err => {
            console.error("Persistence failed, switching to local mode:", err);
            setIsOfflineMode(true);
          });
        }

        return updatedWeekend;
      }
      return w;
    });

    setWeekends(updatedWeekends);
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
      console.error("AI Insight Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-indigo-600 p-4 rounded-2xl text-white inline-block mb-4 animate-bounce">
            <i className="fas fa-calendar-check text-3xl"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-900">SquadSync Cloud</h2>
          <p className="text-slate-400 text-sm mt-2">Connecting to Squad Infrastructure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
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
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {isOfflineMode ? 'Local Mode' : 'Cloud Sync Active'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
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
              <div key={weekend.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 w-12 h-12 rounded-lg flex flex-col items-center justify-center border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                        {weekend.date.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-slate-800 leading-none">
                        {weekend.date.getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {weekend.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">Toggle friend status below</p>
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

        <div className="lg:col-span-4 space-y-6">
          {insight && (
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                <i className="fas fa-brain"></i>
                Squad Insights
              </h3>
              <p className="text-sm text-indigo-100 mb-4 italic leading-relaxed">"{insight.summary}"</p>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <p className="text-xs font-bold text-indigo-200 uppercase mb-1">Recommendation</p>
                <p className="text-sm font-medium">{insight.recommendation}</p>
              </div>
            </div>
          )}

          <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <i className="fas fa-trophy"></i>
              The Shortlist
            </h3>
            {shortlist.length > 0 ? (
              <div className="space-y-3">
                {shortlist.map(w => (
                  <div key={w.id} className="bg-white/10 p-3 rounded-xl border border-white/20 flex items-center justify-between">
                    <p className="font-bold text-sm">{w.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    <span className="text-[10px] bg-white/20 px-2 py-1 rounded uppercase font-bold">All Free</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm opacity-80 text-center py-4">No perfect dates found yet.</p>
            )}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 z-50">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
          <span>SquadSync v1.1.2</span>
          <span className="flex gap-4">
            <i className="fab fa-google"></i>
            <i className="fas fa-cloud"></i>
            <i className="fas fa-database"></i>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
