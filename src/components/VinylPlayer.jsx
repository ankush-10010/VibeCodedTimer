import React from 'react';

export default function VinylPlayer({ track, isPlaying, onTogglePlay }) {
  const albumArt = track?.album?.images?.[0]?.url;
  const trackName = track?.name || 'No track';
  const artistName = track?.artists?.map(a => a.name).join(', ') || 'Unknown artist';

  if (!track) return null;

  return (
    <div className="vinyl-player-container">
      <div
        className={`vinyl-disc ${isPlaying ? 'vinyl-spinning' : 'vinyl-paused'}`}
        onClick={onTogglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {/* Vinyl grooves - outer rings */}
        <div className="vinyl-grooves" />
        
        {/* Album art center */}
        <div className="vinyl-center">
          {albumArt ? (
            <img
              src={albumArt}
              alt={trackName}
              className="vinyl-album-art"
              draggable={false}
            />
          ) : (
            <div className="vinyl-album-art-placeholder">
              <span className="material-symbols-outlined text-3xl text-white/60">music_note</span>
            </div>
          )}
        </div>

        {/* Center dot (spindle) */}
        <div className="vinyl-spindle" />
        
        {/* Play/Pause overlay on hover */}
        <div className="vinyl-hover-overlay">
          <span className="material-symbols-outlined text-white text-3xl drop-shadow-lg">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </div>
      </div>

      {/* Track info below vinyl */}
      <div className="vinyl-track-info">
        <span className="vinyl-track-name">{trackName}</span>
        <span className="vinyl-artist-name">{artistName}</span>
      </div>
    </div>
  );
}
