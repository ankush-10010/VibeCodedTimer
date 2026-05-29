import React from 'react';

export default function SpotifyWidget({ onClose }) {
  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-h2 text-lg text-primary">Music</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">close</span></button>
      </div>
      
      {/* Lofi Girl Spotify Embed */}
      <iframe 
        style={{borderRadius: '12px'}} 
        src="https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4ZsnZxc?utm_source=generator&theme=0" 
        width="100%" 
        height="152" 
        frameBorder="0" 
        allowFullScreen="" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy"
      ></iframe>
    </div>
  );
}
