import React, { useState, useEffect, useRef } from 'react';
import { useTimer } from './hooks/useTimer';
import { getLogicalDateStr } from './logic/Timer';
import TodoWidget from './components/TodoWidget';
import NotesWidget from './components/NotesWidget';
import SpotifyWidget from './components/SpotifyWidget';
import StatsWidget from './components/StatsWidget';
import './index.css';

// Clerk & Convex
import { useUser, SignInButton, UserButton } from '@clerk/clerk-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function App() {
  const { mode, isRunning, timeRemaining, timeElapsed, dailyTotal, laps, start, pause, reset, lap, setMode, setDuration, formatTime, syncFromDb } = useTimer();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [activeWidget, setActiveWidget] = useState(null); // 'tasks' | 'music' | 'notes' | null
  const [showStats, setShowStats] = useState(false);

  // Auth State
  const { user } = useUser();
  const syncStats = useMutation(api.stats.syncDailyTotal);
  const dbStats = useQuery(api.stats.getStats);

  // Sync dailyTotal from Convex down to local state
  useEffect(() => {
    if (user && dbStats) {
      const today = getLogicalDateStr();
      const todayStat = dbStats.find(s => s.date === today);
      if (todayStat) {
        syncFromDb(todayStat.totalMs || 0, todayStat.laps || []);
      }
    }
  }, [user, dbStats, syncFromDb]);

  // Track latest stats for periodic syncing
  const latestStats = useRef({ dailyTotal, laps });
  useEffect(() => {
    latestStats.current = { dailyTotal, laps };
  }, [dailyTotal, laps]);

  // Periodic sync to Convex every 10 seconds while running
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      const { dailyTotal: currentTotal, laps: currentLaps } = latestStats.current;
      if (isRunning && currentTotal > 0) {
        const today = getLogicalDateStr();
        syncStats({
          date: today,
          totalMs: currentTotal,
          laps: currentLaps
        }).catch(err => console.error("Periodic sync failed:", err));
      }
    }, 10000);
    return () => clearInterval(intervalId);
  }, [user, isRunning, syncStats]);

  // Sync dailyTotal to Convex when timer pauses/stops
  useEffect(() => {
    if (user && !isRunning && dailyTotal > 0) {
      const syncData = async () => {
        try {
          const today = getLogicalDateStr(); // YYYY-MM-DD based on 4 AM IST
          await syncStats({
            date: today,
            totalMs: dailyTotal,
            laps: laps // Send laps array to Convex
          });
        } catch (err) {
          console.error("Failed to sync stats to Convex:", err);
        }
      };
      syncData();
    }
  }, [isRunning, user, dailyTotal, laps]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const formatClock = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes}`;
  };

  const getDisplayTime = () => {
    if (mode === 'home') return formatClock(currentTime);
    if (mode === 'pomodoro' || mode === 'break') return formatTime(timeRemaining);
    if (mode === 'stopwatch') return formatTime(timeElapsed);
    return '00:00';
  };

  const handlePresetClick = (minutes) => {
    setDuration(minutes * 60);
    setShowCustomInput(false);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const mins = parseInt(customMinutes, 10);
    if (!isNaN(mins) && mins > 0) {
      setDuration(mins * 60);
      setShowCustomInput(false);
      setCustomMinutes("");
    }
  };



  return (
    <>
      {/* Top Left - Lap Report */}
      {!isFullscreen && (
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-50 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto max-w-[80vw] md:max-w-none">
          {mode === 'stopwatch' && (
            <div className="glass-panel p-3 md:p-4 rounded-xl min-w-[150px] md:min-w-[200px] max-h-[250px] overflow-y-auto no-scrollbar border border-white/10 shadow-lg animate-fade-in">
              <h3 className="text-primary font-label-caps text-label-caps mb-2 opacity-80">Lap Report</h3>
              {!laps || laps.length === 0 ? (
                <p className="text-on-surface-variant text-sm italic">No laps yet.</p>
              ) : (
                <ul className="space-y-2">
                  {laps.map((lapTime, index) => (
                    <li key={index} className="flex justify-between text-sm text-primary gap-4">
                      <span className="opacity-80">Lap {index + 1}</span>
                      <span className="tabular-nums font-mono opacity-90">{formatTime(lapTime)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <main className="flex-grow flex flex-col items-center justify-center z-10 text-center relative w-full h-full transition-opacity duration-300 px-4">
        <h1 className="font-display-clock text-display-clock-mobile md:text-display-clock drop-shadow-2xl text-primary font-bold tracking-tighter tabular-nums" id="main-clock">
          {getDisplayTime()}
        </h1>
        
        {mode === 'home' && (
          <p className="font-body-lg text-body-lg text-primary opacity-70 mt-stack-md font-light tracking-wide italic">"Believe in the power of your dreams"</p>
        )}

        {mode !== 'home' && (
          <div className="flex flex-col items-center mt-stack-md glass-panel p-glass-padding rounded-lg">
            
            {(mode === 'pomodoro' || mode === 'break') && (
              <div className="flex gap-2 mb-6 flex-wrap justify-center">
                {mode === 'pomodoro' && (
                  <>
                    <button onClick={() => handlePresetClick(25)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">25m</button>
                    <button onClick={() => handlePresetClick(60)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">1h</button>
                    <button onClick={() => handlePresetClick(180)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">3h</button>
                  </>
                )}
                {mode === 'break' && (
                  <>
                    <button onClick={() => handlePresetClick(10)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">10m</button>
                    <button onClick={() => handlePresetClick(15)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">15m</button>
                    <button onClick={() => handlePresetClick(30)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">30m</button>
                  </>
                )}
                <button onClick={() => setShowCustomInput(!showCustomInput)} className="px-4 py-1 rounded-full border border-white/20 text-primary text-sm hover:bg-white/10">Custom</button>
              </div>
            )}

            {showCustomInput && (mode === 'pomodoro' || mode === 'break') && (
              <form onSubmit={handleCustomSubmit} className="flex gap-2 mb-6">
                <input 
                  type="number" 
                  min="1"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Minutes" 
                  className="bg-black/30 border border-white/20 rounded-md px-3 py-1 text-primary w-24 text-center focus:outline-none"
                />
                <button type="submit" className="px-3 py-1 bg-white/20 text-primary rounded-md hover:bg-white/30">Set</button>
              </form>
            )}

            <div className="flex items-center gap-stack-md">
              <button onClick={isRunning ? pause : start} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors w-12 h-12 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">{isRunning ? 'pause' : 'play_arrow'}</span>
              </button>
              {mode === 'stopwatch' && (
                <button onClick={lap} className="px-6 py-2 rounded-full border border-white/30 text-primary hover:bg-white/10 transition-colors">Lap</button>
              )}
              {(mode === 'pomodoro' || mode === 'break') && (
                <button onClick={reset} className="px-6 py-2 rounded-full border border-white/30 text-primary hover:bg-white/10 transition-colors">Reset</button>
              )}
            </div>
            
            <p className="mt-stack-sm font-label-caps text-label-caps text-primary/60">
              Total Daily Focus Time: {formatTime(dailyTotal)}
            </p>
          </div>
        )}
      </main>

      {/* Left panel widgets */}
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-50 pointer-events-none [&>*]:pointer-events-auto flex flex-col gap-4">
        
        {/* Active Widget Render */}
        <div className="relative">
          {activeWidget === 'tasks' && <TodoWidget onClose={() => setActiveWidget(null)} />}
          {activeWidget === 'music' && <SpotifyWidget onClose={() => setActiveWidget(null)} />}
          {activeWidget === 'notes' && <NotesWidget onClose={() => setActiveWidget(null)} />}
        </div>

        <div className="glass-panel rounded-full px-3 md:px-4 py-2 flex gap-2 md:gap-4 shadow-2xl border border-white/20">
          <button onClick={() => setActiveWidget(activeWidget === 'tasks' ? null : 'tasks')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group ${activeWidget === 'tasks' ? 'bg-white/20 text-primary' : ''}`}>
            <span className="material-symbols-outlined group-hover:text-primary transition-colors text-[20px]">check_circle</span>
          </button>
          <button onClick={() => setActiveWidget(activeWidget === 'music' ? null : 'music')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group ${activeWidget === 'music' ? 'bg-white/20 text-primary' : ''}`}>
            <span className="material-symbols-outlined group-hover:text-primary transition-colors text-[20px]">music_note</span>
          </button>
          <button onClick={() => setActiveWidget(activeWidget === 'notes' ? null : 'notes')} className={`text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex flex-col items-center group ${activeWidget === 'notes' ? 'bg-white/20 text-primary' : ''}`}>
            <span className="material-symbols-outlined group-hover:text-primary transition-colors text-[20px]">edit_note</span>
          </button>
        </div>
      </div>

      {/* Right panel options */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2 pointer-events-none [&>*]:pointer-events-auto">
        
        <div className="relative w-full">
          {showStats && <StatsWidget user={user} onClose={() => setShowStats(false)} />}
        </div>

        {rightPanelOpen && (
          <div className="glass-panel rounded-[2rem] p-3 flex flex-col gap-3 shadow-2xl border border-white/20 animate-fade-in origin-bottom-right">
            
            {user ? (
              <div className="flex items-center justify-center p-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Login with Clerk">
                  <span className="material-symbols-outlined text-[20px]">login</span>
                </button>
              </SignInButton>
            )}

            <button className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Themes">
              <span className="material-symbols-outlined text-[20px]">palette</span>
            </button>

            <button onClick={() => setMode('home')} className={`${mode === 'home' ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Home">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'home' ? "'FILL' 1" : "'FILL' 0"}}>home</span>
            </button>
            
            <button onClick={() => setMode('pomodoro')} className={`${mode === 'pomodoro' ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Focus">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'pomodoro' ? "'FILL' 1" : "'FILL' 0"}}>filter_center_focus</span>
            </button>

            <button onClick={() => setMode('break')} className={`${mode === 'break' ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Break">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: mode === 'break' ? "'FILL' 1" : "'FILL' 0"}}>coffee</span>
            </button>

            <button onClick={() => { setShowStats(!showStats); setRightPanelOpen(false); }} className={`${showStats ? 'bg-white/20 text-primary' : 'text-on-surface-variant hover:bg-white/10'} transition-all p-2 rounded-full flex items-center justify-center`} title="Stats">
              <span className="material-symbols-outlined text-[20px]">leaderboard</span>
            </button>

            <button onClick={() => { setSidebarOpen(true); setRightPanelOpen(false); }} className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Settings">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>

            <button onClick={toggleFullscreen} className="text-on-surface-variant hover:bg-white/10 transition-all p-2 rounded-full flex items-center justify-center" title="Fullscreen">
              <span className="material-symbols-outlined text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
          </div>
        )}

        <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="glass-panel rounded-full p-4 hover:bg-white/10 transition-all border border-white/20 shadow-2xl bg-surface/50 text-primary">
          <span className="material-symbols-outlined">{rightPanelOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {sidebarOpen && (
        <div className="absolute inset-0 bg-black/50 z-[55] backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)}></div>
      )}

      <aside className={`fixed left-0 top-0 h-full w-full max-w-[400px] bg-surface/90 md:bg-surface/80 backdrop-blur-[40px] border-r border-white/10 shadow-[40px_0_80px_rgba(0,0,0,0.3)] z-[60] py-container-padding flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 flex justify-between items-center mb-8">
          <div>
            <h1 className="font-h1 text-h1 font-bold text-primary">Focus10010</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Stay in flow</p>
          </div>
          <button className="text-primary p-2 hover:bg-white/10 rounded-full transition-colors border border-white/5" onClick={() => setSidebarOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="px-6 space-y-8 flex-grow overflow-y-auto">
            <section>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-stack-sm ml-1">Timer Mode</label>
              <div className="relative">
                <select 
                  value={mode === 'home' ? 'pomodoro' : mode} 
                  onChange={(e) => setMode(e.target.value)} 
                  className="w-full appearance-none bg-surface-container-high/50 border border-white/10 rounded-xl py-4 px-5 font-body-lg text-body-lg text-primary focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 backdrop-blur-md cursor-pointer transition-colors"
                >
                  <option className="bg-surface-container-highest text-primary" value="pomodoro">Pomodoro (Focus)</option>
                  <option className="bg-surface-container-highest text-primary" value="break">Break</option>
                  <option className="bg-surface-container-highest text-primary" value="stopwatch">Stopwatch</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-on-surface-variant">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </section>

            <section>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-stack-sm ml-1">Preferences</label>
              <div className="bg-surface-container-high/30 rounded-2xl p-glass-padding border border-white/5 flex flex-col gap-6">
                <div className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">linear_scale</span>
                    <span className="font-body-lg text-body-lg text-primary">Show timer progress bar</span>
                  </div>
                  <button aria-checked="true" className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-secondary" role="switch" type="button">
                    <span aria-hidden="true" className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-on-secondary shadow ring-0 transition duration-200 ease-in-out translate-x-5"></span>
                  </button>
                </div>
              </div>
            </section>
        </div>
      </aside>
    </>
  );
}

export default App;
