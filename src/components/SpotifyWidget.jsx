import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'flocus-spotify-url';
const DEFAULT_SPOTIFY_URL = 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4ZsnZxc';

/**
 * Parses a Spotify URL and returns the embed URL with compact and dark theme params.
 * Supports tracks, albums, playlists, artists, podcasts, episodes, and shows.
 * Returns null if the URL is not a valid Spotify link.
 */
function parseSpotifyUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Match open.spotify.com URLs (with or without /embed/ already)
  // e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  //      https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M
  //      https://open.spotify.com/track/abc123?si=xyz
  const spotifyRegex = /^https?:\/\/open\.spotify\.com\/(?:embed\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/;
  const match = trimmed.match(spotifyRegex);

  if (!match) return null;

  const type = match[1];
  const id = match[2];

  return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0&compact=true`;
}

export default function SpotifyWidget({ onClose }) {
  const [savedUrl, setSavedUrl] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  // Determine the active URL (saved or default)
  const activeUrl = savedUrl || DEFAULT_SPOTIFY_URL;
  const embedUrl = parseSpotifyUrl(activeUrl);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    setError('');

    const parsed = parseSpotifyUrl(inputValue);
    if (!parsed) {
      setError('Please paste a valid Spotify link (track, album, playlist, artist, or podcast).');
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, inputValue.trim());
    } catch {
      // localStorage may be unavailable
    }
    setSavedUrl(inputValue.trim());
    setInputValue('');
    setIsEditing(false);
  }, [inputValue]);

  const handleChange = () => {
    setInputValue(savedUrl || '');
    setIsEditing(true);
    setError('');
  };

  const handleCancel = () => {
    setInputValue('');
    setIsEditing(false);
    setError('');
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage may be unavailable
    }
    setSavedUrl('');
    setIsEditing(false);
    setError('');
  };

  // Show input form when no URL is saved and not yet embedded, or when editing
  const showInput = isEditing || !savedUrl;

  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-h2 text-lg text-primary">Music</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Spotify Embed */}
      {embedUrl && (
        <iframe
          style={{ borderRadius: '12px' }}
          src={embedUrl}
          width="100%"
          height="152"
          frameBorder="0"
          allowFullScreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify Player"
        ></iframe>
      )}

      {/* Input / Change Controls */}
      {showInput ? (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError('');
            }}
            placeholder="Paste a Spotify link..."
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-on-surface-variant placeholder:text-on-surface-variant/50 text-sm focus:outline-none focus:border-primary transition-colors"
            autoFocus={isEditing}
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors border border-primary/30"
            >
              Save
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-lg bg-black/30 text-on-surface-variant text-sm hover:bg-black/40 transition-colors border border-white/20"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleChange}
            className="flex-1 px-3 py-1.5 rounded-lg bg-black/30 text-on-surface-variant text-sm hover:bg-black/40 transition-colors border border-white/20"
          >
            Change
          </button>
          {savedUrl && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-black/30 text-on-surface-variant text-sm hover:bg-black/40 transition-colors border border-white/20"
              title="Reset to default Lofi Girl playlist"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
