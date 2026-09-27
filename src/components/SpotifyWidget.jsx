import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';

const SpotifyWidget = forwardRef(function SpotifyWidget({ isOpen, onClose, onPlaybackChange }, ref) {
  const [sdk, setSdk] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [playbackState, setPlaybackState] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolume] = useState(50);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressInterval = useRef(null);

  // Notify parent of playback changes
  useEffect(() => {
    if (onPlaybackChange) {
      const track = playbackState?.track_window?.current_track;
      const isPaused = playbackState?.paused ?? true;
      onPlaybackChange({
        track: track || null,
        isPlaying: !isPaused,
        progress,
        duration,
      });
    }
  }, [playbackState, progress, duration, onPlaybackChange]);

  // Progress tracking
  useEffect(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    if (playbackState && !playbackState.paused) {
      setProgress(playbackState.position || 0);
      setDuration(playbackState.duration || 0);

      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          const next = prev + 1000;
          return next >= (playbackState.duration || 0)
            ? playbackState.duration || 0
            : next;
        });
      }, 1000);
    } else if (playbackState) {
      setProgress(playbackState.position || 0);
      setDuration(playbackState.duration || 0);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [playbackState]);

  // Initialize SDK
  useEffect(() => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    if (!clientId) {
      setError('Spotify Client ID is missing. Add VITE_SPOTIFY_CLIENT_ID to your .env.local file.');
      setIsLoading(false);
      return;
    }

    const redirectUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
    const scopes = [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
    ];

    const spotifySdk = SpotifyApi.withUserAuthorization(clientId, redirectUrl, scopes);
    setSdk(spotifySdk);

    const checkAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hasCode = params.has('code');

        const token = await spotifySdk.getAccessToken();

        if (hasCode || token) {
          const authInfo = await spotifySdk.authenticate();
          if (authInfo && authInfo.authenticated) {
            setIsAuthenticated(true);
            if (hasCode) {
              window.history.replaceState({}, document.title, redirectUrl);
            }
          }
        }
      } catch (err) {
        console.error('Spotify auth error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Initialize Player once authenticated
  useEffect(() => {
    if (!isAuthenticated || !sdk) return;

    // Avoid loading the script more than once
    if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    let spotifyPlayer = null;

    window.onSpotifyWebPlaybackSDKReady = () => {
      spotifyPlayer = new window.Spotify.Player({
        name: 'Focus10010 Web Player',
        getOAuthToken: cb => {
          sdk.getAccessToken().then(token => {
            if (token && token.access_token) {
              cb(token.access_token);
            }
          });
        },
        volume: volume / 100
      });

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player ready with Device ID:', device_id);
        setDeviceId(device_id);
        // Transfer playback to this device
        sdk.player.transferPlayback([device_id]).catch(err => {
          console.error('Failed to transfer playback:', err);
        });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline:', device_id);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
        setPlaybackState(state);
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        setError('Player initialization failed: ' + message);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        setError('Authentication failed: ' + message);
        setIsAuthenticated(false);
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        setError('Spotify Premium is required for Web Playback.');
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };

    return () => {
      if (spotifyPlayer) {
        spotifyPlayer.disconnect();
      } else if (player) {
        player.disconnect();
      }
    };
  }, [isAuthenticated, sdk]);

  // Update player volume when volume slider changes
  useEffect(() => {
    if (player) {
      player.setVolume(volume / 100).catch(() => {});
    }
  }, [volume, player]);

  const handleLogin = async () => {
    if (sdk) {
      setIsLoading(true);
      await sdk.authenticate();
    }
  };

  const handleLogout = () => {
    if (player) {
      player.disconnect();
    }
    setPlayer(null);
    setIsAuthenticated(false);
    setPlaybackState(null);
    setSdk(null);
    // Clear stored tokens
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('spotify-sdk')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  const handlePlayPause = useCallback(() => {
    if (player) {
      player.togglePlay();
    }
  }, [player]);

  const handleNext = useCallback(() => {
    if (player) {
      player.nextTrack();
    }
  }, [player]);

  const handlePrevious = useCallback(() => {
    if (player) {
      player.previousTrack();
    }
  }, [player]);

  const handleSeek = useCallback((e) => {
    if (player && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const seekMs = Math.floor(pct * duration);
      player.seek(seekMs).then(() => {
        setProgress(seekMs);
      });
    }
  }, [player, duration]);

  const formatMs = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const track = playbackState?.track_window?.current_track;
  const isPaused = playbackState?.paused ?? true;

  useImperativeHandle(ref, () => ({
    togglePlay: handlePlayPause,
    nextTrack: handleNext,
    prevTrack: handlePrevious,
    seek: (ms) => {
      if (player) {
        player.seek(ms).then(() => setProgress(ms));
      }
    },
    setVolume: (v) => {
      setVolume(v);
      if (player) player.setVolume(v / 100).catch(() => {});
    }
  }));

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <h3 className="font-h2 text-lg text-primary">Spotify</h3>
        </div>
        <div className="flex items-center gap-1">
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="text-on-surface-variant hover:text-red-400 transition-colors p-1"
              title="Disconnect Spotify"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          )}
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-400 p-3 bg-red-400/10 rounded-lg border border-red-400/20">
          <p>{error}</p>
          <button
            onClick={() => { setError(''); setIsLoading(false); }}
            className="mt-2 text-xs text-red-300 underline"
          >
            Dismiss
          </button>
        </div>
      ) : isLoading ? (
        <div className="py-6 text-center text-sm text-on-surface-variant flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          <span>Connecting to Spotify...</span>
        </div>
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#1DB954" className="opacity-80">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <p className="text-sm text-on-surface-variant text-center">
            Connect your Spotify account to control music.
          </p>
          <p className="text-xs text-on-surface-variant/60 text-center">
            Requires Spotify Premium for playback.
          </p>
          <button
            onClick={handleLogin}
            className="px-5 py-2.5 rounded-full bg-[#1DB954] text-black font-semibold hover:bg-[#1ed760] transition-colors shadow-lg text-sm"
          >
            Connect Spotify
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {track ? (
            <>
              {/* Track Info */}
              <div className="flex items-center gap-3">
                <img
                  src={track.album.images[0]?.url || ''}
                  alt={track.album.name}
                  className="w-14 h-14 rounded-md shadow-md object-cover"
                />
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-sm font-medium text-white truncate">
                    {track.name}
                  </span>
                  <span className="text-xs text-on-surface-variant truncate">
                    {track.artists.map(a => a.name).join(', ')}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 truncate">
                    {track.album.name}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-on-surface-variant tabular-nums w-8 text-right">
                  {formatMs(progress)}
                </span>
                <div
                  className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer group relative"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-200 relative"
                    style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <span className="text-[10px] text-on-surface-variant tabular-nums w-8">
                  {formatMs(duration)}
                </span>
              </div>

              {/* Playback Controls */}
              <div className="flex justify-center items-center gap-5">
                <button
                  onClick={handlePrevious}
                  className="text-on-surface-variant hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">skip_previous</span>
                </button>
                <button
                  onClick={handlePlayPause}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                >
                  <span className="material-symbols-outlined text-2xl">
                    {isPaused ? 'play_arrow' : 'pause'}
                  </span>
                </button>
                <button
                  onClick={handleNext}
                  className="text-on-surface-variant hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">skip_next</span>
                </button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2 px-1">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
                  {volume === 0 ? 'volume_off' : volume < 50 ? 'volume_down' : 'volume_up'}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1 h-1 accent-primary bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-on-surface-variant flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              <span>Connecting to Spotify...</span>
              <span className="text-xs opacity-70 mt-2">
                Start playing something on Spotify to connect.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SpotifyWidget;
