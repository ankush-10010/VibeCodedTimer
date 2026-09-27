import React, { useState, useEffect } from 'react';

export default function ImmersiveVinylTheme({ timerState, spotifyState, spotifyControls, onExit }) {
  const { track, isPlaying, progress, duration } = spotifyState;
  const { mode, isRunning, timeRemaining, timeElapsed, start, pause, reset, lap, laps, formatTime, setDuration, dailyTotal } = timerState;
  
  const [localVolume, setLocalVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  const albumArt = track?.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";
  const trackName = track?.name || "No Track";
  const artistName = track?.artists?.map(a => a.name).join(', ') || "Unknown Artist";
  
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  
  const POMODORO_DEFAULT = 25 * 60;

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value);
    setLocalVolume(v);
    setIsMuted(v === 0);
    if (spotifyControls) spotifyControls.setVolume(v);
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      if (spotifyControls) spotifyControls.setVolume(localVolume > 0 ? localVolume : 50);
    } else {
      setIsMuted(true);
      if (spotifyControls) spotifyControls.setVolume(0);
    }
  };

  return (
    <div className="fixed inset-0 z-40 w-full h-full flex flex-col justify-between overflow-hidden bg-[#08080a] select-none font-sans text-white">
      
      {/* Heavy Atmospheric Blurred Album Background */}
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-out opacity-45 pointer-events-none scale-125"
        style={{
          backgroundImage: `url(${albumArt})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(90px) saturate(1.8) brightness(0.4)',
        }}
      />

      {/* Vignette Overlay & Soft Radial Darkness */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none" />

      {/* TOP BAR */}
      <header className="relative z-50 flex items-start justify-between px-6 md:px-12 pt-8 w-full max-w-7xl mx-auto">
        
        {/* Top Left: Exit Button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onExit}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] backdrop-blur-xl shadow-lg transition-colors group"
          >
            <span className="material-symbols-outlined text-sm text-white/70 group-hover:text-white transition-colors">arrow_back</span>
            <span className="text-xs font-semibold tracking-widest uppercase text-white/70 group-hover:text-white transition-colors">Exit Vinyl Mode</span>
          </button>
        </div>

        {/* Top Right: Glassmorphic Timer/Stopwatch Section */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] shadow-2xl transition-all duration-300 group">
            
            {/* Timer Display */}
            <div className="flex flex-col items-start pr-1">
              <div className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase font-semibold text-white/40 group-hover:text-white/60 transition-colors">
                <span className="material-symbols-outlined text-xs">
                  {mode === 'stopwatch' ? 'timer' : 'hourglass_empty'}
                </span>
                <span>
                  {mode === 'stopwatch' ? 'Stopwatch' : mode === 'break' ? 'Break' : 'Focus Session'}
                </span>
              </div>
              <span className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-white tabular-nums">
                {formatTime(mode === 'stopwatch' ? timeElapsed : timeRemaining)}
              </span>
            </div>

            <div className="h-8 w-px bg-white/10" />

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={isRunning ? pause : start}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-accent hover:text-black text-white flex items-center justify-center transition-all duration-200 active:scale-95 shadow-md"
                title={isRunning ? "Pause" : "Start"}
              >
                <span className="material-symbols-outlined text-lg fill-1">
                  {isRunning ? "pause" : "play_arrow"}
                </span>
              </button>

              {mode === 'stopwatch' ? (
                <button 
                  onClick={lap}
                  className="w-8 h-8 rounded-full bg-transparent hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
                  title="Lap"
                >
                  <span className="material-symbols-outlined text-sm">flag</span>
                </button>
              ) : (
                <button 
                  onClick={reset}
                  className="w-8 h-8 rounded-full bg-transparent hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
                  title="Reset"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                </button>
              )}
              
              {mode === 'stopwatch' && (
                <button 
                  onClick={reset}
                  className="w-8 h-8 rounded-full bg-transparent hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
                  title="Reset"
                >
                  <span className="material-symbols-outlined text-sm">device_reset</span>
                </button>
              )}

              {/* Mode switch pills for Pomodoro */}
              {mode !== 'stopwatch' && (
                <div className="hidden lg:flex items-center bg-black/40 rounded-xl p-0.5 border border-white/5 text-[11px] font-mono ml-1">
                  <button 
                    onClick={() => { reset(); setDuration(25 * 60); }} 
                    className="px-2 py-1 rounded-lg transition-colors text-white/40 hover:text-white">
                    25m
                  </button>
                  <button 
                    onClick={() => { reset(); setDuration(50 * 60); }} 
                    className="px-2 py-1 rounded-lg transition-colors text-white/40 hover:text-white">
                    50m
                  </button>
                  <button 
                    onClick={() => { reset(); setDuration(5 * 60); }} 
                    className="px-2 py-1 rounded-lg transition-colors text-white/40 hover:text-white">
                    5m
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Laps List underneath Timer */}
          {mode === 'stopwatch' && laps && laps.length > 0 && (
            <div className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-3 max-h-48 overflow-y-auto no-scrollbar shadow-xl animate-fade-in">
              <ul className="space-y-1.5">
                {laps.map((lapTime, i) => (
                  <li key={i} className="flex justify-between text-xs text-white/80">
                    <span className="text-white/40">Lap {i + 1}</span>
                    <span className="font-mono">{formatTime(lapTime)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </header>

      {/* CENTER: Massive Hero Vinyl Record & Interactive Stylus Tonearm */}
      <main className="relative z-40 flex-1 flex items-center justify-center py-2 px-4">
        
        <div className="relative flex items-center justify-center">

          {/* Ambient Glow Aura behind Vinyl */}
          <div 
            className="absolute w-[460px] h-[460px] md:w-[620px] md:h-[620px] rounded-full blur-[90px] opacity-20 transition-all duration-1000 pointer-events-none"
            style={{ backgroundColor: '#FFEE00' }}
          />

          {/* Turntable Base Platter Subtle Shadow */}
          <div className="absolute w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] md:w-[580px] md:h-[580px] rounded-full bg-[#08080a] border border-white/[0.03] shadow-[0_30px_90px_rgba(0,0,0,0.95)]" />

          {/* THE MASSIVE VINYL RECORD */}
          <div 
            onClick={() => spotifyControls?.togglePlay()}
            title={isPlaying ? "Click to Pause" : "Click to Play"}
            className={`group cursor-pointer relative w-[340px] h-[340px] sm:w-[450px] sm:h-[450px] md:w-[540px] md:h-[540px] rounded-full vinyl-grooves record-spinning ${!isPlaying ? 'animation-paused' : ''} transition-transform duration-500 ease-out hover:scale-[1.01]`}
          >
            <div className="absolute inset-0 rounded-full vinyl-sheen pointer-events-none mix-blend-screen opacity-90" />
            <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.07] pointer-events-none" />
            <div className="absolute inset-[3px] rounded-full border border-black/80 pointer-events-none" />

            {/* Center Record Label */}
            <div className="absolute inset-0 m-auto w-[130px] h-[130px] sm:w-[170px] sm:h-[170px] md:w-[204px] md:h-[204px] rounded-full overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.85),inset_0_0_15px_rgba(0,0,0,0.6)] border-[4px] border-[#101014] bg-[#1a1a1f] flex items-center justify-center">
              
              <img 
                src={albumArt} 
                alt={trackName}
                className="w-full h-full object-cover pointer-events-none select-none filter contrast-105"
              />

              <div className="absolute inset-0 rounded-full border-[10px] border-black/35 pointer-events-none" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />

              <div className="absolute inset-0 flex flex-col items-center justify-between p-3 pointer-events-none">
                <span className="text-[8px] font-mono tracking-widest text-white/70 uppercase">Side A • 33⅓ RPM</span>
                <span className="text-[7px] font-mono text-white/50 tracking-wider text-center max-w-[90px] truncate">{trackName}</span>
              </div>

              {/* Central Metallic Spindle Hole */}
              <div className="absolute w-7 h-7 rounded-full bg-gradient-to-tr from-[#111] via-[#333] to-[#777] border-2 border-[#111] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_2px_6px_rgba(0,0,0,0.9)] flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-black shadow-inner" />
              </div>
            </div>
          </div>

          {/* THE TONEARM (STYLUS) ASSEMBLY */}
          <div 
            className="absolute -top-12 -right-8 sm:-top-16 sm:-right-14 md:-top-20 md:-right-20 pointer-events-none z-30"
            style={{ width: '220px', height: '360px' }}
          >
            <div className="absolute top-2 left-2 w-16 h-16 rounded-full bg-gradient-to-b from-[#2a2a30] via-[#1a1a20] to-[#0c0c0e] border border-white/10 shadow-[0_12px_24px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.2)] flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#3a3a44] to-[#121216] border border-white/20 shadow-inner flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-[#18181e] border border-white/10" />
              </div>
            </div>

            <div className={`tonearm-origin w-full h-full relative ${isPlaying ? 'tonearm-playing' : 'tonearm-paused'}`}>
              <div className="absolute top-0 left-5 w-8 h-10 -translate-y-4 rounded-sm bg-gradient-to-r from-[#444] via-[#777] to-[#333] border border-black/40 shadow-lg" />
              <div className="absolute top-0 left-7 w-4 h-3 -translate-y-6 rounded-t-sm bg-[#222]" />

              <svg className="w-full h-full drop-shadow-[0_15px_15px_rgba(0,0,0,0.85)]" viewBox="0 0 220 360" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="armMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#d1d5db" />
                    <stop offset="35%" stopColor="#ffffff" />
                    <stop offset="70%" stopColor="#6b7280" />
                    <stop offset="100%" stopColor="#374151" />
                  </linearGradient>
                  <linearGradient id="cartridgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1f2937" />
                    <stop offset="100%" stopColor="#030712" />
                  </linearGradient>
                  <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8"/>
                  </filter>
                </defs>
                <path d="M 36 36 L 42 160 L 58 260 L 74 300" stroke="url(#armMetal)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#subtleGlow)" />
                <path d="M 35 36 L 41 160 L 57 260 L 73 300" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="68" y="295" width="12" height="10" rx="2" transform="rotate(22 74 300)" fill="#111827" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <path d="M 72 306 L 86 340 L 74 345 L 63 311 Z" fill="url(#cartridgeGrad)" stroke="#4b5563" strokeWidth="1.2" />
                <rect x="73" y="324" width="7" height="3.5" rx="0.5" fill="#FFEE00" />
                <circle cx="83" cy="342" r="1.5" fill="#ffffff" />
              </svg>
            </div>
          </div>
        </div>
      </main>

      {/* BOTTOM: Track Info, Sleek Progress Bar & Playback Controls */}
      <footer className="relative z-50 w-full max-w-2xl mx-auto px-6 pb-12 pt-3 flex flex-col items-center">
        
        <div className="text-center mb-4 transition-all duration-300">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1 drop-shadow-sm flex items-center justify-center gap-2">
            <span>{trackName}</span>
            {isPlaying && (
              <span className="flex items-center gap-0.5 h-3 ml-1.5">
                <span className="w-0.5 h-3 bg-accent animate-pulse" />
                <span className="w-0.5 h-2 bg-accent animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-0.5 h-3.5 bg-accent animate-pulse" style={{ animationDelay: '0.4s' }} />
              </span>
            )}
          </h1>
          <p className="text-sm font-medium text-white/50 tracking-wide hover:text-white/70 transition-colors cursor-pointer">
            {artistName}
          </p>
        </div>

        <div className="w-full flex items-center gap-3 mb-5 px-2">
          <span className="text-[11px] font-mono text-white/40 tabular-nums w-10 text-right">
            {formatTime(Math.floor(progress / 1000))}
          </span>

          <div 
            className="relative flex-1 h-6 flex items-center cursor-pointer group"
            onClick={(e) => {
              if (!spotifyControls || duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              spotifyControls.seek(Math.floor(pos * duration));
            }}
          >
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden transition-all group-hover:h-1.5">
              <div 
                className="h-full bg-accent rounded-full transition-all duration-150 relative shadow-[0_0_10px_#FFEE00]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div 
              className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <span className="text-[11px] font-mono text-white/40 tabular-nums w-10">
            {formatTime(Math.floor(duration / 1000))}
          </span>
        </div>

        <div className="flex items-center justify-between w-full max-w-md px-4">
          <button className="text-white/40 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 active:scale-95" title="Shuffle (Premium Required)">
            <span className="material-symbols-outlined text-xl">shuffle</span>
          </button>

          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => spotifyControls?.prevTrack()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              title="Previous Track">
              <span className="material-symbols-outlined text-2xl fill-1">skip_previous</span>
            </button>

            <button 
              onClick={() => spotifyControls?.togglePlay()}
              className="w-14 h-14 rounded-full bg-white text-black hover:bg-accent flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_30px_rgba(255,238,0,0.5)] transition-all duration-300 active:scale-95 group"
              title={isPlaying ? "Pause" : "Play"}>
              <span className="material-symbols-outlined text-3xl fill-1 text-black transition-transform group-hover:scale-105">
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>

            <button 
              onClick={() => spotifyControls?.nextTrack()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              title="Next Track">
              <span className="material-symbols-outlined text-2xl fill-1">skip_next</span>
            </button>
          </div>

          <div className="relative group/vol flex items-center">
            <button 
              onClick={handleMuteToggle}
              className="text-white/40 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 active:scale-95"
              title={isMuted ? "Unmute" : "Mute"}>
              <span className="material-symbols-outlined text-xl">
                {isMuted || localVolume === 0 ? "volume_off" : localVolume < 50 ? "volume_down" : "volume_up"}
              </span>
            </button>
            <div className="absolute bottom-full right-0 mb-2 p-2.5 rounded-xl bg-[#141418] border border-white/10 shadow-2xl opacity-0 pointer-events-none group-hover/vol:opacity-100 group-hover/vol:pointer-events-auto transition-opacity duration-200 flex items-center gap-2 w-32">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={isMuted ? 0 : localVolume}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>
        </div>

      </footer>
    </div>
  );
}
