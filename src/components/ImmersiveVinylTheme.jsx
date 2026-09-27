import React from 'react';

/**
 * VinylRecord – a purely visual spinning record with album art centered.
 * Drop it anywhere and it will spin when isPlaying is true.
 */
export default function VinylRecord({ track, isPlaying, onTogglePlay, spotifyControls }) {
  const albumArt = track?.album?.images?.[0]?.url;
  const trackName = track?.name || 'No Track';
  const artistName = track?.artists?.map(a => a.name).join(', ') || 'Unknown Artist';

  if (!track) return null;

  return (
    <div className="flex flex-col items-center gap-4 pointer-events-auto">
      {/* Stage: Record + Tonearm */}
      <div className="relative flex items-center justify-center">

        {/* Ambient glow behind record */}
        <div className="absolute w-[400px] h-[400px] md:w-[520px] md:h-[520px] rounded-full blur-[80px] opacity-20 pointer-events-none bg-[#FFEE00]" />

        {/* The Vinyl Record */}
        <div
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          className={`group cursor-pointer relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] rounded-full vinyl-immersive-grooves record-spinning ${!isPlaying ? 'animation-paused' : ''} transition-transform duration-500 ease-out hover:scale-[1.01]`}
        >
          {/* Specular sheen */}
          <div className="absolute inset-0 rounded-full vinyl-sheen pointer-events-none mix-blend-screen opacity-90" />

          {/* Outer rim */}
          <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.07] pointer-events-none" />
          <div className="absolute inset-[3px] rounded-full border border-black/80 pointer-events-none" />

          {/* CENTER LABEL WITH ALBUM ART – uses top/left/transform for reliable centering */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[168px] h-[168px] sm:w-[216px] sm:h-[216px] md:w-[250px] md:h-[250px] rounded-full overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.85),inset_0_0_15px_rgba(0,0,0,0.6)] border-[4px] border-[#101014] bg-[#1a1a1f]">
            {/* Album art image */}
            {albumArt ? (
              <img
                src={albumArt}
                alt={trackName}
                className="w-full h-full object-cover pointer-events-none select-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#222]">
                <span className="material-symbols-outlined text-3xl text-white/40">music_note</span>
              </div>
            )}

            {/* Label ring overlays */}
            <div className="absolute inset-0 rounded-full border-[8px] border-black/30 pointer-events-none" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/30 via-transparent to-white/10 pointer-events-none" />

            {/* Spindle hole */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-tr from-[#111] via-[#333] to-[#777] border-2 border-[#111] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_2px_6px_rgba(0,0,0,0.9)] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-black shadow-inner" />
            </div>
          </div>

          {/* Hover play/pause overlay */}
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <span className="material-symbols-outlined text-white text-4xl drop-shadow-lg">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </div>
        </div>

        {/* TONEARM */}
        <div
          className="absolute -top-8 -right-4 sm:-top-12 sm:-right-8 md:-top-14 md:-right-12 pointer-events-none z-30"
          style={{ width: '180px', height: '300px' }}
        >
          {/* Pivot base */}
          <div className="absolute top-2 left-2 w-14 h-14 rounded-full bg-gradient-to-b from-[#2a2a30] via-[#1a1a20] to-[#0c0c0e] border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.2)] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3a3a44] to-[#121216] border border-white/20 shadow-inner flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full bg-[#18181e] border border-white/10" />
            </div>
          </div>

          {/* Rotating arm */}
          <div className={`tonearm-origin w-full h-full relative ${isPlaying ? 'tonearm-playing' : 'tonearm-paused'}`}>
            <div className="absolute top-0 left-4 w-7 h-8 -translate-y-3 rounded-sm bg-gradient-to-r from-[#444] via-[#777] to-[#333] border border-black/40 shadow-lg" />
            <svg className="w-full h-full drop-shadow-[0_10px_10px_rgba(0,0,0,0.85)]" viewBox="0 0 180 300" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              </defs>
              <path d="M 30 30 L 35 130 L 48 215 L 62 250" stroke="url(#armMetal)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 29 30 L 34 130 L 47 215 L 61 250" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="56" y="246" width="10" height="8" rx="2" transform="rotate(22 62 250)" fill="#111827" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <path d="M 60 256 L 72 284 L 62 288 L 52 261 Z" fill="url(#cartridgeGrad)" stroke="#4b5563" strokeWidth="1" />
              <rect x="61" y="272" width="6" height="3" rx="0.5" fill="#FFEE00" />
              <circle cx="69" cy="285" r="1.2" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>

      {/* Track info */}
      <div className="text-center max-w-[250px]">
        <p className="text-sm font-semibold text-white truncate">{trackName}</p>
        <p className="text-xs text-white/50 truncate">{artistName}</p>
      </div>

      {/* Mini playback controls */}
      <div className="flex items-center gap-5">
        <button onClick={() => spotifyControls?.prevTrack()} className="text-white/50 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-xl">skip_previous</span>
        </button>
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-xl text-white">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
        <button onClick={() => spotifyControls?.nextTrack()} className="text-white/50 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-xl">skip_next</span>
        </button>
      </div>
    </div>
  );
}
