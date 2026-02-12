import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      setSyncError(null);
      const response = await fetch(`/api/weekends?t=${Date.now()}`);
      
      // If the backend returns 404, it might not be deployed/running yet
      if (response.status === 404) {
        if (isInitial) {
          console.warn("API not detected. Running in Local Mode.");
          setIsOfflineMode(true);
          const saved = localStorage.getItem('squad_sync_offline');
          if (saved) {
            const parsed = JSON.parse(saved);
            setWeekends(parsed.map((w: any) => ({ ...w, date: new Date(w.id) })));
          }
        }
        setIsConnecting(false);
        return;
      }

      if (!response.ok) throw new Error(`Cloud error: ${response.status}`);
      
      const data = await response.json();
      
      if (data && Array.isArray(data) && data.length > 0) {
        const hydrated = data.map((w: any) => ({
          ...w,
          date: new Date(w.id || w.date || Date.now())
        }));
        
        setWeekends(prev => {
          const hasChanged = JSON.stringify(prev) !== JSON.stringify(hydrated);
          return hasChanged ? hydrated : prev;
        });
        setLastSynced(new Date());
        setIsOfflineMode(false);
        setIsConnecting(false);
      } else if (isInitial) {
        // Handle empty database by initializing
        console.log("Empty DB. Initializing...");
        await fetch('/api/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(INITIAL_WEEKENDS)
        });
        fetchData();
      }
    } catch (err) {
      console.error("Cloud Sync Issue:", err);
      setSyncError("Cloud connection unstable...");
      // We don't switch to offline mode here; we just wait for the next poll
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Continuous polling every 5 seconds to stay in sync with other squad members
  useEffect(() => {
    const interval = setInterval(() => fetchData(), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
          const newFullList = weekends.map(item => item.id === weekendId ? updatedWeekend : item);
          localStorage.setItem('squad_sync_offline', JSON.stringify(newFullList));
        } else {
          // Push update to Firestore immediately
          fetch('/api/weekends', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedWeekend)
          })
          .then(res => {
            if (res.ok) setLastSynced(new Date());
            else throw new Error();
          })
          .catch(() => setSyncError("Failed to push update!"));
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
      console.error("AI Error:", err);
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
          <h2 className="text-xl font-bold text-slate-900">SquadSync</h2>
          <p className="text-slate-400 text-sm mt-2 font-medium">Waking up the squad server...</p>
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
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Weekend Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                {isConnecting ? (
                  <i className="fas fa-circle-notch fa-spin text-indigo-400 text-[10px]"></i>
                ) : (
                  <span className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></span>
                )}
                <span className="text-[10px] uppercase font-black text-slate-500">
                  {isConnecting ? 'Searching...' : (isOfflineMode ? 'Offline Mode' : 'Live Syncing')}
                </span>
              </div>
              {lastSynced && !isOfflineMode && (
                <span className="text-[8px] text-slate-300 font-bold uppercase">
                  Last Seen: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i className="fas fa-clock-rotate-left text-slate-400"></i>
              Availability Schedule
            </h2>
            <div className="flex items-center gap-3">
               {syncError && (
                 <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold animate-pulse">
                   <i className="fas fa-cloud-slash mr-1"></i> {syncError}
                 </span>
               )}
              <button 
                onClick={generateInsight}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-robot"></i>}
                Ask AI
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {weekends.map(weekend => (
              <div key={weekend.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-indigo-200 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 w-12 h-12 rounded-lg flex flex-col items-center justify-center border border-slate-200">
                      <span className="text-[10px] font-black text-slate-400 uppercase leading-none">
                        {weekend.date.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-slate-800 leading-none">
                        {weekend.date.getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {weekend.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
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
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                <i className="fas fa-sparkles"></i>
                Squad AI Insight
              </h3>
              <p className="text-sm text-indigo-50 mb-4 leading-relaxed font-medium italic opacity-90">"{insight.summary}"</p>
              <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                <p className="text-[10px] font-black text-indigo-200 uppercase mb-1">Squad Recommendation</p>
                <p className="text-sm font-semibold">{insight.recommendation}</p>
              </div>
            </div>
          )}

          <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg sticky top-24">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <i className="fas fa-check-double"></i>
              Available Dates
            </h3>
            {shortlist.length > 0 ? (
              <div className="space-y-3">
                {shortlist.map(w => (
                  <div key={w.id} className="bg-white/10 p-3 rounded-xl border border-white/20 flex items-center justify-between">
                    <p className="font-bold text-sm">{w.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    <span className="text-[9px] bg-white text-emerald-700 px-2 py-1 rounded-full uppercase font-black">All Free!</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 opacity-60">
                <i className="fas fa-calendar-xmark text-3xl mb-3"></i>
                <p className="text-xs font-bold uppercase tracking-widest">No common dates found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 py-3 z-50">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></div>
            <span>Status: {isOfflineMode ? 'LOCAL STORAGE MODE' : 'CLOUD PERSISTENCE ACTIVE'}</span>
          </div>
          <span className="hidden sm:inline">SquadSync 2026 • Real-time Coordination</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
